import type { TamanoKey } from "./reserva";

/* Catálogo de razas — compartido por la guía de tamaños (landing) y el
   formulario de reserva. Cada raza tiene un slug que apunta a su render 3D
   en /public/razas/<slug>.png; si el archivo aún no existe, la UI cae a un
   avatar SVG con la inicial. */

export interface Raza {
  nombre: string;
  slug: string;
  tamano: TamanoKey;
}

export const CATALOGO_RAZAS: Raza[] = [
  // Mini / Toy — hasta 5 kg
  { nombre: "Chihuahua", slug: "chihuahua", tamano: "toy" },
  { nombre: "Pomerania", slug: "pomerania", tamano: "toy" },
  { nombre: "Yorkshire", slug: "yorkshire", tamano: "toy" },
  { nombre: "Poodle Toy", slug: "poodle-toy", tamano: "toy" },
  { nombre: "Dachshund Miniatura", slug: "dachshund-mini", tamano: "toy" },
  { nombre: "Fox Terrier Pelo Liso", slug: "fox-terrier", tamano: "toy" },
  // Pequeños — 6 a 10 kg
  { nombre: "Bichón Frisé", slug: "bichon-frise", tamano: "pequeno" },
  { nombre: "Shih Tzu", slug: "shih-tzu", tamano: "pequeno" },
  { nombre: "Poodle", slug: "poodle", tamano: "pequeno" },
  { nombre: "Terrier Chileno", slug: "terrier-chileno", tamano: "pequeno" },
  { nombre: "Dachshund", slug: "dachshund", tamano: "pequeno" },
  // Medianos — 11 a 25 kg
  { nombre: "Beagle", slug: "beagle", tamano: "mediano" },
  { nombre: "Cocker Spaniel", slug: "cocker-spaniel", tamano: "mediano" },
  { nombre: "Schnauzer", slug: "schnauzer", tamano: "mediano" },
  { nombre: "Bulldog Francés", slug: "bulldog-frances", tamano: "mediano" },
  { nombre: "Dogo Chileno", slug: "dogo-chileno", tamano: "mediano" },
  // Grandes — 26 a 45 kg
  { nombre: "Golden Retriever", slug: "golden-retriever", tamano: "grande" },
  { nombre: "Labrador", slug: "labrador", tamano: "grande" },
  { nombre: "Pastor Alemán", slug: "pastor-aleman", tamano: "grande" },
  { nombre: "Pastor Inglés", slug: "pastor-ingles", tamano: "grande" },
  { nombre: "Samoyedo", slug: "samoyedo", tamano: "grande" },
  { nombre: "Ovejero Magallánico", slug: "ovejero-magallanico", tamano: "grande" },
  // Gigantes — más de 45 kg
  { nombre: "San Bernardo", slug: "san-bernardo", tamano: "gigante" },
  { nombre: "Terranova", slug: "terranova", tamano: "gigante" },
  { nombre: "Mestizo / Quiltro", slug: "quiltro", tamano: "gigante" },
];

export function razasPorTamano(tamano: TamanoKey): Raza[] {
  return CATALOGO_RAZAS.filter((r) => r.tamano === tamano);
}

export function razaImagen(slug: string): string {
  return `/razas/${slug}.png`;
}

/* Render representativo de cada grupo de tamaño — usado en el selector del
   formulario. Archivos esperados en /public/razas/tamanos/. */
export const TAMANO_IMAGEN: Record<TamanoKey, string> = {
  toy: "/razas/tamanos/toy.png",
  pequeno: "/razas/tamanos/pequeno.png",
  mediano: "/razas/tamanos/mediano.png",
  grande: "/razas/tamanos/grande.png",
  gigante: "/razas/tamanos/gigante.png",
};
