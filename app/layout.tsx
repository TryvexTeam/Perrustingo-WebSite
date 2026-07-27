import type { Metadata, Viewport } from "next";
import { SITE, SITE_URL, WHATSAPP_NUMBER, hayWhatsAppConfigurado } from "@/lib/site";
import { Bricolage_Grotesque, Figtree } from "next/font/google";
import { CookieBanner } from "@/components/layout/CookieBanner";
import { ServiceWorkerRegister } from "@/components/layout/ServiceWorkerRegister";
import "./globals.css";

const bricolage = Bricolage_Grotesque({
  variable: "--font-bricolage",
  subsets: ["latin"],
  weight: ["400", "600", "700", "800"],
});

const figtree = Figtree({
  variable: "--font-figtree",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  /* El canonical faltaba. Sin él, `perrustingo.com`, `www.perrustingo.com`
     y cualquier URL con parámetros compiten entre sí por la misma posición
     en vez de sumar. */
  alternates: { canonical: "/" },
  title: {
    default: "Peluquería Canina en Renca — Perrustingo",
    template: "%s · Perrustingo",
  },
  /* El orden importa: quien busca no escribe "Perrustingo" —todavía no nos
     conoce—, escribe "peluquería canina en Renca". Lo que se busca va
     primero, la marca después. */
  description:
    "Peluquería canina en Renca: baño, corte y cuidado para tu perro o perra. Atendemos Renca, Cerro Navia, Quinta Normal y Pudahuel. 4.6★ con más de 135 opiniones. Agenda online.",
  openGraph: {
    title: "Perrustingo — Peluquería Canina en Renca",
    description:
      "Bañamos, cortamos y consentimos a tu perro o perra en Renca. 4.6★ · +135 opiniones en Google.",
    url: SITE_URL,
    siteName: "Perrustingo",
    images: [
      {
        url: "/hero/hero-bg.png",
        width: 1612,
        height: 976,
        alt: "Perrustingo — Peluquería Canina en Renca",
      },
    ],
    locale: "es_CL",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Perrustingo — Peluquería Canina en Renca",
    description:
      "Bañamos, cortamos y consentimos a tu perro o perra en Renca. 4.6★ · +135 opiniones en Google.",
    images: ["/hero/hero-bg.png"],
  },
};

export const viewport: Viewport = {
  colorScheme: "only light",
  themeColor: "#b6dfea",
};

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "LocalBusiness",
  name: "Perrustingo",
  description:
    "Peluquería canina en Renca, Santiago. Baño, corte y cuidado integral para tu perro o perra.",
  url: SITE_URL,
  /* El teléfono sale del entorno. Antes estaba escrito acá el número alemán
     de prueba: Google lo leía como el teléfono oficial del negocio y podía
     mostrarlo en los resultados. Si no hay número configurado no se declara
     ninguno — un dato ausente es mucho menos dañino que uno falso. */
  ...(hayWhatsAppConfigurado() ? { telephone: `+${WHATSAPP_NUMBER}` } : {}),
  image: `${SITE_URL}/logo.jpeg`,
  priceRange: "$$",
  address: {
    "@type": "PostalAddress",
    streetAddress: "Arturo Prat 4556",
    addressLocality: "Renca",
    addressRegion: "Región Metropolitana",
    addressCountry: "CL",
  },
  geo: {
    "@type": "GeoCoordinates",
    latitude: -33.4035606,
    longitude: -70.7133999,
  },
  /* Las comunas que se atienden de verdad. Para una búsqueda local, esto es
     lo que le dice a Google a quién mostrarle el sitio: no basta con estar
     en Renca, hay que decir hasta dónde se llega. */
  areaServed: [
    { "@type": "City", name: "Renca" },
    { "@type": "City", name: "Cerro Navia" },
    { "@type": "City", name: "Quinta Normal" },
    { "@type": "City", name: "Pudahuel" },
    { "@type": "City", name: "Santiago" },
  ],
  /* `sameAs` es lo que une esta página con el perfil de Google Maps y las
     redes: sin ese puente, para el buscador son tres negocios distintos con
     el mismo nombre en vez de uno solo con reputación acumulada. */
  sameAs: [SITE.instagram, SITE.facebook, SITE.mapsUrl],
  /* Los servicios, en el lenguaje que Google entiende. Es lo que permite
     aparecer en "baño y corte para perros en Renca" y no solo en el nombre
     del negocio. */
  hasOfferCatalog: {
    "@type": "OfferCatalog",
    name: "Servicios de peluquería canina",
    itemListElement: [
      "Baño completo para perros",
      "Baño y corte de pelo",
      "Corte de uñas",
      "Spa canino",
      "Limpieza de oídos y glándulas",
    ].map((nombre) => ({
      "@type": "Offer",
      itemOffered: { "@type": "Service", name: nombre },
    })),
  },
  openingHoursSpecification: [
    {
      "@type": "OpeningHoursSpecification",
      dayOfWeek: [
        "Monday",
        "Tuesday",
        "Wednesday",
        "Thursday",
        "Friday",
        "Saturday",
      ],
      opens: "09:00",
      closes: "17:00",
    },
  ],
  aggregateRating: {
    "@type": "AggregateRating",
    ratingValue: "4.6",
    reviewCount: "135",
    bestRating: "5",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="es"
      className={`${bricolage.variable} ${figtree.variable} h-full antialiased`}
    >
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body className="min-h-full flex flex-col">
        <ServiceWorkerRegister />
        <CookieBanner />
        {children}
      </body>
    </html>
  );
}
