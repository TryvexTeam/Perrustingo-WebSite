import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { crearClienteServicio } from "@/lib/supabase/servicio";
import { supabaseConfigurado } from "@/lib/citas";
import { offsetNegocio, TZ_NEGOCIO } from "@/lib/agenda";
import { hoyEnSantiago } from "@/lib/disponibilidad";
import { evaluarCupon, type Cupon } from "@/lib/cupones";
import { contarVisitasPrevias, obtenerCupon, registrarUsoCupon } from "@/lib/cuponesDatos";
import { normalizarTelefono, validarContacto } from "@/lib/contacto";
import {
  consumir,
  ipDe,
  textoEspera,
  LIMITE_RESERVA_IP,
  LIMITE_RESERVA_TELEFONO,
} from "@/lib/rateLimit";
import { diaSemanaDe, evaluarReserva } from "@/lib/disponibilidad";
import { formatRangoCLP } from "@/lib/reserva";
import { cotizar, leerConfigCotizacion, type EntradaCotizacion } from "@/lib/cotizacion";
import { WHATSAPP_NUMBER, hayWhatsAppConfigurado } from "@/lib/site";
import { enviarCorreo, correoConfigurado, CORREO_EQUIPO } from "@/lib/correo";
import {
  correoCliente,
  correoEquipo,
  type DatosCorreo,
  type PerroCorreo,
} from "@/lib/correoPlantillas";
import {
  obtenerBloqueosParciales,
  obtenerDisponibilidad,
  obtenerExcepciones,
  obtenerHorariosEquipo,
  obtenerOcupacion,
} from "@/lib/disponibilidadDatos";
import { capacidadSegunHorarios } from "@/lib/horarios";

/* POST /api/reservas v2 — reserva multi-perrito (1-3). Crea UNA sesión
   'pendiente' por perrito; si el usuario está logueado además guarda/actualiza
   la ficha en `perros` y adjunta las fotos en `fotos_sesion`.

   Degradación: si la DB del cliente aún no tiene las migraciones 002/004
   (columnas contacto_* / cupon_*), reintenta con el set mínimo de columnas
   de schema.sql para no perder la solicitud. */

/* Lo que el servidor necesita para RECALCULAR el precio.
   Antes no existía y por eso `precioEstimado` era palabra santa: llegaba un
   entero cualquiera entre 0 y 500.000 y se guardaba tal cual en `precio_base`.
   Un POST a mano con `precioEstimado: 0` quedaba grabado en cero.

   Es opcional para no romper a un cliente viejo que todavía no lo mande: en ese
   caso se cotiza con el peso que venga en `detalle`, se cobra el precio base y
   queda anotado en la ficha. Degradar, no romper. */
const cotizacionSchema = z.object({
  pesoKg: z.number().min(0).max(200),
  alturaCm: z.number().min(0).max(300).nullable().optional().default(null),
  contextura: z.string().trim().max(20).optional().default(""),
  tipoPelo: z.string().trim().max(40).optional().default(""),
  temperamentoGeneral: z.string().trim().max(40).optional().default(""),
  raza: z.string().trim().max(60).optional().default(""),
  edadMeses: z.number().int().min(0).max(600).optional().default(0),
  zonasSensibles: z.number().int().min(0).max(8).optional().default(0),
  /* El servicio viaja igual por compatibilidad de forma, pero NO se usa: el
     que manda es el del nivel superior, que ya está validado. */
  servicio: z.string().trim().max(80).optional().default(""),
});

const perroSchema = z.object({
  detalle: z.record(z.string(), z.string()),
  /** Lo que se le MOSTRÓ al cliente. Ya no decide el precio: solo sirve para
      detectar un desacuerdo con lo que calcula el servidor y dejar rastro. */
  precioEstimado: z.number().int().min(0).max(500000).nullable(),
  cotizacion: cotizacionSchema.nullable().optional().default(null),
  esManual: z.boolean().optional().default(false),
  /* Ficha guardada que la reserva reutiliza (30-jul). Solo un uuid: la
     pertenencia se verifica abajo contra la sesión — un id ajeno no
     actualiza nada. */
  perroId: z.string().uuid().nullable().optional().default(null),
  /* Desde PRP-002 F4 el bucket es privado y lo que viaja es la RUTA del
     objeto, no una URL. Se valida la forma: `<uid>/<archivo>`, sin saltos
     de carpeta ni protocolos — es un dato que llega por la red y termina
     escrito en la ficha del cliente. */
  fotoActualRuta: z
    .string()
    .regex(/^[0-9a-f-]{36}\/[A-Za-z0-9._-]+$/, "Ruta de foto inválida")
    .nullable()
    .optional()
    .default(null),
  fotoReferenciaRuta: z
    .string()
    .regex(/^[0-9a-f-]{36}\/[A-Za-z0-9._-]+$/, "Ruta de foto inválida")
    .nullable()
    .optional()
    .default(null),
  ficha: z
    .object({
      nombre: z.string().trim().max(60).optional().default(""),
      raza: z.string().trim().max(60).nullable().optional().default(null),
      pesoKg: z.number().min(0).max(120).nullable().optional().default(null),
      contextura: z.enum(["delgado", "normal", "robusto"]).nullable().optional().default(null),
      tipoPelo: z.string().trim().max(40).nullable().optional().default(null),
      temperamento: z
        .enum(["se_deja", "no_se_deja", "complicado", "no_lo_se"])
        .nullable()
        .optional()
        .default(null),
      alergias: z.string().trim().max(200).nullable().optional().default(null),
    })
    .optional(),
});

