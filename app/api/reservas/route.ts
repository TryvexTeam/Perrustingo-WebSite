import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { supabaseConfigurado } from "@/lib/citas";
import { offsetNegocio } from "@/lib/agenda";
import { normalizarTelefono, validarContacto } from "@/lib/contacto";
import {
  consumir,
  ipDe,
  textoEspera,
  LIMITE_RESERVA_IP,
  LIMITE_RESERVA_TELEFONO,
} from "@/lib/rateLimit";
import { evaluarReserva } from "@/lib/disponibilidad";
import { obtenerDisponibilidad, obtenerOcupacion } from "@/lib/disponibilidadDatos";

/* POST /api/reservas v2 — reserva multi-perrito (1-3). Crea UNA sesión
   'pendiente' por perrito; si el usuario está logueado además guarda/actualiza
   la ficha en `perros` y adjunta las fotos en `fotos_sesion`.

   Degradación: si la DB del cliente aún no tiene las migraciones 002/004
   (columnas contacto_* / cupon_*), reintenta con el set mínimo de columnas
   de schema.sql para no perder la solicitud. */

const perroSchema = z.object({
  detalle: z.record(z.string(), z.string()),
  precioEstimado: z.number().int().min(0).max(500000).nullable(),
  esManual: z.boolean().optional().default(false),
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

  /* Puerta de disponibilidad (PRP-001 Fase 5). El formulario ya no ofrece
     horarios imposibles, pero esto es un POST público: quien mande el
     cuerpo a mano se salta la UI entera. La decisión se toma con el MISMO
     motor que usa el formulario, así que no pueden discrepar. */
  if (inicio) {
    const { config, tramos, capacidad } = await obtenerDisponibilidad(supabase);
    const dia = new Date(inicio);
    const finDia = new Date(dia.getTime() + 24 * 60 * 60 * 1000);
    const ocupacion = await obtenerOcupacion(
      supabase,
      new Date(dia.getTime() - 24 * 60 * 60 * 1000).toISOString(),
      finDia.toISOString()
    );

    const veredicto = evaluarReserva({
      fecha: fechaDeseada,
      inicio,
      tramos,
      config,
      capacidad,
      ocupacion,
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

  const ids: string[] = [];
  let parcial = false;

  for (const [i, perro] of perros.entries()) {
    /* Ficha del perrito (solo logueado; el registro es obligatorio en el
       flujo nuevo, pero la API tolera anónimo por compatibilidad). */
    let perroId: string | null = null;
    if (user && perro.ficha?.nombre) {
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

    const filaCompleta: FilaSesion = {
      id: sesionIdGenerado,
      estado: "pendiente",
      cliente_id: user?.id ?? null,
      perro_id: perroId,
      fecha_cita: inicio ?? `${fechaDeseada}T00:00:00${offsetNegocio(fechaDeseada)}`,
      servicio,
      precio_base: perro.precioEstimado,
      contacto_nombre: contacto.nombre,
      contacto_email: contacto.email,
      contacto_telefono: contacto.telefono,
      contacto_comuna: contacto.comuna || null,
      oferta_id: ofertaId,
      detalle_form: perro.detalle,
      cupon_codigo: cupon?.codigo ?? null,
      descuento_pct: cupon?.pct ?? 0,
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
          precio_base: perro.precioEstimado,
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

  return NextResponse.json(
    { success: true, data: { ids, parcial } },
    { status: 201 }
  );
}
