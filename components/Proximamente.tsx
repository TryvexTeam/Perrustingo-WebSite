import Image from "next/image";
import { Reveal } from "./Reveal";

/* Ventanas promocionales — posters oficiales de la campaña:
   retiro y entrega (protagonista), expansión Brasil/Alemania,
   a domicilio y recomendaciones. Arte en /public/promos/. */

export function Proximamente() {
  return (
    <section id="proximamente" className="scroll-mt-20 bg-cream px-5 py-16">
      <div className="mx-auto max-w-6xl">
        <Reveal>
          <p className="text-center text-xs font-extrabold uppercase tracking-[0.22em] text-teal-dark">
            Próximamente
          </p>
          <h2 className="mt-2 text-center font-display text-3xl font-extrabold tracking-tight md:text-4xl">
            Lo que viene para Perrustingo
          </h2>
        </Reveal>

        <div className="mt-10 grid gap-5 md:grid-cols-2">
          <Reveal className="h-full">
            <Image
              src="/promos/retiro-entrega.png"
              alt="Próximamente: servicio de retiro y entrega — vamos por tu peludito, lo consentimos y te lo devolvemos. Seguro, puntual, confiable, fácil y rápido por WhatsApp."
              width={1086}
              height={1448}
              className="h-full w-full rounded-[28px] object-cover shadow-[0_2px_16px_rgba(47,62,70,0.1)] transition-transform duration-300 ease-[var(--ease-out-expo)] hover:-translate-y-1"
            />
          </Reveal>
          <div className="grid gap-5">
            <Reveal delay={80}>
              <Image
                src="/promos/internacional.png"
                alt="Próximamente Perrustingo internacional: Brasil (em breve) y Alemania (bald verfügbar) — nuevos destinos, el mismo amor."
                width={1536}
                height={1024}
                className="w-full rounded-[28px] shadow-[0_2px_16px_rgba(47,62,70,0.1)] transition-transform duration-300 ease-[var(--ease-out-expo)] hover:-translate-y-1"
              />
            </Reveal>
            <div className="grid grid-cols-2 gap-5">
              <Reveal delay={140}>
                <Image
                  src="/promos/domicilio.png"
                  alt="Próximamente: Perrustingo a domicilio — el spa canino hasta tu casa."
                  width={1122}
                  height={1402}
                  className="w-full rounded-[28px] shadow-[0_2px_16px_rgba(47,62,70,0.1)] transition-transform duration-300 ease-[var(--ease-out-expo)] hover:-translate-y-1"
                />
              </Reveal>
              <Reveal delay={200}>
                <Image
                  src="/promos/recomendaciones.png"
                  alt="Próximamente: recomendaciones — consejos, productos y rutinas de cuidado canino."
                  width={1086}
                  height={1448}
                  className="w-full rounded-[28px] shadow-[0_2px_16px_rgba(47,62,70,0.1)] transition-transform duration-300 ease-[var(--ease-out-expo)] hover:-translate-y-1"
                />
              </Reveal>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
