"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { TAMANO_PRECIOS, type TamanoKey } from "./reserva";

/* Tarifas dinámicas — antes vivían en localStorage (maqueta sin DB: un
   cambio del admin solo se veía en el navegador donde lo hizo). Ahora se
   leen/escriben en las tablas `tarifas` + `tarifas_extras` de Supabase, así
   que se ven desde cualquier dispositivo/sesión. Ver migración 006. La
   escritura vive en app/dashboard/tarifas/actions.ts (server action, rol
   admin exigido) — este módulo es solo lectura + el hook de consumo. */

export interface Tarifas {
  base: Record<TamanoKey, number>;
  /** Recargo porcentual por pelo con motas/nudos severos */
  recargoMotas: number;
  /** Precio de accesorio/pinches opcional */
  accesorio: number;
}

export const TARIFAS_DEFAULT: Tarifas = {
  base: { ...TAMANO_PRECIOS },
  recargoMotas: 20,
  accesorio: 3000,
};

const EVENTO = "perrustingo:tarifas-actualizadas";

/** Avisa a los `useTarifas()` montados en esta pestaña que hay datos nuevos. */
export function notificarTarifasActualizadas(): void {
  window.dispatchEvent(new CustomEvent(EVENTO));
}

/** Lee el estado vigente desde Supabase (tabla pública, RLS deja SELECT libre). */
export async function obtenerTarifas(
  supabase: ReturnType<typeof createClient>
): Promise<Tarifas> {
  const [{ data: filasBase }, { data: extras }] = await Promise.all([
    supabase.from("tarifas").select("tamano, precio").eq("activo", true),
    supabase
      .from("tarifas_extras")
      .select("recargo_motas_pct, precio_accesorio")
      .eq("singleton", true)
      .maybeSingle(),
  ]);

  const base = { ...TARIFAS_DEFAULT.base };
  for (const fila of filasBase ?? []) {
    if (fila.tamano in base) {
      base[fila.tamano as TamanoKey] = fila.precio;
    }
  }

  return {
    base,
    recargoMotas: extras?.recargo_motas_pct ?? TARIFAS_DEFAULT.recargoMotas,
    accesorio: extras?.precio_accesorio ?? TARIFAS_DEFAULT.accesorio,
  };
}

/** Hook: tarifas vigentes, reactivo a guardados del panel admin (misma pestaña u otra). */
export function useTarifas(): Tarifas {
  const [tarifas, setTarifas] = useState<Tarifas>(TARIFAS_DEFAULT);

  useEffect(() => {
    let cancelado = false;
    const supabase = createClient();

    const cargar = () => {
      obtenerTarifas(supabase).then((t) => {
        if (!cancelado) setTarifas(t);
      });
    };

    cargar();
    window.addEventListener(EVENTO, cargar);
    return () => {
      cancelado = true;
      window.removeEventListener(EVENTO, cargar);
    };
  }, []);

  return tarifas;
}
