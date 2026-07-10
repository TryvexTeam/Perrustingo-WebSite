import Link from "next/link";
import { Flotantes } from "./Flotantes";
import { Reveal } from "@/components/ui/Reveal";
import { NOTA_PRECIOS } from "@/lib/reserva";

/* Cada servicio incluido enlaza a su card en el catálogo de imágenes */
const INCLUYE = [
  { emoji: "✂️", texto: "Corte de pelo y estilo", ancla: "#servicio-corte" },
  { emoji: "💅", texto: "Corte de uñas", ancla: "#servicio-unas" },
  { emoji: "👂", texto: "Limpieza de oídos", ancla: "#servicio-oidos" },
  { emoji: "🧴", texto: "Drenaje o limpieza de glándulas anales", ancla: "#servicio-glandulas" },
  { emoji: "🚿", texto: "Baño completo", ancla: "#servicio-bano" },
  { emoji: "🪮", texto: "Peinado y eliminación de pelo muerto", ancla: "#servicio-peinado" },
  { emoji: "💨", texto: "Secado profesional", ancla: "#servicio-secado" },
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
                <Link
                  key={item.texto}
                  href={item.ancla}
                  className="group flex items-center gap-3 rounded-2xl bg-white px-4 py-3 shadow-sm transition-[transform,box-shadow] duration-200 ease-[var(--ease-out-expo)] hover:-translate-y-0.5 hover:shadow-md"
                >
                  <span aria-hidden="true" className="text-xl">{item.emoji}</span>
                  <span className="flex-1 text-sm font-semibold text-ink">{item.texto}</span>
                  <span aria-hidden="true" className="text-xs font-extrabold text-teal-dark opacity-0 transition-opacity duration-200 group-hover:opacity-100">
                    Ver →
                  </span>
                </Link>
              ))}
            </div>
            <p className="mt-5 text-center text-xs leading-relaxed text-ink-soft">
              * Si lo solicitas, podemos colocar <strong>pinches decorativos</strong> a
              las hembras y, a veces, un accesorio a los machos.
            </p>
            <p className="mt-2 text-center text-xs leading-relaxed text-ink-soft">
              {NOTA_PRECIOS}
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
