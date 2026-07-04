"use client";

import { useEffect, useState } from "react";
import { TAMANO_PRECIOS, type TamanoKey } from "./reserva";

/* Tarifas dinámicas — maqueta del flujo admin→landing sin base de datos:
   el panel del admin guarda los precios en localStorage y los templates
   públicos (sección Precios, formulario) los leen en el cliente. Cuando exista
   Supabase, este módulo cambia localStorage por una tabla `tarifas` y el resto
   de la UI no se toca. */

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

const STORAGE_KEY = "perrustingo:tarifas";
const EVENTO = "perrustingo:tarifas-actualizadas";

export function leerTarifas(): Tarifas {
  if (typeof window === "undefined") return TARIFAS_DEFAULT;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return TARIFAS_DEFAULT;
    const parsed = JSON.parse(raw) as Partial<Tarifas>;
    return {
      base: { ...TARIFAS_DEFAULT.base, ...parsed.base },
      recargoMotas: parsed.recargoMotas ?? TARIFAS_DEFAULT.recargoMotas,
      accesorio: parsed.accesorio ?? TARIFAS_DEFAULT.accesorio,
    };
  } catch {
    return TARIFAS_DEFAULT;
  }
}

export function guardarTarifas(tarifas: Tarifas): void {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(tarifas));
  window.dispatchEvent(new CustomEvent(EVENTO));
}

export function restaurarTarifas(): void {
  window.localStorage.removeItem(STORAGE_KEY);
  window.dispatchEvent(new CustomEvent(EVENTO));
}

/** Hook: tarifas vigentes, reactivo a cambios del panel admin (misma pestaña u otra). */
export function useTarifas(): Tarifas {
  const [tarifas, setTarifas] = useState<Tarifas>(TARIFAS_DEFAULT);

  useEffect(() => {
    const sync = () => setTarifas(leerTarifas());
    sync();
    window.addEventListener(EVENTO, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(EVENTO, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  return tarifas;
}