const reservaSchema = z.object({
  contacto: z.object({
    nombre: z.string().trim().min(2).max(80),
    email: z.string().trim().email().max(120),
    telefono: z
      .string()
      .trim()
      // Se aceptan paréntesis y guiones: la gente escribe (56) 9-1234-5678.
      // Lo que importa es que queden 8-11 dígitos tras normalizar, y de eso
      // se encarga `validarContacto` más abajo.
      .regex(/^[+\d\s()-]{8,20}$/, "Teléfono inválido"),
    /* Comuna: con cuenta sale del perfil, sin cuenta la escribe la persona.
       Opcional en el schema por compatibilidad con clientes viejos que aún
       no la mandan; la validación real está abajo. */
    comuna: z.string().trim().max(60).optional().default(""),
  }),
  fechaDeseada: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  /* Instante exacto del bloque elegido (Fase 5). Opcional para no romper a
     un cliente viejo que solo mande el día: en ese caso se cae al
     comportamiento anterior (00:00) y no se valida capacidad, porque sin
     hora no hay bloque que llenar. */
  inicio: z.string().datetime({ offset: true }).nullable().optional().default(null),
  servicio: z.string().trim().min(3).max(80),
  cupon: z
    .object({
      codigo: z.string().trim().max(40),
      pct: z.number().int().min(1).max(50),
    })
    .nullable()
    .optional()
    .default(null),
  /** Oferta que el cliente dice que le corresponde. El servidor NO confía:
      hoy el precio es referencial y se confirma en la puerta, así que solo
      se guarda para saber qué se le prometió. Si algún día el estimado pasa
      a ser vinculante, hay que revalidarla acá. */
  ofertaId: z.string().uuid().nullable().optional().default(null),
  perros: z.array(perroSchema).min(1).max(3),
  /** Honeypot anti-spam: los humanos lo dejan vacío. */
  apellidoPaterno: z.string().max(0).optional(),
});

interface FilaSesion {
  [key: string]: unknown;
}

