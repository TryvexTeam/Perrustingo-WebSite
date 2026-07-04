"use client";

import { useEffect, useState } from "react";

/* Anuncios distribuidos — el admin decide qué promo aparece en cada posición
   intermedia de la landing (o la oculta). Persistencia en localStorage hasta
   que exista Supabase; la UI no cambiará al conectar la base de datos. */

export type PromoSlot =
  | "tras-servicios"
  | "tras-resenas"
  | "tras-tamanos"
  | "pre-footer"
  | "oculto";

export const SLOT_LABELS: Record<PromoSlot, string> = {
  "tras-servicios": "Después de Servicios",
  "tras-resenas": "Después de Opiniones",
  "tras-tamanos": "Después de Tamaños y tarifas",
  "pre-footer": "Antes del pie de página",
  oculto: "Oculto (no se muestra)",
};

export interface Promo {
  id: string;
  nombre: string;
  img: string;
  alt: string;
  /** Relación de aspecto del arte — controla el ancho máximo del banner */
  vertical: boolean;
  slot: PromoSlot;
}

export const PROMOS_DEFAULT: Promo[] = [
  {
    id: "retiro-entrega",
    nombre: "Retiro y entrega (próximamente)",
    img: "/promos/retiro-entrega.png",
    alt: "Próximamente: servicio de retiro y entrega — vamos por tu peludito, lo consentimos y te lo devolvemos. Seguro, puntual, confiable, fácil y rápido por WhatsApp.",
    vertical: true,
    slot: "tras-servicios",
  },
  {
    id: "internacional",
    nombre: "Brasil y Alemania (próximamente)",
    img: "/promos/internacional.png",
    alt: "Próximamente Perrustingo internacional: Brasil (em breve) y Alemania (bald verfügbar) — nuevos destinos, el mismo amor.",
    vertical: false,
    slot: "tras-resenas",
  },
  {
    id: "domicilio",
    nombre: "Perrustingo a domicilio (próximamente)",
    img: "/promos/domicilio.png",
    alt: "Próximamente: Perrustingo a domicilio — el spa canino hasta tu casa.",
    vertical: true,
    slot: "tras-tamanos",
  },
  {
    id: "recomendaciones",
    nombre: "Recomendaciones de cuidado",
    img: "/promos/recomendaciones.png",
    alt: "Próximamente: recomendaciones — consejos, productos y rutinas de cuidado canino.",
    vertical: true,
    slot: "pre-footer",
  },
];

const STORAGE_KEY = "perrustingo:promos";
const EVENTO = "perrustingo:promos-actualizadas";

export function leerPromos(): Promo[] {
  if (typeof window === "undefined") return PROMOS_DEFAULT;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return PROMOS_DEFAULT;
    const slots = JSON.parse(raw) as Record<string, PromoSlot>;
    return PROMOS_DEFAULT.map((p) => ({ ...p, slot: slots[p.id] ?? p.slot }));
  } catch {
    return PROMOS_DEFAULT;
  }
}

export function guardarPromos(promos: Promo[]): void {
  const slots = Object.fromEntries(promos.map((p) => [p.id, p.slot]));
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(slots));
  window.dispatchEvent(new CustomEvent(EVENTO));
}

export function restaurarPromos(): void {
  window.localStorage.removeItem(STORAGE_KEY);
  window.dispatchEvent(new CustomEvent(EVENTO));
}

/** Hook reactivo — la landing refleja al instante los cambios del admin. */
export function usePromos(): Promo[] {
  const [promos, setPromos] = useState<Promo[]>(PROMOS_DEFAULT);

  useEffect(() => {
    const sync = () => setPromos(leerPromos());
    sync();
    window.addEventListener(EVENTO, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(EVENTO, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  return promos;
}
