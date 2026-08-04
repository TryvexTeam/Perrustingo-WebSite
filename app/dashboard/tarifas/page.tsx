import type { Metadata } from "next";
import { Footer } from "@/components/layout/Footer";
import { SiteMenu } from "@/components/layout/SiteMenu";
import { EditorTarifas } from "@/components/admin/EditorTarifas";
import { EditorTramos } from "@/components/admin/EditorTramos";
import { EditorTramosAltura } from "@/components/admin/EditorTramosAltura";
import { EditorServiciosPrecio } from "@/components/admin/EditorServiciosPrecio";
import { EditorAjustesPrecio } from "@/components/admin/EditorAjustesPrecio";

export const metadata: Metadata = {
  title: "Tarifas — Panel Perrustingo",
  robots: { index: false, follow: false },
};

/* La página estaba como una pila de cuatro editores sueltos, sin decir en
   ninguna parte cómo se combinan entre sí. El dueño podía cambiar un número
   sin saber si sumaba, multiplicaba o reemplazaba a otro.

   Ahora sigue el orden en que se arma el precio —primero de dónde sale la
   base, después qué la ajusta— y lo dice arriba con la fórmula real: los
   porcentajes se suman entre sí y se aplican UNA vez sobre la base (ver
   `calcularEstimado` en lib/reserva.ts), nunca en cadena. */

function Paso({
  numero,
  titulo,
  children,
}: {
  numero: string;
  titulo: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-10">
      <div className="flex items-center gap-3">
        <span className="flex h-7 w-7 flex-none items-center justify-center rounded-full bg-teal text-sm font-extrabold text-white">
          {numero}
        </span>
        <h2 className="font-display text-2xl font-extrabold tracking-tight text-ink">{titulo}</h2>
      </div>
      <div className="mt-4 space-y-6">{children}</div>
    </section>
  );
}

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
            Los cambios se reflejan al instante en la landing y en el formulario de reserva.
          </p>

          {/* Cómo se compone el precio, escrito una vez y arriba de todo. */}
          <div className="mt-6 rounded-3xl border border-teal/25 bg-white p-5">
            <p className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-teal-dark">
              Cómo se arma el precio
            </p>
            <p className="mt-2 text-sm leading-relaxed text-ink">
              <strong>Precio del peso</strong> + los ajustes que correspondan (servicio, altura,
              pelaje, temperamento, zonas sensibles, descuentos).
            </p>
            <p className="mt-2 text-sm leading-relaxed text-ink-soft">
              Los porcentajes <strong>se suman entre sí</strong> y se aplican una sola vez sobre el
              precio del peso — no se encadenan. Un perrito con +10% de pelaje y +5% de altura paga
              un 15% más que la base, no un 15,5%. Los montos en pesos se suman al final, sin
              escalar.
            </p>
          </div>

          <Paso numero="1" titulo="De dónde sale el precio base">
            {/* El de tramos va primero porque es el que manda. El de tamaño
                sigue sirviendo para los cachorros de raza conocida (se cobran
                por el tamaño adulto) y como red si la tabla de tramos quedara
                vacía. */}
            <EditorTramos />
            <EditorTarifas />
          </Paso>

          <Paso numero="2" titulo="Qué ajusta ese precio">
            <EditorServiciosPrecio />
            <EditorTramosAltura />
            <EditorAjustesPrecio />
          </Paso>
        </div>
      </main>
      <Footer />
    </>
  );
}