export async function POST(request: NextRequest) {
  if (!supabaseConfigurado()) {
    return NextResponse.json(
      { success: false, error: "Base de datos no configurada todavía." },
      { status: 503 }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, error: "Cuerpo inválido." },
      { status: 400 }
    );
  }

  const parsed = reservaSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: "Datos de solicitud inválidos." },
      { status: 400 }
    );
  }

  const { contacto, fechaDeseada, servicio, cupon, perros, inicio, ofertaId } = parsed.data;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  /* Rate limit compartido entre instancias (PRP-004 F1). Antes era un Map
     en memoria: en serverless cada instancia tenía el suyo, así que el
     límite real era "8 × instancias" y se reiniciaba en cada despliegue.

     Dos capas, porque una sola no alcanza:
     · por IP, que frena el ruido pero se rota con facilidad;
     · por teléfono, que es lo que de verdad ata la reserva a una persona.
     Se consume la de IP primero para no gastar una consulta si ya excedió. */
  const limiteIp = await consumir(supabase, "reserva-ip", ipDe(request.headers), LIMITE_RESERVA_IP);
  if (!limiteIp.permitido) {
    return NextResponse.json(
      {
        success: false,
        error: `Demasiadas solicitudes. Intente en ${textoEspera(limiteIp.reiniciaEn)}.`,
      },
      { status: 429, headers: { "Retry-After": String(limiteIp.reiniciaEn) } }
    );
  }

  const limiteTel = await consumir(
    supabase,
    "reserva-tel",
    normalizarTelefono(contacto.telefono),
    LIMITE_RESERVA_TELEFONO
  );
  if (!limiteTel.permitido) {
    return NextResponse.json(
      {
        success: false,
        // Se le dice con qué dato chocó: si es una persona real con varios
        // perritos, sabe que debe llamar en vez de insistir.
        error: `Ya se registraron varias solicitudes con este teléfono. Intente en ${textoEspera(
          limiteTel.reiniciaEn
        )} o escríbanos por WhatsApp.`,
      },
      { status: 429, headers: { "Retry-After": String(limiteTel.reiniciaEn) } }
    );
  }

  /* Reserva sin cuenta (PRP-003 F1): quien no tiene sesión escribe su
     contacto en el formulario. Se revalida acá porque el navegador es un
     dato de origen no confiable — este endpoint es público. */
  if (!user) {
    const problema = validarContacto({
      nombre: contacto.nombre,
      telefono: contacto.telefono,
      email: contacto.email,
      comuna: contacto.comuna,
    });
    if (problema) {
      return NextResponse.json({ success: false, error: problema }, { status: 400 });
    }
  }

  /* El cupón se revalida acá aunque el formulario ya lo hizo: este POST es
     público, y sin esta consulta cualquiera podía inventarse un código con
     hasta 50% de descuento y quedaba guardado en la cita como si fuera real.
     El porcentaje se toma SIEMPRE de la tabla, nunca del navegador — si el
     admin cambió el descuento después de que el formulario lo validó, vale
     el vigente. La consulta pasa por RLS, que solo muestra cupones activos:
     un cupón desactivado desaparece por el mismo camino.

     OJO con un matiz que ya mordió (30-jul): el formulario junta cupón y
     oferta en el MISMO campo. Cuando el descuento viene de una oferta —la
     bienvenida, por ejemplo— manda el marcador "PRIMERA_CITA", que no es un
     cupón y no está en la tabla. La primera versión de esta validación lo
     rechazaba, y con eso ninguna reserva con descuento de bienvenida podía
     completarse. Por eso el segundo camino: si el código no es un cupón pero
     la reserva trae oferta, se verifica que ESA oferta exista y esté activa,
     y el porcentaje se toma de la tabla de ofertas.

     Desde el 4-ago el primer camino ya no es un `select` a secas: pasa por
     `evaluarCupon` (lib/cupones.ts), que además de existir y estar activo
     comprueba vigencia, tope de usos, anticipación, número de visita, cuenta
     y servicio. Un cupón rechazado devuelve el MENSAJE del dominio —el que
     explica qué le falta a la persona— y no un genérico que no se puede
     accionar. */
  let cuponVerificado: { codigo: string; pct: number } | null = null;
  /* El cupón del dominio se guarda para poder registrar el canje DESPUÉS de
     que la cita quedó insertada: sumar el uso antes sería descontarle un canje
     a alguien cuya reserva quizá nunca se creó. */
  let cuponCanjeado: Cupon | null = null;

  /* El número de visita lo piden dos cosas: las condiciones del cupón y la
     elección de la oferta vigente. Se consulta UNA vez y se recuerda — antes
     vivía dentro del `if (cupon)` y el camino de ofertas habría tenido que
     repetir la consulta. */
  let visitasCache: number | null = null;
  const visitasPrevias = async (): Promise<number> => {
    if (visitasCache === null) {
      visitasCache = await contarVisitasPrevias(supabase, contacto.email, contacto.telefono);
    }
    return visitasCache;
  };

  if (cupon) {
    const codigo = cupon.codigo.trim().toUpperCase();
    const filaCupon = await obtenerCupon(supabase, codigo);

    if (filaCupon) {
      /* El número de visita cuenta ESTA incluida: quien no tiene citas
         completadas previas viene por primera vez. */
      const veredicto = evaluarCupon(filaCupon, {
        fechaCita: fechaDeseada,
        hoy: hoyEnSantiago(),
        numeroVisita: (await visitasPrevias()) + 1,
        tieneCuenta: Boolean(user),
        servicioSlug: servicio,
      });

      if (!veredicto.ok) {
        return NextResponse.json(
          { success: false, error: veredicto.mensaje },
          { status: 400 }
        );
      }

      // El porcentaje sale del dominio, nunca del navegador.
      cuponVerificado = { codigo: filaCupon.codigo, pct: veredicto.descuentoPct };
      cuponCanjeado = filaCupon;
    } else if (ofertaId) {
      const { data: filaOferta } = await supabase
        .from("ofertas")
        .select("id, tipo, pct")
        .eq("id", ofertaId)
        .eq("activa", true)
        .maybeSingle();
      if (!filaOferta) {
        return NextResponse.json(
          { success: false, error: "Ese descuento ya no está vigente." },
          { status: 400 }
        );
      }
      cuponVerificado = {
        codigo,
        /* Si la oferta es porcentual, manda la tabla. Si es de monto fijo,
           el pct del navegador se guarda solo como referencia de lo que se
           le mostró — el precio real se confirma en la puerta, como
           siempre. */
        pct: filaOferta.tipo === "pct" ? Math.abs(filaOferta.pct) : cupon.pct,
      };
    } else {
      return NextResponse.json(
        { success: false, error: "Ese cupón no existe o ya no está activo." },
        { status: 400 }
      );
    }
  }

  /* Puerta de disponibilidad (PRP-001 Fase 5). El formulario ya no ofrece
     horarios imposibles, pero esto es un POST público: quien mande el
     cuerpo a mano se salta la UI entera. La decisión se toma con el MISMO
     motor que usa el formulario, así que no pueden discrepar. */
  /* Fecha bloqueada por el local (migración 026). Va FUERA del `if (inicio)`
     a propósito: el resto de la puerta solo corre cuando vino un bloque
     horario, así que una reserva sin hora —el camino viejo, todavía
     aceptado— se saltaba la validación entera. Un día libre se podía tomar
     simplemente omitiendo `inicio`. */
  const excepciones = await obtenerExcepciones(supabase, fechaDeseada, fechaDeseada);
  const fechaBloqueada = excepciones.find((e) => e.fecha === fechaDeseada);
  if (fechaBloqueada) {
    return NextResponse.json(
      { success: false, error: fechaBloqueada.mensaje },
      { status: 409 }
    );
  }

  if (inicio) {
    const { config, tramos, capacidad } = await obtenerDisponibilidad(supabase);
    const dia = new Date(inicio);
    const finDia = new Date(dia.getTime() + 24 * 60 * 60 * 1000);
    const ocupacion = await obtenerOcupacion(
      supabase,
      new Date(dia.getTime() - 24 * 60 * 60 * 1000).toISOString(),
      finDia.toISOString()
    );

    /* Los bloqueos por hora y por peluquero también se comprueban acá y no
       solo en la pantalla: si el formulario esconde la hora pero el endpoint
       la acepta, basta con mandar el request a mano para reservar sobre el
       día libre de alguien. */
    const bloqueos = await obtenerBloqueosParciales(supabase, fechaDeseada, fechaDeseada);

    /* Y el horario propio de cada peluquero (039), por el mismo motivo: si la
       pantalla oculta las horas en que no hay nadie pero el endpoint las
       acepta, el recorte no sirve de nada. */
    const horarios = await obtenerHorariosEquipo(supabase);

    const veredicto = evaluarReserva({
      fecha: fechaDeseada,
      inicio,
      tramos,
      config,
      capacidad,
      ocupacion,
      excepciones,
      bloqueos,
      capacidadPorHora: capacidadSegunHorarios(horarios, diaSemanaDe) ?? undefined,
      // Una reserva de tres perritos ocupa tres lugares de ese bloque.
      cupos: perros.length,
    });

    if (!veredicto.ok) {
      return NextResponse.json(
        { success: false, error: veredicto.mensaje ?? "Ese horario no está disponible." },
        { status: 409 }
      );
    }
  }

  /* ── Con qué se cobra ───────────────────────────────────────────────────
     La configuración de precios se lee UNA vez para toda la reserva: son
     tramos, tarifas, alturas, servicios y agregados, y traerlos por perrito
     multiplicaría las consultas sin cambiar el resultado. */
  const configCotizacion = await leerConfigCotizacion(supabase);

  /* ── El recargo que arrastra el cliente, reclamado de una vez ───────────
     `consumir_penalizacion` (migración 037) marca la fila como consumida en
     la MISMA sentencia que la elige, con `for update skip locked`: dos
     reservas simultáneas del mismo cliente no pueden llevarse la misma
     penalización. Leer primero y escribir después —que es lo natural— dejaría
     esa ventana abierta.

     Se reclama ANTES de insertar porque el recargo tiene que entrar en el
     precio que se guarda. Si al final no queda ninguna cita, se devuelve con
     `liberar_penalizacion`: cobrar un recargo por una reserva que no existe
     sería quedarse con plata ajena por un error nuestro.

     Va con el cliente de servicio porque la función se le revocó a anon y a
     authenticated: un cliente cualquiera no puede consumir su propia deuda. */
  const clienteServicio = crearClienteServicio();
  let penalizacionId: string | null = null;
  let recargoPendientePct = 0;

  if (clienteServicio) {
    const { data: reclamada, error: errPenal } = await clienteServicio.rpc(
      "consumir_penalizacion",
      { p_email: contacto.email, p_telefono: contacto.telefono }
    );
    if (errPenal) {
      /* No se voltea la reserva por esto. Perder un recargo es recuperable
         —queda pendiente para la próxima—; rechazar la cita no lo es. Pero
         queda escrito: un fallo silencioso acá se ve igual que "no debía
         nada", y son cosas muy distintas. */
      console.warn("[reservas] no se pudo reclamar la penalización:", errPenal.message);
    } else {
      const r = (reclamada ?? {}) as { id?: string | null; pct?: number | string };
      const n = Number(r.pct ?? 0);
      if (r.id && Number.isFinite(n) && n > 0) {
        penalizacionId = r.id;
        recargoPendientePct = n;
      }
    }
  } else {
    console.warn(
      "[reservas] sin SUPABASE_SERVICE_ROLE_KEY: la penalización pendiente no se pudo reclamar."
    );
  }

  const ids: string[] = [];
  let parcial = false;

  /* El descuento ya se resolvió arriba —cupón u oferta, nunca los dos— y
     viene con el porcentaje que dijo el SERVIDOR. Acá solo se le da la forma
     de ajuste, con el signo negativo que usa el dominio para lo que resta. */
  const descuentoGlobal = cuponVerificado
    ? { etiqueta: `Cupón ${cuponVerificado.codigo}`, pct: -Math.abs(cuponVerificado.pct) }
    : null;

  for (const [i, perro] of perros.entries()) {
    /* Ficha del perrito (solo logueado; el registro es obligatorio en el
       flujo nuevo, pero la API tolera anónimo por compatibilidad).

       Si la reserva trae `perroId`, se ACTUALIZA esa ficha en vez de crear
       otra — antes cada reserva insertaba una nueva y el mismo perrito se
       duplicaba en la base con cada visita. El doble filtro (`id` +
       `cliente_id = user.id`) hace que un id ajeno simplemente no toque
       ninguna fila: en ese caso se cae al INSERT de siempre, que crea la
       ficha propia. RLS (`cliente_ve_sus_perros`) refuerza lo mismo. */
    let perroId: string | null = null;
    if (user && perro.perroId && perro.ficha?.nombre) {
      const { data: mia } = await supabase
        .from("perros")
        .update({
          nombre: perro.ficha.nombre,
          raza: perro.ficha.raza,
          peso_kg: perro.ficha.pesoKg,
          contextura: perro.ficha.contextura,
          tipo_pelo: perro.ficha.tipoPelo,
          temperamento: perro.ficha.temperamento,
          alergias: perro.ficha.alergias,
          /* La foto solo se pisa si esta reserva trae una nueva. */
          ...(perro.fotoActualRuta ? { foto_url: perro.fotoActualRuta } : {}),
        })
        .eq("id", perro.perroId)
        .eq("cliente_id", user.id)
        .select("id")
        .maybeSingle();
      perroId = mia?.id ?? null;
    }
    if (!perroId && user && perro.ficha?.nombre) {
      const { data: fila } = await supabase
        .from("perros")
        .insert({
          cliente_id: user.id,
          nombre: perro.ficha.nombre,
          raza: perro.ficha.raza,
          peso_kg: perro.ficha.pesoKg,
          contextura: perro.ficha.contextura,
          tipo_pelo: perro.ficha.tipoPelo,
          temperamento: perro.ficha.temperamento,
          alergias: perro.ficha.alergias,
          foto_url: perro.fotoActualRuta,
        })
        .select("id")
        .single();
      perroId = fila?.id ?? null;
      if (!perroId) parcial = true;
    }

    /* El id se genera acá en vez de leerlo del INSERT.
       Motivo (cazado 26-jul): `.insert().select("id")` hace un RETURNING, y
       un visitante anónimo no tiene ninguna policy de SELECT sobre la fila
       que acaba de crear — el INSERT pasaba y la lectura moría con 42501,
       así que toda reserva sin cuenta terminaba en 500. Con el id conocido
       de antemano no hace falta leer nada de vuelta. */
    const sesionIdGenerado = crypto.randomUUID();

    /* ── El precio lo decide el servidor ────────────────────────────────
       `precioEstimado` es lo que se le MOSTRÓ al cliente, y hasta hoy era
       también lo que se guardaba: un POST a mano con `precioEstimado: 0`
       quedaba grabado en cero. Ahora se recalcula con la misma función que
       usa el formulario (`cotizar`), pero con la configuración leída de la
       base — el navegador ya no decide cuánto vale nada.

       Si el cliente no mandó los datos de cotización (versión vieja del
       formulario), no se puede recalcular y se cae al estimado. Degradar,
       no romper: perder la reserva sería peor que guardar un número
       peor. */
    const entrada: EntradaCotizacion | null = perro.cotizacion
      ? { ...perro.cotizacion, servicio }
      : null;
    const estimadoServidor = entrada
      ? cotizar(entrada, configCotizacion, {
          descuentoGlobal,
          recargoPenalizacionPct: recargoPendientePct,
        })
      : null;
    const precioCobrado = estimadoServidor?.total ?? perro.precioEstimado;

    /* Un desacuerdo entre las dos cifras no voltea la reserva —el precio
       final lo confirma el equipo en la puerta—, pero NUNCA pasa callado:
       que el cliente vea un número y se guarde otro sin dejar rastro es
       peor que cualquiera de los dos números. Si esto aparece seguido, es
       que los dos lados se desincronizaron y hay que mirarlo. */
    if (
      estimadoServidor &&
      typeof perro.precioEstimado === "number" &&
      estimadoServidor.total !== perro.precioEstimado
    ) {
      console.warn(
        `[reservas] el precio del servidor (${estimadoServidor.total}) no coincide con el que vio el cliente (${perro.precioEstimado}) en el perrito ${i + 1}. Manda el del servidor.`
      );
    }

    const filaCompleta: FilaSesion = {
      id: sesionIdGenerado,
      estado: "pendiente",
      cliente_id: user?.id ?? null,
      perro_id: perroId,
      fecha_cita: inicio ?? `${fechaDeseada}T00:00:00${offsetNegocio(fechaDeseada)}`,
      servicio,
      precio_base: precioCobrado,
      contacto_nombre: contacto.nombre,
      contacto_email: contacto.email,
      contacto_telefono: contacto.telefono,
      contacto_comuna: contacto.comuna || null,
      oferta_id: ofertaId,
      detalle_form: perro.detalle,
      cupon_codigo: cuponVerificado?.codigo ?? null,
      descuento_pct: cuponVerificado?.pct ?? 0,
    };

    let sesionId: string | null = null;
    const intento1 = await supabase.from("sesiones").insert(filaCompleta);

    /* Un rechazo de REGLA DE NEGOCIO no se reintenta: el tope de citas por
       teléfono (migración 017) lo levanta un trigger, y volver a intentar
       con el set mínimo solo produce el mismo rechazo — pero perdiendo el
       mensaje por el camino, que es lo que la persona necesita leer.
       El fallback de abajo existe para columnas faltantes, no para esto. */
    if (intento1.error?.code === "23514") {
      return NextResponse.json(
        { success: false, error: intento1.error.message },
        { status: 429 }
      );
    }

    if (intento1.error) {
      /* 42703 = columna inexistente (migraciones pendientes) → set mínimo */
      const { error: error2 } = await supabase
        .from("sesiones")
        .insert({
          id: sesionIdGenerado,
          estado: "pendiente",
          cliente_id: user?.id ?? null,
          perro_id: perroId,
          fecha_cita: inicio ?? `${fechaDeseada}T00:00:00${offsetNegocio(fechaDeseada)}`,
          servicio,
          precio_base: precioCobrado,
          notas_cliente: `${contacto.nombre} · ${contacto.telefono} · ${contacto.email}`,
        });
      sesionId = error2 ? null : sesionIdGenerado;
      parcial = true;
    } else {
      sesionId = sesionIdGenerado;
    }

    if (!sesionId) {
      return NextResponse.json(
        {
          success: false,
          error: `No se pudo registrar la solicitud del perrito ${i + 1}.`,
        },
        { status: 500 }
      );
    }
    ids.push(sesionId);

    /* Fotos: actual = 'antes', referencia del corte = 'referencia' */
    const fotosRows = [
      perro.fotoActualRuta && { sesion_id: sesionId, tipo: "antes", ruta: perro.fotoActualRuta },
      perro.fotoReferenciaRuta && {
        sesion_id: sesionId,
        tipo: "referencia",
        ruta: perro.fotoReferenciaRuta,
        notas: "Referencia de corte elegida por el cliente",
      },
    ].filter(Boolean) as { sesion_id: string; tipo: string; ruta: string; notas?: string }[];

    if (fotosRows.length > 0) {
      const { error: errFotos } = await supabase.from("fotos_sesion").insert(fotosRows);
      if (errFotos) parcial = true;
    }
  }

  /* ── Los dos correos (27-jul) ──────────────────────────────────────
     Al cliente, su confirmación; al salón, el aviso con todo lo que hace
     falta para prepararse.

     Se esperan (`await`) en vez de dispararse y olvidarse: en una función
     serverless, lo que queda pendiente cuando se devuelve la respuesta se
     corta a la mitad. Un correo a medio enviar es un correo que no llega.

     Nada de esto puede voltear la reserva: si el envío falla, la cita ya
     está creada y el WhatsApp sale igual. El fallo se anota en `parcial`
     para que quede rastro, no para bloquear al cliente. */
  if (ids.length > 0) {
    const fallo = await enviarCorreosDeReserva({
      origen: origenDe(request),
      ids,
      contacto,
      perros,
      servicio,
      inicio,
      fechaDeseada,
    });
    if (fallo) parcial = true;
  }

  /* ── El canje se registra recién ahora ─────────────────────────────────
     Solo con la cita ya creada, y solo si el cupón tiene tope: sin tope el
     contador no decide nada y un UPDATE por reserva sería ruido.

     Va con el cliente de servicio a propósito. `cupones` solo tiene GRANT
     SELECT para anon/authenticated: un UPDATE con el cliente público no
     falla, pasa por RLS, toca cero filas y devuelve éxito — el tope quedaría
     de adorno sin que nadie lo note. `registrarUsoCupon` devuelve si el
     contador de verdad subió; un false se anota como reserva parcial (queda
     rastro para el equipo) pero JAMÁS voltea la reserva: la cita ya existe y
     el cliente no tiene por qué perderla por nuestra contabilidad. */
  if (ids.length > 0 && cuponCanjeado && cuponCanjeado.maxUsos !== null) {
    const servicio_ = crearClienteServicio();
    if (!servicio_) {
      console.warn(
        `[reservas] cupón ${cuponCanjeado.codigo} usado sin poder contarlo: falta SUPABASE_SERVICE_ROLE_KEY.`
      );
      parcial = true;
    } else {
      const subio = await registrarUsoCupon(servicio_, cuponCanjeado);
      if (!subio) {
        console.warn(
          `[reservas] el contador del cupón ${cuponCanjeado.codigo} no subió (carrera o permisos); el tope puede quedar corrido.`
        );
        parcial = true;
      }
    }
  }

  /* ── Cerrar el trato con la penalización ───────────────────────────────
     Se reclamó al principio para poder cobrarla en el precio. Ahora se
     decide su destino:

     · Si quedó al menos una cita, se la deja apuntando a ella
       (`consumida_en_sesion_id`). Sin ese vínculo la penalización dice
       "consumida" y nadie puede reconstruir en qué cita se cobró — que es
       exactamente lo que un cliente pregunta cuando reclama.
     · Si NO quedó ninguna cita, se libera. Quedarse con el recargo de una
       reserva que nunca existió sería cobrar por nada.

     Ninguna de las dos cosas voltea la respuesta: la cita ya está creada y
     el cliente no tiene por qué perderla por nuestra contabilidad. Pero un
     fallo acá se anota como reserva parcial, para que el equipo lo vea. */
  if (penalizacionId && clienteServicio) {
    if (ids.length > 0) {
      const { data: vinculada, error: errVinc } = await clienteServicio.rpc(
        "vincular_penalizacion",
        { p_id: penalizacionId, p_sesion_id: ids[0] }
      );
      if (errVinc || vinculada !== true) {
        console.warn(
          `[reservas] la penalización ${penalizacionId} se cobró pero no quedó vinculada a la cita ${ids[0]}.`,
          errVinc?.message ?? ""
        );
        parcial = true;
      }
    } else {
      const { error: errLib } = await clienteServicio.rpc("liberar_penalizacion", {
        p_id: penalizacionId,
      });
      if (errLib) {
        /* Es el peor caso de los tres: el cliente quedó con una penalización
           marcada como consumida sin ninguna cita detrás, así que la próxima
           vez NO se le cobrará lo que debía. Se registra con el id para poder
           repararlo a mano. */
        console.error(
          `[reservas] la penalización ${penalizacionId} quedó consumida sin cita y no se pudo liberar:`,
          errLib.message
        );
      }
      recargoPendientePct = 0;
    }
  }

  return NextResponse.json(
    { success: true, data: { ids, parcial, recargoPendientePct } },
    { status: 201 }
  );
}

