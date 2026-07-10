import { Flotantes } from "./Flotantes";
import { PrecioDinamico } from "./PrecioDinamico";
import { Reveal } from "@/components/ui/Reveal";
import { BreedAvatar } from "@/components/ui/BreedAvatar";
import { CloudCard, type CloudCardTone } from "@/components/ui/CloudCard";
import { razaImagen, razasPorTamano, TAMANO_IMAGEN } from "@/lib/razas";
import { TAMANO_LABELS, type TamanoKey, NOTA_PRECIOS } from "@/lib/reserva";

interface GrupoTamano {
  key: TamanoKey;
  tone: CloudCardTone;
  nombre: string;
  rango: string;
  nota: string;
  priceColor: string;
}

const GRUPOS: GrupoTamano[] = [
  {
    key: "toy",
    priceColor: "text-[#c94fa8]",
    tone: "rose",
    nombre: "Mini / Toy",
    rango: "hasta 5 kg",
    nota: "Baño y corte rápidos, con extrema delicadeza y cuidados.",
  },
  {
    key: "pequeno",
    priceColor: "text-[#1890d4]",
    tone: "sky",
    nombre: "Pequeños",
    rango: "6 a 10 kg",
    nota: "Su manto suele requerir mantenimiento frecuente.",
  },
  {
    key: "mediano",
    priceColor: "text-[#7c4bba]",
    tone: "lilac",
    nombre: "Medianos",
    rango: "11 a 25 kg",
    nota: "Más producto, más tiempo de secado y sus cortes de raza.",
  },
  {
    key: "grande",
    priceColor: "text-orange",
    tone: "peach",
    nombre: "Grandes",
    rango: "26 a 45 kg",
    nota: "El cepillado y desenredado toma más tiempo.",
  },
  {
    key: "gigante",
    priceColor: "text-teal-dark",
    tone: "mint",
    nombre: "Gigantes",
    rango: "más de 45 kg",
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
            Tamaños y tarifas
          </p>
          <h2 className="mt-2 text-center font-display text-3xl font-extrabold tracking-tight md:text-4xl">
            Cada perro es distinto, y el precio va con su tamaño
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-center text-[15px] leading-relaxed text-ink-soft">
            Evaluamos el peso, el comportamiento, la salud y el tipo de pelo
            (liso, rizado, doble capa, nudos o motas). Los precios son para
            perritos en buen estado, con el servicio completo incluido, y se
            confirman antes de comenzar. Sin sorpresas.
          </p>
        </Reveal>

        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3 [&>div:nth-child(4)]:lg:col-start-1 xl:[&>div:nth-child(4)]:col-start-auto">
          {GRUPOS.map((grupo, i) => {
            const razas = razasPorTamano(grupo.key);
            return (
              <Reveal key={grupo.key} delay={i * 60} className="h-full">
                <CloudCard
                  tone={grupo.tone}
                  index={i}
                  visual={
                    <BreedAvatar
                      src={TAMANO_IMAGEN[grupo.key]}
                      nombre={TAMANO_LABELS[grupo.key]}
                      size="lg"
                      className="!h-full !w-full !border-0 !bg-transparent !shadow-none"
                    />
                  }
                  titulo={
                    <>
                      {grupo.nombre}
                      <span className="mt-0.5 block text-xs font-bold uppercase tracking-wide text-teal-dark">
                        {grupo.rango}
                      </span>
                      <PrecioDinamico
                        tamano={grupo.key}
                        className={`mt-1 block font-display text-xl font-extrabold ${grupo.priceColor}`}
                      />
                    </>
                  }
                >
                  <ul className="flex flex-wrap justify-center gap-x-3 gap-y-2.5">
                    {razas.map((raza) => (
                      <li key={raza.slug} className="flex w-[74px] flex-col items-center gap-1">
                        <BreedAvatar src={razaImagen(raza.slug)} nombre={raza.nombre} size="md" />
                        <span className="text-[10.5px] font-semibold leading-tight text-ink">
                          {raza.nombre}
                        </span>
                      </li>
                    ))}
                  </ul>
                  <p className="mt-4 text-xs leading-relaxed text-ink-soft">{grupo.nota}</p>
                </CloudCard>
              </Reveal>
            );
          })}
        </div>
        <p className="mt-6 text-center text-xs leading-relaxed text-ink-soft">
          {NOTA_PRECIOS}
        </p>
      </div>
    </section>
  );
}
