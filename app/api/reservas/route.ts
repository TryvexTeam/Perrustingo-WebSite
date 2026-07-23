import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { supabaseConfigurado } from "@/lib/citas";
import { TAMANO_PRECIOS } from "@/lib/reserva";

/* POST /api/reservas v2 — reserva multi-perrito (1-3). Crea UNA sesión
   'pendiente' por perrito; si el usuario está logueado además guarda/actualiza
   la ficha en `perros` y adjunta las fotos en `fotos_sesion`.

   Degradación: si la DB del cliente aún no tiene alguna migración (columna
   inexistente, 42703), se saca SOLO esa columna y se reintenta — nunca se
   descarta contacto/detalle_form/cupón de un tirón (bug encontrado por
   Jarvis 22-jul: la degradación anterior perdía todo con cualquier error).

   Snapshot de precio (F007, hallazgo de seguridad de Ariel/Jarvis): el
   precio NUNCA se toma tal cual del cliente. El % de cada ajuste se busca
   en `ajustes_precio` por (categoria, clave) — el cliente solo aporta CUÁLES
   aplicaron, nunca CUÁNTO valen. La base se valida contra `tarifas`. El
   cupón/descuento de primera cita se valida contra `cupones`/`ajustes_precio`
   por código, nunca por el pct que mande el navegador. El total final se
   recalcula servidor y es el que se congela en `sesiones.desglose_precio`. */

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

/** Redondeo comercial a la centena — idéntico a `lib/reserva.ts:redondear`,
    duplicado porque esa función no está exportada (uso interno del módulo). */
function redondear(n: number): number {
  return Math.round(n / 100) * 100;
}

/** Lo que manda el cliente por cada ajuste: solo la identidad (categoria+clave)
    para los que salen de `ajustes_precio`, o ninguna para el cupón/primera
    cita (ese se valida aparte, contra el objeto `cupon` de nivel superior).
    pct/etiqueta viajan igual (se muestran mientras carga la validación) pero
    el servidor los IGNORA por completo si hay categoria+clave. */
const ajusteLineaSchema = z.object({
  etiqueta: z.string().trim().max(80),
  pct: z.number(),
  categoria: z.string().trim().max(30).optional(),
  clave: z.string().trim().max(40).optional(),
  cantidad: z.number().int().min(0).max(20).optional(),
});

const perroSchema = z.object({
  detalle: z.record(z.string(), z.string()),
  precioEstimado: z.number().int().min(0).max(500000).nullable(),
  /** Desglose completo calculado en el cliente — solo para saber QUÉ ajustes
      aplicaron (por clave). El servidor recalcula pct/base/total desde cero;
      esto nunca se guarda tal cual. */
  estimado: z
    .object({
      base: z.number().int().min(0).max(500000),
      ajustes: z.array(ajusteLineaSchema).max(20),
    })
    .nullable()
    .optional()
    .default(null),
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
      .regex(/^\+?[\d\s]{8,15}$/, "Teléfono inválido"),
    telefonoFijo: z
      .string()
      .trim()
      .regex(/^\+?[\d\s]{8,15}$/, "Teléfono inválido")
      .nullable()
      .optional()
      .default(null),
  }),
  fechaDeseada: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  servicio: z.string().trim().min(3).max(80),
  cupon: z
    .object({
      codigo: z.string().trim().max(40),
      pct: z.number().int().min(1).max(50),
    })
    .nullable()
    .optional()
    .default(null),
  perros: z.array(perroSchema).min(1).max(3),
  /** Honeypot anti-spam: los humanos lo dejan vacío. */
  apellidoPaterno: z.string().max(0).optional(),
});

interface FilaSesion {
  [key: string]: unknown;
}

interface LineaDesglose {
  categoria?: string;
  clave?: string;
  etiqueta: string;
  pct: number;
  cantidad?: number;
}

interface DesglosePrecio {
  version: 1;
  base: number;
  lineas: LineaDesglose[];
  pct_total: number;
  total: number;
}

/** Catálogo vigente de ajustes, indexado por "categoria:clave" — lo que se
    lee acá es lo único en lo que se confía para pct/etiqueta. */
