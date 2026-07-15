import type { Metadata } from "next";
import { Footer } from "@/components/layout/Footer";
import { SiteMenu } from "@/components/layout/SiteMenu";
import { EditorPromos } from "@/components/admin/EditorPromos";

export const metadata: Metadata = {
  title: "Anuncios — Panel Perrustingo",
  robots: { index: false, follow: false },
};

export default function AnunciosPage() {
  return (
    <>
      <SiteMenu />
      <main className="min-h-screen bg-cream px-5 pb-16 pt-28">
        <div className="mx-auto max-w-5xl">
          <p className="text-xs font-extrabold uppercase tracking-[0.22em] text-teal-dark">
            Panel del admin
          </p>
          <h1 className="mt-1 font-display text-3xl font-extrabold tracking-tight text-ink">
            Anuncios de la landing
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink-soft">
            Distribuye los anuncios en las posiciones intermedias de la página
            principal. Cada anuncio aparece una sola vez, donde tú decidas.
          </p>

          <div className="mt-8">
            <EditorPromos />
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
