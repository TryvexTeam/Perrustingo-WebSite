import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";
import { SERVICIOS_PAGINA } from "@/lib/servicios";

/* Lo que Google debe conocer del sitio. Faltaban dos páginas que importan
   más que las políticas: la de reservar —que es donde termina el cliente
   que buscó "peluquería canina Renca"— y el calendario. */
export default function sitemap(): MetadataRoute.Sitemap {
  const ahora = new Date();
  return [
    {
      url: SITE_URL,
      lastModified: ahora,
      changeFrequency: "weekly",
      priority: 1,
    },
    {
      url: `${SITE_URL}/reserva`,
      lastModified: ahora,
      changeFrequency: "weekly",
      priority: 0.9,
    },
    {
      url: `${SITE_URL}/agenda`,
      lastModified: ahora,
      changeFrequency: "daily",
      priority: 0.7,
    },
    /* Una entrada por servicio. Son las paginas que compiten por "bano y
       corte para perros en Renca" y compania: si no estan aca, Google
       depende de encontrarlas por enlaces y tarda mucho mas. */
    ...SERVICIOS_PAGINA.map((s) => ({
      url: `${SITE_URL}/servicios/${s.slug}`,
      lastModified: ahora,
      changeFrequency: "monthly" as const,
      priority: 0.8,
    })),
    {
      url: `${SITE_URL}/politicas`,
      lastModified: ahora,
      changeFrequency: "monthly",
      priority: 0.3,
    },
  ];
}
