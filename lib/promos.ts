/* Anuncios de la landing — el admin decide qué promo aparece en cada
   posición intermedia (o la oculta), con qué imagen y en qué orden.

   Antes esto vivía en `localStorage`: cada navegador veía una distribución
   distinta, así que un cambio hecho en el teléfono no llegaba ni al
   computador del local ni a los clientes. Ahora vive en la tabla `promos`
   (migración 011) y se lee desde el servidor, así que sale ya en el HTML.

   Sin directiva de cliente a propósito: estos tipos los usan tanto los
   server components y actions como el editor del panel. */

export type PromoSlot =
  | "tras-servicios"
  | "tras-resenas"
  | "tras-tamanos"
  | "pre-footer"
  | "oculto";

export const SLOTS: readonly PromoSlot[] = [
  "tras-servicios",
  "tras-resenas",
  "tras-tamanos",
  "pre-footer",
  "oculto",
] as const;

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
  /** Relación de aspecto del arte — controla el ancho máximo del banner. */
  vertical: boolean;
  slot: PromoSlot;
  /** Posición dentro de su slot cuando hay más de un anuncio. */
  orden: number;
}

/** Los 4 anuncios originales, hoy semilla de la tabla (migración 011).
    Se mantienen acá como último recurso: si la base no responde, la landing
    muestra los anuncios de siempre en vez de un hueco. */
export const PROMOS_DEFAULT: Promo[] = [
  {
    id: "retiro-entrega",
    nombre: "Retiro y entrega (próximamente)",
    img: "/promos/retiro-entrega.png",
    alt: "Próximamente: servicio de retiro y entrega — vamos por tu peludito, lo consentimos y te lo devolvemos. Seguro, puntual, confiable, fácil y rápido por WhatsApp.",
    vertical: true,
    slot: "oculto",
    orden: 0,
  },
  {
    id: "internacional",
    nombre: "Brasil y Alemania (próximamente)",
    img: "/promos/internacional.png",
    alt: "Próximamente Perrustingo internacional: Brasil (em breve) y Alemania (bald verfügbar) — nuevos destinos, el mismo amor.",
    vertical: false,
    slot: "tras-resenas",
    orden: 0,
  },
  {
    id: "domicilio",
    nombre: "Perrustingo a domicilio (próximamente)",
    img: "/promos/domicilio.png",
    alt: "Próximamente: Perrustingo a domicilio — el spa canino hasta tu casa.",
    vertical: true,
    slot: "tras-servicios",
    orden: 0,
  },
  {
    id: "recomendaciones",
    nombre: "Recomendaciones de cuidado",
    img: "/promos/recomendaciones.png",
    alt: "Próximamente: recomendaciones — consejos, productos y rutinas de cuidado canino.",
    vertical: true,
    slot: "tras-servicios",
    orden: 1,
  },
];

export function esSlot(valor: string): valor is PromoSlot {
  return (SLOTS as readonly string[]).includes(valor);
}

/** Convierte un nombre en un id estable para un anuncio nuevo. */
export function idDesdeNombre(nombre: string): string {
  const base = nombre
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  // El sufijo evita chocar con un anuncio borrado y recreado con el mismo
  // nombre, cuyas imágenes viejas seguirían en Storage.
  return `${base || "anuncio"}-${Date.now().toString(36)}`;
}

const LARGO_NOMBRE = 80;
const LARGO_ALT = 300;

/** Misma validación que el server action, para no mandar viajes perdidos. */
export function validarPromo(promo: Pick<Promo, "nombre" | "alt" | "img" | "slot">): string | null {
  if (promo.nombre.trim().length === 0) return "El anuncio necesita un nombre.";
  if (promo.nombre.length > LARGO_NOMBRE) return "El nombre es demasiado largo.";
  if (promo.alt.trim().length === 0) {
    return "Escriba el texto alternativo: es lo que lee quien no puede ver la imagen.";
  }
  if (promo.alt.length > LARGO_ALT) return "El texto alternativo es demasiado largo.";
  if (promo.img.trim().length === 0) return "El anuncio necesita una imagen.";
  if (!esSlot(promo.slot)) return "Posición inválida.";
  return null;
}
