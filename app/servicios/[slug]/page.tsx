import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Footer } from "@/components/layout/Footer";
import { SiteMenu } from "@/components/layout/SiteMenu";
import { createClient } from "@/lib/supabase/server";
import { supabaseConfigurado } from "@/lib/citas";
import { SITE, SITE_URL } from "@/lib/site";
import { SERVICIOS_PAGINA, servicioPorSlug, type Servicio } from "@/lib/servicios";
import { NOTA_PRECIOS, TAMANO_PRECIOS, formatRangoCLP } from "@/lib/reserva";

/* Una página por servicio (SEO local, 27-jul).

   Estáticas: `generateStaticParams` las prerenderiza, así que Google recibe
   HTML completo sin esperar a que corra nada. El precio se lee al construir
   —no en cada visita— y se revalida cada hora: un rango referencial no
   necesita estar al segundo, y así la página sigue siendo rápida. */

export const revalidate = 3600;

export function generateStaticParams() {
  return SERVICIOS_PAGINA.map((s) => ({ slug: s.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const servicio = servicioPorSlug(slug);
  if (!servicio) return {};
  return {
    title: servicio.titulo,
    description: servicio.descripcion,
    /* Canonical propio: sin él, estas cuatro páginas y la portada se
       reparten la misma autoridad en vez de sumar cada una la suya. */
    alternates: { canonical: `/servicios/${servicio.slug}` },
    openGraph: {
      title: servicio.titulo,
      description: servicio.descripcion,
      url: `${SITE_URL}/servicios/${servicio.slug}`,
      images: [{ url: servicio.imagen, alt: servicio.imagenAlt }],
      type: "website",
      locale: "es_CL",
    },
  };
}

/** Precio base más bajo vigente, para el "desde".

    Se lee de la tabla y no de una constante escrita acá: los precios los
    cambia Rodolfo desde el panel, y una página que promete un valor que ya
    no existe es peor que una que no menciona precio. Si la consulta falla,
    cae a los valores por defecto del código en vez de romper la página. */
async function precioDesde(tamano: Servicio["tamanoReferencia"]): Promise<number> {
  if (!supabaseConfigurado()) return TAMANO_PRECIOS[tamano];
  try {
    const supabase = await createClient();
    const { data } = await supabase
      .from("tarifas")
      .select("precio")
      .eq("tamano", tamano)
      .eq("activo", true)
      .maybeSingle();
    return data?.precio ?? TAMANO_PRECIOS[tamano];
  } catch {
    return TAMANO_PRECIOS[tamano];
  }
}

export default async function ServicioPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const servicio = servicioPorSlug(slug);
  if (!servicio) notFound();

  const desde = await precioDesde(servicio.tamanoReferencia);
  const otros = SERVICIOS_PAGINA.filter((s) => s.slug !== servicio.slug);

  /* Ficha del servicio para Google. Es lo que puede hacer que la página
     aparezca al buscar "baño y corte para perros en Renca" y no solo por el
     nombre del salón. El precio va como rango y con la misma advertencia
     que se muestra en pantalla: prometer un valor cerrado sería mentir. */
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Service",
    name: servicio.titulo,
    description: servicio.descripcion,
    serviceType: servicio.nombre,
    url: `${SITE_URL}/servicios/${servicio.slug}`,
    provider: {
      "@type": "LocalBusiness",
      name: SITE.name,
      url: SITE_URL,
      address: {
        "@type": "PostalAddress",
        streetAddress: "Arturo Prat 4556",
        addressLocality: "Renca",
        addressRegion: "Región Metropolitana",
        addressCountry: "CL",
      },
    },
    areaServed: ["Renca", "Cerro Navia", "Quinta Normal", "Pudahuel", "Santiago"].map(
      (name) => ({ "@type": "City", name })
    ),
    offers: {
      "@type": "Offer",
      priceCurrency: "CLP",
      price: desde,
      description: `Desde ${formatRangoCLP(desde)}. ${NOTA_PRECIOS}`,
      availability: "https://schema.org/InStock",
      url: `${SITE_URL}/reserva?servicio=${encodeURIComponent(servicio.servicioFormulario)}`,
    },
  };

  const urlReserva = `/reserva?servicio=${encodeURIComponent(servicio.servicioFormulario)}`;

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <SiteMenu />
      <main className="flex-1 bg-cream pb-16 pt-24">
        <div className="mx-auto max-w-3xl px-5">
          {/* Migas: le dicen a Google dónde encaja esta página, y al cliente
              cómo volver. */}
          <nav aria-label="Ruta" className="text-xs font-bold text-ink-soft">
            <Link href="/" className="hover:text-teal-dark">
              Inicio
            </Link>
            <span className="mx-1.5" aria-hidden="true">
              ›
            </span>
            <span className="text-ink">{servicio.nombre}</span>
          </nav>

          <h1 className="mt-4 font-display text-3xl font-extrabold leading-tight tracking-tight text-ink md:text-4xl">
            {servicio.titulo}
          </h1>
          <p className="mt-4 text-[15px] leading-relaxed text-ink-soft">{servicio.entrada}</p>

          <div className="mt-8 overflow-hidden rounded-3xl">
            <Image
              src={servicio.imagen}
              alt={servicio.imagenAlt}
              width={1200}
              height={800}
              className="w-full object-cover"
              priority
            />
          </div>

          <section className="mt-10">
            <h2 className="font-display text-xl font-extrabold text-ink md:text-2xl">
              Qué incluye
            </h2>
            <ul className="mt-4 space-y-2.5">
              {servicio.incluye.map((item) => (
                <li key={item} className="flex gap-3 text-[15px] leading-relaxed text-ink-soft">
                  <span aria-hidden="true" className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-teal" />
                  {item}
                </li>
              ))}
            </ul>
          </section>

          <section className="mt-10">
            <h2 className="font-display text-xl font-extrabold text-ink md:text-2xl">
              Para qué perritos
            </h2>
            <p className="mt-3 text-[15px] leading-relaxed text-ink-soft">{servicio.paraQuien}</p>
          </section>

          <section className="mt-10 rounded-3xl bg-white px-6 py-7">
            <h2 className="font-display text-xl font-extrabold text-ink">Cuánto sale</h2>
            <p className="mt-2 text-2xl font-extrabold text-teal-ink">
              Desde {formatRangoCLP(desde)}
            </p>
            <p className="mt-3 text-xs leading-relaxed text-ink-soft">{NOTA_PRECIOS}</p>
            <Link
              href={urlReserva}
              className="mt-6 inline-block rounded-full bg-orange px-8 py-4 font-display text-base font-extrabold text-teal-ink shadow-[0_3px_0_rgba(6,58,64,.25)] transition-[background-color,transform] duration-150 hover:bg-[#f7ab52] active:translate-y-0.5"
            >
              Calcular el precio de mi perro →
            </Link>
            <p className="mt-3 text-xs text-ink-soft">
              El formulario estima el valor según su peso, su pelo y su
              temperamento. No necesitas cuenta.
            </p>
          </section>

          <section className="mt-10 rounded-3xl bg-[#d8f0e3] px-6 py-7">
            <h2 className="font-display text-lg font-extrabold text-teal-ink">Dónde estamos</h2>
            <p className="mt-2 text-sm leading-relaxed text-teal-ink">
              {SITE.address}. Atendemos {SITE.hours.toLowerCase()}, y llegan
              familias de Renca, Cerro Navia, Quinta Normal y Pudahuel.
            </p>
            <a
              href={SITE.mapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 inline-flex items-center py-2 text-sm font-extrabold text-teal-dark hover:underline"
            >
              Ver cómo llegar →
            </a>
          </section>

          {/* Enlaces entre servicios: reparten autoridad entre las páginas y
              le dan al cliente el siguiente paso natural. */}
          <section className="mt-12">
            <h2 className="font-display text-lg font-extrabold text-ink">Otros servicios</h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              {otros.map((o) => (
                <Link
                  key={o.slug}
                  href={`/servicios/${o.slug}`}
                  className="rounded-2xl bg-white px-4 py-4 text-sm font-extrabold text-teal-ink transition-transform duration-150 hover:-translate-y-0.5"
                >
                  {o.nombre} →
                </Link>
              ))}
            </div>
          </section>
        </div>
      </main>
      <Footer />
    </>
  );
}
