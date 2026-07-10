import { Reveal } from "@/components/ui/Reveal";

const WHATSAPP_PUBLICIDAD = `https://wa.me/4915237152283?text=${encodeURIComponent(
  "Hola Perrustingo, me interesa publicitar mi negocio en su sitio web. ¿Podría darme más información?"
)}`;

const SPOTS = [
  {
    id: "pub-1",
    label: "Espacio A",
    desc: "Banner horizontal · visible en toda la página",
  },
  {
    id: "pub-2",
    label: "Espacio B",
    desc: "Ideal para productos y servicios de mascotas",
  },
  {
    id: "pub-3",
    label: "Espacio C",
    desc: "Alta visibilidad · comunidad dueños de perros",
  },
];

export function Publicidad() {
  return (
    <section className="bg-blend-cream-to-white px-5 py-14">
      <div className="mx-auto max-w-6xl">
        <Reveal>
          <p className="text-center text-xs font-extrabold uppercase tracking-[0.22em] text-teal-dark">
            Espacios publicitarios
          </p>
          <h2 className="mt-2 text-center font-display text-2xl font-extrabold tracking-tight md:text-3xl">
            ¿Tienes un negocio para mascotas?
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-center text-sm leading-relaxed text-ink-soft">
            Llega directamente a los dueños de perros de Renca y Santiago.
            Contáctanos para conocer disponibilidad y tarifas.
          </p>
        </Reveal>

        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {SPOTS.map((spot, i) => (
            <Reveal key={spot.id} delay={i * 60}>
              <a
                href={WHATSAPP_PUBLICIDAD}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`Consultar espacio publicitario ${spot.label}`}
                className="group flex h-44 flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-ink/15 bg-cream text-center transition-all duration-200 hover:border-teal/40 hover:bg-sky/30"
              >
                <span aria-hidden="true" className="text-4xl opacity-20 transition-opacity duration-200 group-hover:opacity-40">
                  📢
                </span>
                <span className="font-display text-sm font-extrabold text-ink-soft">{spot.label}</span>
                <span className="text-xs text-ink-soft/60">{spot.desc}</span>
                <span className="mt-1 rounded-full bg-teal/10 px-3 py-1 text-xs font-bold text-teal-dark opacity-0 transition-opacity duration-200 group-hover:opacity-100">
                  Consultar disponibilidad →
                </span>
              </a>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
