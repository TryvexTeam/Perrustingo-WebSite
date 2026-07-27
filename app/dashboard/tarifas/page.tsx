import type { Metadata } from "next";
import { Footer } from "@/components/layout/Footer";
import { SiteMenu } from "@/components/layout/SiteMenu";
import { EditorTarifas } from "@/components/admin/EditorTarifas";
import { EditorTramos } from "@/components/admin/EditorTramos";
import { EditorAjustesPrecio } from "@/components/admin/EditorAjustesPrecio";

export const metadata: Metadata = {
  title: "Tarifas — Panel Perrustingo",
  robots: { index: false, follow: false },
};

export default function TarifasPage() {
  return (
    <>
      <SiteMenu />
      <main className="min-h-screen bg-cream px-5 pb-16 pt-28">
        <div className="mx-auto max-w-5xl">
          <p className="text-xs font-extrabold uppercase tracking-[0.22em] text-teal-dark">
            Panel del admin
          </p>
          <h1 className="mt-1 font-display text-3xl font-extrabold tracking-tight text-ink">
            Costos y tarifas
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink-soft">
            Ajusta los precios base por tamaño y los recargos. Los cambios se
            reflejan al instante en la sección de precios de la landing y en el
            formulario de reserva.
          </p>

          {/* Va primero porque es el que manda: el precio base sale del tramo
              por peso. El editor por tamaño de abajo sigue sirviendo para los
              cachorros de raza conocida (que se cobran por el tamaño adulto) y
              como red si la tabla de tramos quedara vacía. */}
          <div className="mt-8">
            <EditorTramos />
          </div>
          <div className="mt-8">
            <EditorTarifas />
          </div>
          <div className="mt-8">
            <EditorAjustesPrecio />
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
