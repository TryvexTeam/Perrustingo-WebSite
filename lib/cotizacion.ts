/* Cotización isomorfa — el MISMO precio en el navegador y en el servidor.
 *
 * POR QUÉ EXISTE (4-ago): el precio se armaba entero en el navegador. El
 * formulario elegía la base del tramo, resolvía el cachorro de raza conocida,
 * el descuento global, la altura y el servicio, y recién entonces llamaba a
 * `calcularEstimado`. `/api/reservas` no repetía nada de eso: recibía
 * `precioEstimado` como un entero cualquiera entre 0 y 500.000 y lo guardaba
 * tal cual en `precio_base`. Un POST a mano con `precioEstimado: 0` quedaba
 * grabado en cero, y nadie se enteraba hasta la puerta.
 *
 * Acá vive ese armado completo, una sola vez, como función pura. La llaman los
 * dos lados. Si mañana cambia una capa, cambia para ambos o para ninguno —que
 * es exactamente la propiedad que faltaba.
 *
 * NO LEE LA BASE DE DATOS. Todo lo configurable (tarifas, tramos, ajustes por
 * tamaño, altura, servicios) entra por parámetro, así que la regla que decide
 * cuánto paga una persona se puede probar sin red y sin navegador.
 *
 * La lectura de esa configuración vive al final del archivo, aparte. Repite
 * las consultas de `lib/tarifas.ts`, `lib/tramosDatos.ts`,
 * `lib/tramosAlturaDatos.ts`, `lib/serviciosPrecio.ts` y `lib/ajustesPrecio.ts`
 * a propósito y no por descuido: esos cinco módulos llevan la directiva
 * `"use client"`, y sus exports, importados desde un route handler, llegan
 * como referencias de cliente que revientan al invocarse en el servidor. Los
 * fallbacks de cada consulta son idénticos a los del módulo espejo.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  AJUSTES_PRECIO_DEFAULT,
  EDAD_CACHORRO_MESES,
  FORM_INITIAL,
  TAMANOS,
  TAMANO_PRECIOS,
  calcularEstimado,
  detectarTamanoPorPeso,
  montoDeAjuste,
  type AjustePrecio,
  type AjustesPrecioConfig,
  type EstimadoVivo,
  type FormData,
  type TamanoKey,
  type TipoAjuste,
  type TipoPelo,
} from "./reserva";
import { CATALOGO_RAZAS } from "./razas";
import { TRAMOS_INICIALES, precioDe, type Tramo } from "./tramos";
import { TRAMOS_ALTURA_INICIALES, ajusteDeAltura, type TramoAltura } from "./tramosAltura";
import { comoAjuste, mejorOferta, type ContextoCliente, type Oferta } from "./ofertas";

/* ── Ajuste por servicio ────────────────────────────────────────────────── */

/** Gemelo estructural de `AjusteServicio` de lib/serviciosPrecio.ts: lo que
    devuelve `useServiciosPrecio()` encaja acá sin conversión. */
export interface AjusteServicio {
  slug: string;
  nombre: string;
  pct: number;
  monto: number;
}

/**
 * El ajuste que aplica un servicio, listo para sumar al desglose.
 *
 * Devuelve `null` cuando no hay nada que cobrar — sin servicio elegido, sin
 * fila configurada, o con todo en 0. Un "+0%" en el desglose le dice al
 * cliente que le cobran algo por su servicio cuando no le cobran nada.
 */
export function ajusteDeServicio(
  servicios: readonly AjusteServicio[],
  slugONombre: string
): AjustePrecio | null {
  if (!slugONombre) return null;

  /* El formulario guarda el NOMBRE del servicio ("Baño completo"), no el slug,
     así que se busca por los dos. Comparar solo por slug dejaría el ajuste sin
     aplicarse nunca, en silencio. */
  const buscado = slugONombre.trim().toLowerCase();
  const s = servicios.find(
    (x) => x.slug.toLowerCase() === buscado || x.nombre.trim().toLowerCase() === buscado
  );

  if (!s) return null;
  if (s.pct === 0 && s.monto === 0) return null;

  return s.monto !== 0
    ? { etiqueta: s.nombre, pct: s.pct, monto: s.monto }
    : { etiqueta: s.nombre, pct: s.pct };
}

/* ── Qué entra al precio ────────────────────────────────────────────────── */

