import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

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
    {
      url: `${SITE_URL}/politicas`,
      lastModified: ahora,
      changeFrequency: "monthly",
      priority: 0.3,
    },
  ];
}
