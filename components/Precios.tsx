import Link from "next/link";
import { Flotantes } from "./Flotantes";
import { Reveal } from "./Reveal";

const INCLUYE = [
  { emoji: "✂️", texto: "Corte de pelo y estilo" },
  { emoji: "💅", texto: "Corte de uñas" },
  { emoji: "👂", texto: "Limpieza de oídos" },
  { emoji: "🧴", texto: "Drenaje o limpieza de glándulas anales" },
  { emoji: "🚿", texto: "Baño completo" },
  { emoji: "🪮", texto: "Peinado y eliminación de pelo muerto" },
  { emoji: "💨", texto: "Secado profesional" },
];

export function Precios() {
  return (
    <section id="precios" className="relative scroll-mt-20 overflow-hidden bg-section-blend px-5 py-16">
      <Flotantes />
      <div className="relative mx-auto max-w-6xl">
        <Reveal>
          <div className="rounded-3xl bg-cream p-8">
            <h3 className="text-center font-display text-xl font-extrabold tracking-tight">
              ¿Qué incluye el servicio?
            </h3>
            <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {INCLUYE.map((item) => (
                <div
                  key={item.texto}
                  className="flex items-center gap-3 rounded-2xl bg-white px-4 py-3 shadow-sm"
                >
                  <span aria-hidden="true" className="text-xl">{item.emoji}</span>
                  <span className="text-sm font-semibold text-ink">{item.texto}</span>
                </div>
              ))}
            </div>
            <p className="mt-5 text-center text-xs leading-relaxed text-ink-soft">
              * Si lo solicitas, podemos colocar <strong>pinches decorativos</strong> a
              las hembras y, a veces, un accesorio a los machos.
            </p>
          </div>
        </Reveal>

        <Reveal className="mt-8 text-center">
          <Link
            href="/reserva"
            className="inline-block rounded-full bg-orange px-8 py-3.5 font-display text-base font-extrabold text-teal-ink shadow-[0_3px_0_rgba(6,58,64,.25)] transition-[background-color,transform,box-shadow] duration-150 hover:bg-[#f7ab52] hover:shadow-[0_5px_0_rgba(6,58,64,.25)] active:translate-y-0.5 active:shadow-[0_1px_0_rgba(6,58,64,.25)]"
          >
            Reserva y confirma tu precio →
          </Link>
        </Reveal>
      </div>
    </section>
  );
}
