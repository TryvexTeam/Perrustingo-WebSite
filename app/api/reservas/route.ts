import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { supabaseConfigurado } from "@/lib/citas";
import { offsetNegocio } from "@/lib/agenda";
import { validarContacto } from "@/lib/contacto";
import { evaluarReserva } from "@/lib/disponibilidad";
import { obtenerDisponibilidad, obtenerOcupacion } from "@/lib/disponibilidadDatos";

/* POST /api/reservas v2 — reserva multi-perrito (1-3). Crea UNA sesión
   'pendiente' por perrito; si el usuario está logueado además guarda/actualiza
   la ficha en `perros` y adjunta las fotos en `fotos_sesion`.

   Degradación: si la DB del cliente aún no tiene las migraciones 002/004
   (columnas contacto_* / cupon_*), reintenta con el set mínimo de columnas
   de schema.sql para no perder la solicitud. */

const VENTANA_MS = 10 * 60 * 1000;
const MAX_POR_VENTANA = 8;
const intentos = new Map<string, { count: number; desde: number }>();

function excedeLimite(ip: string): boolean {
  const ahora = Date.now();
  const reg = intentos.get(ip);
  if (!reg || ahora - reg.desde > VENTANA_MS) {
    intentos.set(ip, { count: 1, desde: ahora });
    return false;
  }
  reg.count += 1;
  return reg.count > MAX_POR_VENTANA;
}

const perroSchema = z.object({
  detalle: z.record(z.string(), z.string()),
  precioEstimado: z.number().int().min(0).max(500000).nullable(),
  esManual: z.boolean().optional().default(false),
  fotoActualUrl: z.string().url().nullable().optional().default(null),
  fotoReferenciaUrl: z.string().url().nullable().optional().default(null),
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

  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  if (excedeLimite(ip)) {
    return NextResponse.json(
      { success: false, error: "Demasiadas solicitudes. Intenta en unos minutos." },
      { status: 429 }
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
          foto_url: perro.fotoActualUrl,
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
      perro.fotoActualUrl && { sesion_id: sesionId, tipo: "antes", url: perro.fotoActualUrl },
      perro.fotoReferenciaUrl && {
        sesion_id: sesionId,
        tipo: "referencia",
        url: perro.fotoReferenciaUrl,
        notas: "Referencia de corte elegida por el cliente",
      },
    ].filter(Boolean) as { sesion_id: string; tipo: string; url: string; notas?: string }[];

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
