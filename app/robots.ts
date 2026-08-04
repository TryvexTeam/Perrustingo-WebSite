import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      /* El panel y las rutas internas no tienen nada que hacer en un
         buscador: no le sirven a quien busca una peluquería y gastan el
         presupuesto de rastreo que debería ir a la portada y a la reserva.
         No es una medida de seguridad —de eso se encarga el login—, es
         higiene de indexación. */
      disallow: ["/dashboard", "/api/", "/auth/", "/perfil"],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
