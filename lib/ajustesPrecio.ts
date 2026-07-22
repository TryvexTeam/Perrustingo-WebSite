"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { AJUSTES_PRECIO_DEFAULT, type AjustesPrecioConfig, type TipoPelo } from "./reserva";

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
}

/** Fila completa para el editor admin — incluye `activo`, invisible para
    el público (RLS ya filtra activo=true en la lectura pública). */
export interface FilaAjustePrecioAdmin {
  categoria: string;
  clave: string;
  etiqueta: string;
  pct: number;
  activo: boolean;
}

/** Trae TODAS las filas (activas e inactivas) — solo funciona con sesión
    admin, la policy `admin_edita_ajustes_precio` lo permite. */
export async function obtenerTodosAjustesPrecio(
  supabase: ReturnType<typeof createClient>
): Promise<FilaAjustePrecioAdmin[]> {
  const { data } = await supabase
    .from("ajustes_precio")
    .select("categoria, clave, etiqueta, pct, activo")
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
    pctPorZona: AJUSTES_PRECIO_DEFAULT.pctPorZona,
    maxPctZonas: AJUSTES_PRECIO_DEFAULT.maxPctZonas,
    descuentoCachorro: AJUSTES_PRECIO_DEFAULT.descuentoCachorro,
    descuentoPrimeraCita: AJUSTES_PRECIO_DEFAULT.descuentoPrimeraCita,
  };

  for (const fila of filas) {
    const ajuste = { etiqueta: fila.etiqueta, pct: fila.pct };
    switch (fila.categoria) {
      case "pelo":
        config.recargosPelo[fila.clave as TipoPelo] = ajuste;
        break;
      case "temperamento":
        config.recargosTemperamento[fila.clave] = ajuste;
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