async function cargarCatalogoAjustes(
  supabase: Awaited<ReturnType<typeof createClient>>
): Promise<Map<string, { etiqueta: string; pct: number }>> {
  const { data } = await supabase
    .from("ajustes_precio")
    .select("categoria, clave, etiqueta, pct")
    .eq("activo", true);
  const mapa = new Map<string, { etiqueta: string; pct: number }>();
  for (const fila of data ?? []) {
    mapa.set(`${fila.categoria}:${fila.clave}`, { etiqueta: fila.etiqueta, pct: fila.pct });
  }
  return mapa;
}

/** Precios base vigentes por tamaño — set de valores válidos para no confiar
    en la `base` que manda el cliente sin más (bypass del form podría mandar
    cualquier número). */
async function cargarBasesValidas(
  supabase: Awaited<ReturnType<typeof createClient>>
): Promise<Set<number>> {
  const { data } = await supabase
    .from("tarifas")
    .select("precio")
    .eq("activo", true);
  const set = new Set<number>(Object.values(TAMANO_PRECIOS));
  for (const fila of data ?? []) set.add(fila.precio);
  return set;
}

/** Valida el cupón/descuento contra la fuente de verdad — nunca contra el
    pct que mandó el cliente. "PRIMERA_CITA" es el código sintético que usa
    el form para el descuento por cuenta nueva (no es una fila de `cupones`,
    vive en `ajustes_precio` categoria=primera_cita). Cualquier otro código
    se busca en `cupones` activo=true. Sin match → sin descuento. */
async function validarCupon(
  supabase: Awaited<ReturnType<typeof createClient>>,
  cupon: { codigo: string; pct: number } | null,
  catalogoAjustes: Map<string, { etiqueta: string; pct: number }>
): Promise<{ codigo: string; etiqueta: string; pct: number } | null> {
  if (!cupon) return null;

  if (cupon.codigo === "PRIMERA_CITA") {
    const ajuste = catalogoAjustes.get("primera_cita:descuento");
    if (!ajuste) return null;
    return { codigo: cupon.codigo, etiqueta: ajuste.etiqueta, pct: ajuste.pct };
  }

  const { data } = await supabase
    .from("cupones")
    .select("codigo, descripcion, descuento_pct")
    .eq("codigo", cupon.codigo)
    .eq("activo", true)
    .maybeSingle();
  if (!data) return null;
  return {
    codigo: data.codigo,
    etiqueta: data.descripcion ?? data.codigo,
    pct: -Math.abs(data.descuento_pct),
  };
}

/** Recalcula el desglose de un perrito desde cero, servidor, ignorando
    cualquier pct/etiqueta/total que haya mandado el cliente. Devuelve null
    si no hay estimado (perrito sin peso válido, p.ej.) — en ese caso se
    guarda sin precio, como antes. */
function calcularDesgloseServer(
  estimadoCliente: { base: number; ajustes: { etiqueta: string; pct: number; categoria?: string; clave?: string; cantidad?: number }[] } | null,
  basesValidas: Set<number>,
  catalogoAjustes: Map<string, { etiqueta: string; pct: number }>,
  cuponValidado: { etiqueta: string; pct: number } | null
): DesglosePrecio | null {
  if (!estimadoCliente) return null;

  const base = basesValidas.has(estimadoCliente.base)
    ? estimadoCliente.base
    : null;
  if (base === null) return null;

  const lineas: LineaDesglose[] = [];
  for (const linea of estimadoCliente.ajustes) {
    if (linea.categoria && linea.clave) {
      const real = catalogoAjustes.get(`${linea.categoria}:${linea.clave}`);
      if (!real) continue; // clave desactivada/inexistente → se descarta, no se inventa
      lineas.push({
        categoria: linea.categoria,
        clave: linea.clave,
        etiqueta: real.etiqueta,
        pct: real.pct,
        cantidad: linea.cantidad,
      });
    }
    // Sin categoria/clave = línea ad-hoc (cupón/primera cita). Esa la agrega
    // el llamador aparte con `cuponValidado`, así que acá se ignora — nunca
    // se confía en un pct sin identidad verificable contra un catálogo.
  }

  if (cuponValidado) {
    lineas.push({ etiqueta: cuponValidado.etiqueta, pct: cuponValidado.pct });
  }

  const pctTotal = lineas.reduce((acc, l) => acc + l.pct, 0);
  const total = redondear(base * (1 + pctTotal / 100));

  return { version: 1, base, lineas, pct_total: pctTotal, total };
}

