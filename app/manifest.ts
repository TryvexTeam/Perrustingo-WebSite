import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Perrustingo — Peluquería canina en Renca",
    short_name: "Perrustingo",
    description:
      "Baño, corte y spa canino en Renca, Santiago. Agenda tu cita en minutos.",
    start_url: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#f5f0e8",
    theme_color: "#063a40",
    categories: ["lifestyle", "health", "shopping"],
    lang: "es-CL",
    icons: [
      { src: "/icon-72.png",  sizes: "72x72",   type: "image/png" },
      { src: "/icon-96.png",  sizes: "96x96",   type: "image/png" },
      { src: "/icon-128.png", sizes: "128x128", type: "image/png" },
      { src: "/icon-144.png", sizes: "144x144", type: "image/png" },
      { src: "/icon-152.png", sizes: "152x152", type: "image/png" },
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/icon-384.png", sizes: "384x384", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
    ],
    shortcuts: [
      {
        name: "Reserva inteligente",
        short_name: "Reservar",
        description: "Agenda tu cita ahora",
        url: "/reserva",
        icons: [{ src: "/icon-96.png", sizes: "96x96" }],
      },
      {
        name: "Mi cuenta",
        short_name: "Mi cuenta",
        description: "Ver mi perfil y mis citas",
        url: "/perfil",
        icons: [{ src: "/icon-96.png", sizes: "96x96" }],
      },
    ],
    screenshots: [
      {
        src: "/hero/hero-bg.png",
        sizes: "1612x976",
        type: "image/png",
        form_factor: "wide",
        label: "Perrustingo — Peluquería canina en Renca",
      },
    ],
  };
}
