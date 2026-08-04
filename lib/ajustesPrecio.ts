"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  AJUSTES_PRECIO_DEFAULT,
  TAMANOS,
  type AjustePrecio,
  type AjustesPrecioConfig,
  type TamanoKey,
  type TipoAjuste,
  type TipoPelo,
} from "./reserva";

export type { TipoAjuste };

/* Ajustes de precio dinámicos — antes constantes fijas en lib/reserva.ts,
   ahora viven en la tabla `ajustes_precio` (migración 007). La escritura
   vive en app/dashboard/ajustes-precio/actions.ts (server action, rol
   admin exigido) — este módulo es solo lectura + el hook de consumo.
   Ver [[reference F6]] — mismo patrón que lib/tarifas.ts. */

interface FilaAjuste {
  categoria: string;
  clave: string;
  etiqueta: string;
  pct: number;
  tipo?: TipoAjuste;
  monto?: number | null;
}

/** Fila completa para el editor admin — incluye `activo`, invisible para
    el público (RLS ya filtra activo=true en la lectura pública). */
export interface FilaAjustePrecioAdmin {
  categoria: string;
  clave: string;
  etiqueta: string;
  pct: number;
  activo: boolean;
  tipo: TipoAjuste;
  monto: number | null;
}


/** Trae TODAS las filas (activas e inactivas) — solo funciona con sesión
    admin, la policy `admin_edita_ajustes_precio` lo permite. */
export async function obtenerTodosAjustesPrecio(
  supabase: ReturnType<typeof createClient>
): Promise<FilaAjustePrecioAdmin[]> {
  const { data } = await supabase
    .from("ajustes_precio")
    .select("categoria, clave, etiqueta, pct, activo, tipo, monto")
    .order("categoria")
    .order("clave");
  return (data as FilaAjustePrecioAdmin[]) ?? [];
}

const EVENTO = "perrustingo:ajustes-precio-actualizados";

/** Avisa a los `useAjustesPrecio()` montados en esta pestaña que hay datos nuevos. */
export function notificarAjustesPrecioActualizados(): void {
  window.dispatchEvent(new CustomEvent(EVENTO));
}

function filasAConfig(filas: FilaAjuste[]): AjustesPrecioConfig {
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
        ? { etiqueta: fila.etiqueta, pct: fila.pct, monto: fila.monto }
        : { etiqueta: fila.etiqueta, pct: fila.pct };
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
        if (fila.clave === "por_zona") config.pctPorZona = fila.pct;
        if (fila.clave === "tope") config.maxPctZonas = fila.pct;
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

/* ── Ajustes por tamaño (migración 009) ──────────────────────
   `ajustes_precio_tamano` guarda solo EXCEPCIONES: si un tamaño no tiene
   fila para un ajuste, rige el valor general. Por eso acá no hay defaults
   por tamaño — el default ES el general. */

export interface OverrideTamano {
  categoria: string;
  clave: string;
  tamano: TamanoKey;
  pct: number;
  tipo: TipoAjuste;
  monto: number | null;
}

/** Config general + la config efectiva de cada tamaño. */
export interface AjustesPorTamano {
  general: AjustesPrecioConfig;
  porTamano: Record<TamanoKey, AjustesPrecioConfig>;
  /** Las excepciones crudas — el panel las necesita para saber qué está
      personalizado y qué solo hereda (no es lo mismo un override que
      coincide con el general que no tener override). */
  overrides: OverrideTamano[];
}

function construirPorTamano(
  filas: FilaAjuste[],
  overrides: OverrideTamano[]
): Record<TamanoKey, AjustesPrecioConfig> {
  const resultado = {} as Record<TamanoKey, AjustesPrecioConfig>;
  for (const tamano of TAMANOS) {
    const delTamano = overrides.filter((o) => o.tamano === tamano);
    const filasEfectivas = filas.map((f) => {
      const override = delTamano.find((o) => o.categoria === f.categoria && o.clave === f.clave);
      // La excepción reemplaza el valor Y la forma de cobrarlo: un tamaño
      // puede cobrar en pesos algo que en general es un porcentaje.
      return override
        ? { ...f, pct: override.pct, tipo: override.tipo, monto: override.monto }
        : f;
    });
    resultado[tamano] = filasAConfig(filasEfectivas);
  }
  return resultado;
}

/** Lee ajustes generales + excepciones por tamaño en un solo viaje. */
export async function obtenerAjustesPorTamano(
  supabase: ReturnType<typeof createClient>
): Promise<AjustesPorTamano> {
  const [{ data: generales }, { data: excepciones }] = await Promise.all([
    supabase.from("ajustes_precio").select("categoria, clave, etiqueta, pct, tipo, monto"),
    supabase.from("ajustes_precio_tamano").select("categoria, clave, tamano, pct, tipo, monto"),
  ]);

  const filas = (generales as FilaAjuste[] | null) ?? [];
  const overrides = (excepciones as OverrideTamano[] | null) ?? [];

  // Sin datos (DB caída o tabla vacía) el formulario debe seguir cotizando
  // con los valores de fábrica, nunca quedarse sin precio.
  const general = filas.length > 0 ? filasAConfig(filas) : AJUSTES_PRECIO_DEFAULT;
  const porTamano =
    filas.length > 0
      ? construirPorTamano(filas, overrides)
      : (Object.fromEntries(TAMANOS.map((t) => [t, AJUSTES_PRECIO_DEFAULT])) as Record<
          TamanoKey,
          AjustesPrecioConfig
        >);

  return { general, porTamano, overrides };
}

/** Hook: ajustes generales + por tamaño, reactivo a guardados del panel. */
export function useAjustesPorTamano(): AjustesPorTamano {
  const [estado, setEstado] = useState<AjustesPorTamano>(() => ({
    general: AJUSTES_PRECIO_DEFAULT,
    porTamano: Object.fromEntries(TAMANOS.map((t) => [t, AJUSTES_PRECIO_DEFAULT])) as Record<
      TamanoKey,
      AjustesPrecioConfig
    >,
    overrides: [],
  }));

  useEffect(() => {
    let cancelado = false;
    const supabase = createClient();

    const cargar = () => {
      obtenerAjustesPorTamano(supabase).then((a) => {
        if (!cancelado) setEstado(a);
      });
    };

    cargar();
    window.addEventListener(EVENTO, cargar);
    return () => {
      cancelado = true;
      window.removeEventListener(EVENTO, cargar);
    };
  }, []);

  return estado;
}

/** Lee la config vigente desde Supabase (tabla pública, RLS deja SELECT libre). */
export async function obtenerAjustesPrecio(
  supabase: ReturnType<typeof createClient>
): Promise<AjustesPrecioConfig> {
  const { data } = await supabase
    .from("ajustes_precio")
    .select("categoria, clave, etiqueta, pct");
  if (!data) return AJUSTES_PRECIO_DEFAULT;
  return filasAConfig(data as FilaAjuste[]);
}

/** Hook: ajustes vigentes, reactivo a guardados del panel admin (misma pestaña). */
export function useAjustesPrecio(): AjustesPrecioConfig {
  const [config, setConfig] = useState<AjustesPrecioConfig>(AJUSTES_PRECIO_DEFAULT);

  useEffect(() => {
    let cancelado = false;
    const supabase = createClient();

    const cargar = () => {
      obtenerAjustesPrecio(supabase).then((c) => {
        if (!cancelado) setConfig(c);
      });
    };

    cargar();
    window.addEventListener(EVENTO, cargar);
    return () => {
      cancelado = true;
      window.removeEventListener(EVENTO, cargar);
    };
  }, []);

  return config;
}
