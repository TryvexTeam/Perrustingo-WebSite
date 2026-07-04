import Image from "next/image";
import { Flotantes } from "./Flotantes";
import { Reveal } from "./Reveal";

interface Tamano {
  foto: string;
  bg: string;
  nombre: string;
  rango: string;
  razas: string[];
  nota: string;
}

const TAMANOS: Tamano[] = [
  {
    foto: "/cards/foto-mini.png",
    bg: "bg-[#fdeaf1]",
    nombre: "Mini / Toy",
    rango: "hasta 5 kg",
    razas: [
      "Chihuahua",
      "Pomerania",
      "Yorkshire",
      "Poodle Toy",
      "Dachshund Miniatura",
      "Fox Terrier Pelo Liso",
    ],
    nota: "Baño y corte rápidos, con extrema delicadeza y cuidados.",
  },
  {
    foto: "/cards/foto-pequeno.png",
    bg: "bg-[#e3f1fb]",
    nombre: "Pequeños",
    rango: "6 a 10 kg",
    razas: [
      "Bichón Frisé",
      "Shih Tzu",
      "Poodle",
      "Terrier Chileno",
      "Dachshund",
    ],
    nota: "Su manto suele requerir mantenimiento frecuente.",
  },
  {
    foto: "/cards/foto-mediano.png",
    bg: "bg-[#ece4f7]",
    nombre: "Medianos",
    rango: "11 a 25 kg",
    razas: [
      "Beagle",
      "Cocker Spaniel",
      "Schnauzer",
      "Bulldog Francés",
      "Dogo Chileno",
    ],
    nota: "Más producto, más tiempo de secado y sus cortes de raza.",
  },
  {
    foto: "/cards/foto-grande.png",
    bg: "bg-[#fde4c8]",
    nombre: "Grandes",
    rango: "26 a 45 kg",
    razas: [
      "Golden Retriever",
      "Labrador",
      "Pastor Alemán",
      "Pastor Inglés",
      "Samoyedo",
      "Ovejero Magallánico",
    ],
    nota: "El cepillado y desenredado toma más tiempo.",
  },
  {
    foto: "/cards/foto-gigante.png",
    bg: "bg-[#d8f0e3]",
    nombre: "Gigantes",
    rango: "más de 45 kg",
    razas: ["San Bernardo", "Terranova", "Mestizo / Quiltro"],
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
                className={`tilt-card flex h-full flex-col items-center gap-3 overflow-hidden rounded-3xl ${t.bg} p-6 pt-0 text-center`}
              >
                <Image
                  src={t.foto}
                  alt=""
                  aria-hidden="true"
                  width={640}
                  height={480}
                  className="-mx-6 w-[calc(100%+3rem)] max-w-none object-cover"
                />
                <div>
                  <h3 className="font-display text-base font-extrabold">{t.nombre}</h3>
                  <p className="text-xs font-bold uppercase tracking-wide text-teal-dark">{t.rango}</p>
                </div>
                <div className="flex flex-wrap justify-center gap-1.5">
                  {t.razas.map((raza) => (
                    <span
                      key={raza}
                      className="rounded-full bg-white/70 px-2.5 py-1 text-[11px] font-semibold text-ink"
                    >
                      {raza}
                    </span>
                  ))}
                </div>
                <p className="text-xs leading-relaxed text-ink-soft">{t.nota}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