/** Los campos del formulario que MUEVEN el precio, y nada más.
 *
 *  Se declara aparte de `FormData` porque este objeto viaja por la red: el
 *  servidor tiene que poder rearmar el precio sin depender de un snapshot
 *  legible pensado para que lo lea una persona (`detalle_form` guarda el pelo
 *  como "Crespo con motas", no como `crespo_motas`). */
export interface EntradaCotizacion {
  pesoKg: number;
  /** Opcional en el formulario: `null` = no la declararon. */
  alturaCm: number | null;
  contextura: string;
  tipoPelo: string;
  temperamentoGeneral: string;
  /** Nombre de la raza tal cual aparece en el catálogo. */
  raza: string;
  edadMeses: number;
  /** Cuántas zonas declaró como "no se deja" (0–8). */
  zonasSensibles: number;
  /** El servicio elegido para toda la reserva, no por perrito. */
  servicio: string;
}

/** Los ocho campos de zonas sensibles, en el orden del formulario. */
const CAMPOS_ZONA = [
  "conPatitas",
  "conHocico",
  "conUnas",
  "conCola",
  "conBano",
  "conSecador",
  "conMaquina",
  "conTijeras",
] as const;

/** Extrae del formulario lo que mueve el precio. */
export function entradaDeFormulario(d: FormData, servicio: string): EntradaCotizacion {
  const altura = parseFloat(d.alturaCmd);
  return {
    pesoKg: parseFloat(d.pesoKg),
    alturaCm: Number.isFinite(altura) ? altura : null,
    contextura: d.contextura,
    tipoPelo: d.tipoPelo,
    temperamentoGeneral: d.temperamentoGeneral,
    raza: d.raza,
    edadMeses: (parseInt(d.edadAnios) || 0) * 12 + (parseInt(d.edadMeses) || 0),
    zonasSensibles: CAMPOS_ZONA.filter((k) => d[k] === "no_se_deja").length,
    servicio,
  };
}

/** El camino inverso: la entrada rearmada como formulario, para poder seguir
    usando `calcularEstimado` —que es donde vive la composición aditiva— sin
    duplicarla. Las zonas se reponen marcando las N primeras: al cálculo solo
    le importa CUÁNTAS son, nunca cuáles. */
function comoFormulario(e: EntradaCotizacion): FormData {
  const zonas = Object.fromEntries(
    CAMPOS_ZONA.map((k, i) => [k, i < e.zonasSensibles ? "no_se_deja" : ""])
  ) as Pick<FormData, (typeof CAMPOS_ZONA)[number]>;

  return {
    ...FORM_INITIAL,
    ...zonas,
    pesoKg: String(e.pesoKg),
    contextura: e.contextura as FormData["contextura"],
    tipoPelo: e.tipoPelo as FormData["tipoPelo"],
    temperamentoGeneral: e.temperamentoGeneral as FormData["temperamentoGeneral"],
    raza: e.raza,
    servicio: e.servicio,
  };
}

/* ── La configuración con la que se cobra ───────────────────────────────── */

/** Los ajustes generales más la config efectiva de cada tamaño. Gemelo del
    `AjustesPorTamano` de lib/ajustesPrecio.ts, sin los overrides crudos que
    solo necesita el panel. */
export interface AjustesCotizacion {
  general: AjustesPrecioConfig;
  porTamano: Record<TamanoKey, AjustesPrecioConfig>;
}

export interface ConfigCotizacion {
  /** Tabla por tamaño — último respaldo cuando no hay tramos. */
  tarifasBase: Record<TamanoKey, number>;
  tramos: readonly Tramo[];
  tramosAltura: readonly TramoAltura[];
  servicios: readonly AjusteServicio[];
  ajustes: AjustesCotizacion;
}

export interface OpcionesCotizacion {
  /** Cupón u oferta, ya elegido: nunca los dos (ver `elegirDescuentoGlobal`). */
  descuentoGlobal?: AjustePrecio | null;
  /** Recargo que arrastra el cliente por haber cancelado tarde. */
  recargoPenalizacionPct?: number;
}

/** Cómo se le nombra al cliente el recargo arrastrado. Una sola constante para
    que el desglose, el correo y la respuesta de la API digan lo mismo. */
export const ETIQUETA_RECARGO_CANCELACION = "Recargo por cancelación tardía anterior";

/**
 * La base contra la que se COMPARAN dos descuentos.
 *
 * Es el mismo precio que se va a cobrar (el del tramo), no el de la tabla
 * vieja por tamaño: si difieren, un porcentaje se compararía contra una base
 * que el cliente nunca ve.
 */
