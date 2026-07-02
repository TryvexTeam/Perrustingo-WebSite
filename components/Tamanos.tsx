import { Flotantes } from "./Flotantes";
import { Reveal } from "./Reveal";

const TAMANOS = [
  {
    emoji: "🐁",
    bg: "bg-[#fdeaf1]",
    nombre: "Mini / Toy",
    rango: "hasta 5 kg",
    ejemplos: "Chihuahua, Pomerania, Yorkshire, Poodle Toy",
    nota: "Baño y corte rápidos, con extrema delicadeza y cuidados.",
  },
  {
    emoji: "🐕",
    bg: "bg-[#e3f1fb]",
    nombre: "Pequeños",
    rango: "6 a 10 kg",
    ejemplos: "Bichón Frisé, Shih Tzu, Poodle",
    nota: "Su manto suele requerir mantenimiento frecuente.",
  },
  {
    emoji: "🦴",
    bg: "bg-[#ece4f7]",
    nombre: "Medianos",
    rango: "11 a 25 kg",
    ejemplos: "Beagle, Cocker Spaniel, Schnauzer",
    nota: "Más producto, más tiempo de secado y sus cortes de raza.",
  },
  {
    emoji: "🦮",
    bg: "bg-[#fde4c8]",
    nombre: "Grandes",
    rango: "26 a 45 kg",
    ejemplos: "Golden Retriever, Labrador, Pastor Alemán",
    nota: "El cepillado y desenredado toma más tiempo.",
  },
  {
    emoji: "🐻",
    bg: "bg-[#d8f0e3]",
    nombre: "Gigantes",
    rango: "más de 45 kg",
    ejemplos: "San Bernardo, Terranova",
    nota: "Requieren instalaciones y mesas adaptadas a su peso.",
  },
];

export function Tamanos() {
  return (
    <section id="tamanos" className="relative scroll-mt-20 overflow-hidden bg-cream px-5 pb-16">
      <Flotantes />
      <div className="relative mx-auto max-w-6xl">
        <Reveal>
          <p className="text-center text-xs font-extrabold uppercase tracking-[0.22em] text-teal-dark">
            Guía de tamaños
          </p>
          <h2 className="mt-2 text-center font-display text-3xl font-extrabold tracking-tight md:text-4xl">
            Cada perro es distinto, y así lo evaluamos
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-center text-[15px] leading-relaxed text-ink-soft">
            Evaluamos el peso, el tamaño, el comportamiento y cualquier condición
            de salud que debamos saber, además del tipo de pelo (liso, rizado,
            doble capa, nudos o motas) para preparar el servicio de tu perro.
          </p>
        </Reveal>

        <div className="mt-10 grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-5 [&>div:last-child]:col-span-2 md:[&>div:last-child]:col-span-1">
          {TAMANOS.map((t, i) => (
            <Reveal key={t.nombre} delay={i * 60} className="h-full">
              <div
                className={`flex h-full flex-col items-center gap-3 rounded-3xl ${t.bg} p-6 text-center transition-transform duration-200 ease-[var(--ease-out-expo)] hover:-translate-y-1`}
              >
                <span
                  aria-hidden="true"
                  className="flex h-14 w-14 items-center justify-center rounded-full border-[3px] border-white bg-white/70 text-2xl shadow-sm"
                >
                  {t.emoji}
                </span>
                <div>
                  <h3 className="font-display text-base font-extrabold">{t.nombre}</h3>
                  <p className="text-xs font-bold uppercase tracking-wide text-teal-dark">{t.rango}</p>
                </div>
                <p className="text-xs font-semibold text-ink">{t.ejemplos}</p>
                <p className="text-xs leading-relaxed text-ink-soft">{t.nota}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
