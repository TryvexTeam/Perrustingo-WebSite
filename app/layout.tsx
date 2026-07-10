import type { Metadata, Viewport } from "next";
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
  metadataBase: new URL("https://perrustingo.cl"),
  title: "Perrustingo — Peluquería Canina en Renca",
  description:
    "Bañamos, cortamos y consentimos a tu perro en Renca, Santiago. 4.6★ en Google con más de 135 opiniones. Agenda tu cita por WhatsApp.",
  openGraph: {
    title: "Perrustingo — Peluquería Canina en Renca",
    description:
      "Bañamos, cortamos y consentimos a tu perro en Renca. 4.6★ · +135 opiniones en Google.",
    url: "https://perrustingo.cl",
    siteName: "Perrustingo",
    images: [
      {
        url: "/hero-bg.png",
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
      "Bañamos, cortamos y consentimos a tu perro en Renca. 4.6★ · +135 opiniones en Google.",
    images: ["/hero-bg.png"],
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
    "Peluquería canina en Renca, Santiago. Baño, corte y cuidado integral para tu perro.",
  url: "https://perrustingo.cl",
  telephone: "+4915237152283",
  image: "https://perrustingo.cl/logo.png",
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