export function baseDeComparacion(config: ConfigCotizacion, pesoKg: number): number {
  const peso = Number.isFinite(pesoKg) && pesoKg > 0 ? pesoKg : 10;
  return precioDe(config.tramos, peso) ?? config.tarifasBase[detectarTamanoPorPeso(peso)];
}

/**
 * Cupón y oferta NUNCA se acumulan: gana el que más descuenta sobre esta base.
 *
 * Acumularlos puede dejar el precio bajo el costo (PRP-003 F3). Comparar "15%"
 * contra "$5.000" sin una base no significa nada, por eso la base es un
 * parámetro y no un supuesto.
 */
export function elegirDescuentoGlobal(
  cupon: AjustePrecio | null,
  oferta: AjustePrecio | null,
  base: number
): AjustePrecio | null {
  if (cupon && oferta) {
    return Math.abs(montoDeAjuste(cupon, base)) >= Math.abs(montoDeAjuste(oferta, base))
      ? cupon
      : oferta;
  }
  return cupon ?? oferta;
}

/**
 * El precio completo de un perrito. Única fuente de verdad, los dos lados.
 *
 * Devuelve `null` cuando no hay con qué cotizar (peso ausente o fuera de
 * rango): inventar una cifra sería peor que decir que falta el dato.
 */
export function cotizar(
  entrada: EntradaCotizacion,
  config: ConfigCotizacion,
  opciones: OpcionesCotizacion = {}
): EstimadoVivo | null {
  const peso = entrada.pesoKg;
  if (!Number.isFinite(peso) || peso <= 0.4 || peso > 120) return null;

  /* Regla de Rodolfo: el cachorro de raza conocida se cobra por el tamaño que
     va a tener de ADULTO, "bajándole un poquito" con el descuento de cachorro.
     Sin raza en el catálogo no hay adulto que suponer, y manda el peso. */
  const razaJoven =
    entrada.edadMeses > 0 && entrada.edadMeses <= EDAD_CACHORRO_MESES
      ? (CATALOGO_RAZAS.find((r) => r.nombre === entrada.raza) ?? null)
      : null;
  const tamanoAuto = detectarTamanoPorPeso(peso);
  const esCachorroDeOtroTamano = Boolean(razaJoven && razaJoven.tamano !== tamanoAuto);
  const baseCachorro =
    razaJoven && esCachorroDeOtroTamano ? config.tarifasBase[razaJoven.tamano] : null;

  // Los agregados salen del tamaño con el que se COBRA (migración 009), y
  // heredan el general cuando ese tamaño no tiene excepción.
  const tamanoCobrado = razaJoven && esCachorroDeOtroTamano ? razaJoven.tamano : tamanoAuto;
  const cfg = config.ajustes.porTamano[tamanoCobrado] ?? config.ajustes.general;

  const extra: AjustePrecio[] = [];
  if (baseCachorro) extra.push(cfg.descuentoCachorro);
  if (opciones.descuentoGlobal) extra.push(opciones.descuentoGlobal);

  /* Altura (migración 033). Se resuelve acá y no dentro de `calcularEstimado`
     porque depende de los tramos, que vienen de la base. Es opcional: sin
     altura, o con el tramo en 0 %, no se cobra nada. */
  const deAltura = ajusteDeAltura(config.tramosAltura, entrada.alturaCm ?? NaN);
  if (deAltura) extra.push(deAltura);

  // Servicio (migración 035): hasta entonces un spa y un solo-uñas del mismo
  // perro costaban igual.
  const deServicio = ajusteDeServicio(config.servicios, entrada.servicio);
  if (deServicio) extra.push(deServicio);

  /* Recargo arrastrado por cancelar tarde. Entra como un ajuste más, así que
     aparece en el desglose con su nombre: un recargo que el cliente no puede
     ver en la cuenta no es defendible. */
  const recargo = opciones.recargoPenalizacionPct ?? 0;
  if (recargo > 0) {
    extra.push({ etiqueta: ETIQUETA_RECARGO_CANCELACION, pct: recargo });
  }

  /* El orden de los `??` importa:
     1. el tamaño adulto si es cachorro de raza conocida,
     2. si no, el tramo que corresponde a su peso real (migración 032),
     3. si no hay tramos (base caída), la tabla por tamaño. Cobrar de menos es
        mejor que no poder cotizar, pero nunca es la primera opción. */
  const base = baseCachorro ?? precioDe(config.tramos, peso) ?? config.tarifasBase[tamanoAuto];

  return calcularEstimado(comoFormulario(entrada), base, extra, cfg);
}