/** El origen público del sitio, para armar enlaces que se abren desde un
    correo o desde WhatsApp.

    Sale de la cabecera de la petición y no de una constante porque el mismo
    código corre en local, en los previews de Vercel y en producción; una URL
    fija haría que los enlaces del correo apunten al lugar equivocado en dos
    de los tres. `x-forwarded-*` es lo que pone el proxy de Vercel. */
function origenDe(request: NextRequest): string {
  const env = process.env.NEXT_PUBLIC_SITE_URL;
  if (env) return env.replace(/\/+$/, "");
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  const proto = request.headers.get("x-forwarded-proto") ?? "https";
  return host ? `${proto}://${host}` : "https://perrustingo.com";
}

/** Devuelve true si algún correo falló. */
async function enviarCorreosDeReserva(d: {
  origen: string;
  ids: string[];
  contacto: { nombre: string; email: string; telefono: string; comuna?: string | null };
  perros: z.infer<typeof perroSchema>[];
  servicio: string;
  inicio: string | null;
  fechaDeseada: string;
}): Promise<boolean> {
  if (!correoConfigurado()) return false;

  const perrosCorreo: PerroCorreo[] = d.ids.map((id, i) => {
    const p = d.perros[i];
    return {
      nombre: p?.ficha?.nombre?.trim() || `Perrito ${i + 1}`,
      raza: p?.ficha?.raza?.trim() || "Sin raza indicada",
      // Rango, nunca cifra exacta: es la misma promesa que hace el sitio.
      precio: typeof p?.precioEstimado === "number" ? formatRangoCLP(p.precioEstimado) : null,
      fotoActual: p?.fotoActualRuta ? `${d.origen}/api/foto/${id}/antes` : null,
      fotoReferencia: p?.fotoReferenciaRuta ? `${d.origen}/api/foto/${id}/referencia` : null,
    };
  });

  const total = d.perros.reduce((acc, p) => acc + (p.precioEstimado ?? 0), 0);
  const datos: DatosCorreo = {
    cliente: d.contacto,
    perros: perrosCorreo,
    servicio: d.servicio,
    cuando: cuandoLegible(d.inicio, d.fechaDeseada),
    totalEstimado: total > 0 ? formatRangoCLP(total) : null,
    urlWhatsApp: urlSeguimiento(d.contacto.nombre, perrosCorreo.map((p) => p.nombre)),
    urlFicha: `${d.origen}/dashboard/citas?cita=${d.ids[0]}`,
  };

  const paraCliente = correoCliente(datos);
  const paraEquipo = correoEquipo(datos);

  const [rc, re] = await Promise.all([
    enviarCorreo({ para: d.contacto.email, asunto: paraCliente.asunto, html: paraCliente.html }),
    enviarCorreo({
      para: CORREO_EQUIPO,
      asunto: paraEquipo.asunto,
      html: paraEquipo.html,
      // Responder el aviso interno escribe al cliente, no al propio salón.
      responderA: d.contacto.email,
    }),
  ]);

  if (!rc.ok) console.error("[reservas] correo al cliente falló:", rc.error);
  if (!re.ok) console.error("[reservas] correo al equipo falló:", re.error);
  return !rc.ok || !re.ok;
}

