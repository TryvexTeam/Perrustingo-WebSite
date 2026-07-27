import { BeforeAfterSlider } from "./BeforeAfterSlider";
import { Reveal } from "@/components/ui/Reveal";

export function AntesDespues() {
  return (
    <section id="antes-despues" className="scroll-mt-20 bg-blend-cream-to-white px-5 py-14">
      <div className="mx-auto max-w-6xl">
        <Reveal>
          <div className="flex items-end justify-between gap-4">
            <h2 className="font-display text-3xl font-extrabold tracking-tight md:text-4xl">
              Antes / Después
            </h2>
            <a
              href="https://instagram.com/perrustingo"
              target="_blank"
              rel="noopener noreferrer"
              className="-my-2 inline-flex items-center py-2 text-sm font-bold uppercase tracking-wide text-teal-dark transition-colors hover:text-teal-ink"
            >
              Ver más en Instagram →
            </a>
          </div>
        </Reveal>

        <Reveal className="mt-8">
          <BeforeAfterSlider
            beforeSrc="/antes-despues/antes-card.png"
            afterSrc="/antes-despues/despues-card.png"
            beforeAlt="Perro antes de su sesión de peluquería, con el pelo largo y enredado"
            afterAlt="El mismo perro después: limpio, con corte parejo y feliz"
          />
        </Reveal>
      </div>
    </section>
  );
}