/** El descuento global que corresponde a este perrito, resuelto de punta a
    punta: elige la mejor oferta vigente para el cliente y la enfrenta al cupón.
    Lo usan el formulario y el endpoint con los mismos argumentos. */
export function descuentoGlobalDe(
  config: ConfigCotizacion,
  pesoKg: number,
  cupon: AjustePrecio | null,
  ofertas: readonly Oferta[],
  ctx: ContextoCliente
): { descuento: AjustePrecio | null; oferta: Oferta | null } {
  const base = baseDeComparacion(config, pesoKg);
  const oferta = mejorOferta([...ofertas], ctx, base);
  return {
    descuento: elegirDescuentoGlobal(cupon, oferta ? comoAjuste(oferta) : null, base),
    oferta,
  };
}

/* ══════════════════════════════════════════════════════════════════════════
   Lectura de la configuración — la parte que sí toca la base
   ══════════════════════════════════════════════════════════════════════════ */

/* El cliente llega genérico: navegador y servidor lo construyen con tipos
   distintos y acá solo se usa `.from()`. Mismo criterio que lib/ofertasDatos. */
type Cliente = SupabaseClient;

interface FilaAjuste {
  categoria: string;
  clave: string;
  etiqueta: string;
  pct: number;
  tipo?: TipoAjuste;
  monto?: number | null;
}

interface FilaOverride {
  categoria: string;
  clave: string;
  tamano: TamanoKey;
  pct: number;
  tipo: TipoAjuste;
  monto: number | null;
}

/** Espejo de `filasAConfig` en lib/ajustesPrecio.ts. */
function filasAConfig(filas: readonly FilaAjuste[]): AjustesPrecioConfig {
  const config: AjustesPrecioConfig = {
    recargosPelo: {},
    recargosTemperamento: {},
    recargosContextura: {},
    pctPorZona: AJUSTES_PRECIO_DEFAULT.pctPorZona,
    maxPctZonas: AJUSTES_PRECIO_DEFAULT.maxPctZonas,
    descuentoCachorro: AJUSTES_PRECIO_DEFAULT.descuentoCachorro,
    descuentoPrimeraCita: AJUSTES_PRECIO_DEFAULT.descuentoPrimeraCita,
  };

  for (const fila of filas) {
    // `monto` solo viaja al dominio cuando el tipo lo declara: una fila con
    // monto residual y tipo 'pct' debe cobrar el porcentaje, no el monto.
    const ajuste: AjustePrecio =
      fila.tipo === "monto" && fila.monto !== null && fila.monto !== undefined
        ? { etiqueta: fila.etiqueta, pct: Number(fila.pct), monto: Number(fila.monto) }
        : { etiqueta: fila.etiqueta, pct: Number(fila.pct) };
    switch (fila.categoria) {
      case "pelo":
        config.recargosPelo[fila.clave as TipoPelo] = ajuste;
        break;
      case "temperamento":
        config.recargosTemperamento[fila.clave] = ajuste;
        break;
      case "contextura":
        config.recargosContextura[fila.clave] = ajuste;
        break;
      case "zona_sensible":
        if (fila.clave === "por_zona") config.pctPorZona = Number(fila.pct);
        if (fila.clave === "tope") config.maxPctZonas = Number(fila.pct);
        break;
      case "cachorro":
        if (fila.clave === "descuento") config.descuentoCachorro = ajuste;
        break;
      case "primera_cita":
        if (fila.clave === "descuento") config.descuentoPrimeraCita = ajuste;
        break;
    }
  }

  return config;
}

/** Espejo de `construirPorTamano` en lib/ajustesPrecio.ts. */
function construirPorTamano(
  filas: readonly FilaAjuste[],
  overrides: readonly FilaOverride[]
): Record<TamanoKey, AjustesPrecioConfig> {
  const resultado = {} as Record<TamanoKey, AjustesPrecioConfig>;
  for (const tamano of TAMANOS) {
    const delTamano = overrides.filter((o) => o.tamano === tamano);
    const filasEfectivas = filas.map((f) => {
      const override = delTamano.find((o) => o.categoria === f.categoria && o.clave === f.clave);
      // La excepción reemplaza el valor Y la forma de cobrarlo.
      return override
        ? { ...f, pct: override.pct, tipo: override.tipo, monto: override.monto }
        : f;
    });
    resultado[tamano] = filasAConfig(filasEfectivas);
  }
  return resultado;
}