/** "jueves 30 de julio, 15:00" — o solo el día si no se eligió hora. */
function cuandoLegible(inicio: string | null, fechaDeseada: string): string {
  const base = inicio ?? `${fechaDeseada}T00:00:00${offsetNegocio(fechaDeseada)}`;
  const d = new Date(base);
  if (isNaN(d.getTime())) return fechaDeseada;
  /* La coma que es-CL mete entre el día de la semana y el número ("jueves,
     6 de agosto") sobra cuando después viene otra coma y la hora: quedaba
     "jueves, 6 de agosto, 03:00 p. m.", con tres pausas seguidas. */
  const dia = d
    .toLocaleDateString("es-CL", {
      weekday: "long",
      day: "numeric",
      month: "long",
      timeZone: TZ_NEGOCIO,
    })
    .replace(/^(\p{L}+),\s*/u, "$1 ");
  if (!inicio) return dia;
  /* 24 horas, como el resto del sitio. Con el formato por defecto salía
     "03:00 p. m." en el asunto del correo mientras el selector de la web
     decía "15:00" — el mismo dato escrito de dos maneras confunde al
     cliente que compara. */
  const hora = d.toLocaleTimeString("es-CL", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: TZ_NEGOCIO,
  });
  return `${dia}, ${hora}`;
}

/** El WhatsApp del botón del correo: abre el chat del salón con el cliente
    ya presentado, para que no tenga que explicar quién es. */
function urlSeguimiento(nombre: string, perros: string[]): string | null {
  if (!hayWhatsAppConfigurado()) return null;
  const texto =
    `Hola Perrustingo, soy ${nombre}. Acabo de reservar por el sitio ` +
    `para ${perros.join(" y ")} y quiero confirmar la hora.`;
  return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(texto)}`;
}