/** Inserta degradando de a UNA columna por vez si Postgres devuelve 42703
    (columna inexistente — migración pendiente en la DB del cliente). Antes
    esto tiraba todo el detalle/contacto/cupón a la basura con cualquier
    error; ahora solo saca la columna que realmente falta. Si después de
    varios intentos sigue fallando por otra causa, cae al set mínimo de
    schema.sql (nunca se pierde la solicitud). */
async function insertarConDegradacion(
  supabase: Awaited<ReturnType<typeof createClient>>,
  filaCompleta: FilaSesion,
  filaMinima: FilaSesion
): Promise<{ id: string | null; parcial: boolean }> {
  const intento: FilaSesion = { ...filaCompleta };

  for (let i = 0; i < 8; i++) {
    const { data, error } = await supabase
      .from("sesiones")
      .insert(intento)
      .select("id")
      .single();

    if (!error) return { id: data?.id ?? null, parcial: i > 0 };

    if (error.code !== "42703") break;
    const match = /column "([^"]+)"/.exec(error.message ?? "");
    const columna = match?.[1];
    if (!columna || !(columna in intento)) break;
    delete intento[columna];
  }

  const { data: filaMin } = await supabase
    .from("sesiones")
    .insert(filaMinima)
    .select("id")
    .single();
  return { id: filaMin?.id ?? null, parcial: true };
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

  const { contacto, fechaDeseada, servicio, cupon, perros } = parsed.data;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Catálogos de verdad para el precio — se leen UNA vez por request, nunca
  // se confía en lo que mande el cliente para pct/base/total.
  const [catalogoAjustes, basesValidas] = await Promise.all([
    cargarCatalogoAjustes(supabase),
    cargarBasesValidas(supabase),
  ]);
  const cuponValidado = await validarCupon(supabase, cupon, catalogoAjustes);

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

    const desglose = calcularDesgloseServer(
      perro.estimado,
      basesValidas,
      catalogoAjustes,
      cuponValidado
    );
    // precio_base = LA BASE real (antes guardaba el total del cliente por
    // error — Jarvis 22-jul). El total recalculado vive en el desglose;
    // precio_final lo llena el equipo en la puerta, como siempre.
    const precioBaseGuardado = desglose ? desglose.base : perro.precioEstimado;

    const filaCompleta: FilaSesion = {
      estado: "pendiente",
      cliente_id: user?.id ?? null,
      perro_id: perroId,
      fecha_cita: `${fechaDeseada}T00:00:00-04:00`,
      servicio,
      precio_base: precioBaseGuardado,
      desglose_precio: desglose,
      contacto_nombre: contacto.nombre,
      contacto_email: contacto.email,
      contacto_telefono: contacto.telefono,
      contacto_telefono_movil: contacto.telefono,
      contacto_telefono_fijo: contacto.telefonoFijo,
      detalle_form: perro.detalle,
      cupon_codigo: cuponValidado?.codigo ?? null,
      descuento_pct: cuponValidado ? Math.abs(cuponValidado.pct) : 0,
    };

    const filaMinima: FilaSesion = {
      estado: "pendiente",
      cliente_id: user?.id ?? null,
      perro_id: perroId,
      fecha_cita: `${fechaDeseada}T00:00:00-04:00`,
      servicio,
      precio_base: precioBaseGuardado,
      notas_cliente: `${contacto.nombre} · ${contacto.telefono} · ${contacto.email}`,
    };

    const { id: sesionId, parcial: huboParcial } = await insertarConDegradacion(
      supabase,
      filaCompleta,
      filaMinima
    );
    if (huboParcial) parcial = true;

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