const AJUSTES_TODOS_DEFAULT: AjustesCotizacion = {
  general: AJUSTES_PRECIO_DEFAULT,
  porTamano: Object.fromEntries(
    TAMANOS.map((t) => [t, AJUSTES_PRECIO_DEFAULT])
  ) as Record<TamanoKey, AjustesPrecioConfig>,
};

/**
 * Lee de la base todo lo que hace falta para cotizar, en paralelo.
 *
 * Cada fallback es el del módulo espejo, y ninguno inventa un recargo: ante un
 * fallo de red se sostiene el precio base y no se ajusta nada. Cobrarle de más
 * a alguien por una falla nuestra no es una degradación aceptable.
 */
export async function leerConfigCotizacion(supabase: Cliente): Promise<ConfigCotizacion> {
  const [
    resTarifas,
    resTramos,
    resAltura,
    resServicios,
    resAjustes,
    resOverrides,
  ] = await Promise.all([
    supabase.from("tarifas").select("tamano, precio").eq("activo", true),
    supabase
      .from("tramos_precio")
      .select("id, nombre, desde_kg, precio")
      .eq("activo", true)
      .order("desde_kg", { ascending: true }),
    supabase
      .from("tramos_altura")
      .select("id, nombre, desde_cm, pct")
      .eq("activo", true)
      .order("desde_cm", { ascending: true }),
    supabase.from("servicios_precio").select("slug, nombre, pct, monto").eq("activo", true),
    supabase.from("ajustes_precio").select("categoria, clave, etiqueta, pct, tipo, monto"),
    supabase.from("ajustes_precio_tamano").select("categoria, clave, tamano, pct, tipo, monto"),
  ]);

  // ── Tarifas por tamaño ──
  const tarifasBase = { ...TAMANO_PRECIOS };
  for (const fila of (resTarifas.data as { tamano: string; precio: number }[] | null) ?? []) {
    if (fila.tamano in tarifasBase) tarifasBase[fila.tamano as TamanoKey] = Number(fila.precio);
  }

  /* `numeric` llega como string desde PostgREST: convertir, no asumir. Sin el
     `Number(...)` la comparación `pesoKg >= t.desdeKg` compararía número contra
     texto y el orden saldría alfabético — "10" antes que "3". */
  const filasTramos =
    (resTramos.data as
      | { id: string; nombre: string; desde_kg: number | string; precio: number | string }[]
      | null) ?? [];
  const tramos: readonly Tramo[] =
    resTramos.error || filasTramos.length === 0
      ? [...TRAMOS_INICIALES]
      : filasTramos.map((f) => ({
          id: f.id,
          nombre: f.nombre,
          desdeKg: Number(f.desde_kg),
          precio: Number(f.precio),
        }));

  const filasAltura =
    (resAltura.data as
      | { id: string; nombre: string; desde_cm: number | string; pct: number | string }[]
      | null) ?? [];
  const tramosAltura: readonly TramoAltura[] =
    resAltura.error || filasAltura.length === 0
      ? [...TRAMOS_ALTURA_INICIALES]
      : filasAltura.map((f) => ({
          id: f.id,
          nombre: f.nombre,
          desdeCm: Number(f.desde_cm),
          pct: Number(f.pct),
        }));

  const filasServicios =
    (resServicios.data as
      | { slug: string; nombre: string; pct: number | string; monto: number | string }[]
      | null) ?? [];
  const servicios: readonly AjusteServicio[] = resServicios.error
    ? []
    : filasServicios.map((f) => ({
        slug: f.slug,
        nombre: f.nombre,
        pct: Number(f.pct),
        monto: Number(f.monto),
      }));

  const filasAjustes = (resAjustes.data as FilaAjuste[] | null) ?? [];
  const overrides = (resOverrides.data as FilaOverride[] | null) ?? [];

  // Sin datos (base caída o tabla vacía) se cotiza con los valores de fábrica,
  // nunca sin precio.
  const ajustes: AjustesCotizacion =
    filasAjustes.length === 0
      ? AJUSTES_TODOS_DEFAULT
      : {
          general: filasAConfig(filasAjustes),
          porTamano: construirPorTamano(filasAjustes, overrides),
        };

  return { tarifasBase, tramos, tramosAltura, servicios, ajustes };
}
