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
    slot: "oculto",
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
    slot: "tras-servicios",
  },
  {
    id: "recomendaciones",
    nombre: "Recomendaciones de cuidado",
    img: "/promos/recomendaciones.png",
    alt: "Próximamente: recomendaciones — consejos, productos y rutinas de cuidado canino.",
    vertical: true,
    slot: "tras-servicios",
  },
];

const STORAGE_KEY = "perrustingo:promos";
const EVENTO = "perrustingo:promos-actualizadas";

interface PromoGuardada {
  slot: PromoSlot;
  /** Imagen personalizada subida por el admin (URL de Storage o dataURL). */
  img?: string;
}

export function leerPromos(): Promo[] {
  if (typeof window === "undefined") return PROMOS_DEFAULT;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return PROMOS_DEFAULT;
    const guardadas = JSON.parse(raw) as Record<string, PromoSlot | PromoGuardada>;
    return PROMOS_DEFAULT.map((p) => {
      const g = guardadas[p.id];
      if (!g) return p;
      // Formato antiguo: solo el slot como string
      if (typeof g === "string") return { ...p, slot: g };
      return { ...p, slot: g.slot ?? p.slot, img: g.img || p.img };
    });
  } catch {
    return PROMOS_DEFAULT;
  }
}

export function guardarPromos(promos: Promo[]): void {
  const guardadas: Record<string, PromoGuardada> = Object.fromEntries(
    promos.map((p) => {
      const base = PROMOS_DEFAULT.find((d) => d.id === p.id);
      const g: PromoGuardada = { slot: p.slot };
      if (base && p.img !== base.img) g.img = p.img;
      return [p.id, g];
    })
  );
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(guardadas));
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

/* ── Subida de imagen del anuncio ─────────────────────────────
   Con Supabase configurado sube al bucket `promos` (URL pública);
   sin configurar comprime a dataURL y queda en localStorage. */

const MAX_LADO_PX = 900;
const CALIDAD_JPEG = 0.85;

function comprimirADataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new window.Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      const escala = Math.min(1, MAX_LADO_PX / Math.max(img.width, img.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(img.width * escala);
      canvas.height = Math.round(img.height * escala);
      const ctx = canvas.getContext("2d");
      if (!ctx) return reject(new Error("Canvas no disponible"));
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL("image/jpeg", CALIDAD_JPEG));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("No se pudo leer la imagen"));
    };
    img.src = url;
  });
}

export async function subirImagenPromo(promoId: string, file: File): Promise<string> {
  if (!file.type.startsWith("image/")) throw new Error("El archivo debe ser una imagen.");
  if (file.size > 8 * 1024 * 1024) throw new Error("Máximo 8 MB.");

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const configurado = Boolean(url && !url.includes("TU_PROYECTO"));
  if (!configurado) return comprimirADataURL(file);

  const { createClient } = await import("@/lib/supabase/client");
  const supabase = createClient();
  const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
  const ruta = `${promoId}-${Date.now()}.${ext}`;
  const { error } = await supabase.storage.from("promos").upload(ruta, file, {
    cacheControl: "3600",
    upsert: false,
  });
  if (error) throw new Error("No se pudo subir la imagen.");
  const { data } = supabase.storage.from("promos").getPublicUrl(ruta);
  return data.publicUrl;
}
