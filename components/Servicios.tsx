import Image from "next/image";
import { BOOKING_URL } from "@/lib/site";
import { Reveal } from "./Reveal";

interface Servicio {
  foto: string;
  alt: string;
  w: number;
  h: number;
}

const SERVICIOS: Servicio[] = [
  { foto: "/servicios/spa.png", alt: "Día de spa — relajación, mascarillas y mucho mimo", w: 784, h: 844 },
  { foto: "/servicios/secado.png", alt: "Secado profesional con productos de calidad para su pelaje", w: 772, h: 840 },
  { foto: "/servicios/bano.png", alt: "Baño relajante — limpieza profunda con amor y cuidado", w: 1948, h: 924 },
  { foto: "/servicios/cachorro.png", alt: "Corte de cachorro — ternura que se ve y se siente", w: 1264, h: 772 },
  { foto: "/servicios/unas.png", alt: "Cuidado de uñas — uñitas sanas, paseos seguros y sin rasguños", w: 1268, h: 760 },
  { foto: "/servicios/corte-estilo.png", alt: "Corte y estilo — el look perfecto para tu mejor amigo", w: 1924, h: 916 },
  { foto: "/servicios/dental.png", alt: "Limpieza dental — sonrisas frescas y aliento saludable", w: 760, h: 848 },
  { foto: "/servicios/fragancia.png", alt: "Fragancia que enamora — aromas suaves y duraderos", w: 756, h: 848 },
  { foto: "/servicios/oidos.png", alt: "Limpieza de oídos — oídos limpios, perrito sano", w: 1320, h: 768 },
  { foto: "/servicios/accesorios.png", alt: "Accesorios — collares, moños y más para tu consentido", w: 748, h: 816 },
];

export function Servicios() {
  return (
    <section id="servicios" className="scroll-mt-20 bg-white px-5 py-16">
      <div className="mx-auto max-w-6xl">
        <Reveal>
          <p className="text-center text-xs font-extrabold uppercase tracking-[0.22em] text-teal-dark">
            Nuestros servicios
          </p>
          <h2 className="mt-2 text-center font-display text-3xl font-extrabold tracking-tight md:text-4xl">
            Todo lo que tu perro necesita
          </h2>
        </Reveal>
        <Reveal className="mt-9">
          <div className="grid grid-cols-2 items-end gap-4 sm:block sm:columns-2 lg:columns-3 [&>a:last-child]:col-span-2 [&>a:nth-child(3n)]:col-span-2 sm:[&>a]:mb-4 sm:[&>a:last-child]:col-span-1 sm:[&>a:nth-child(3n)]:col-span-1">
            {SERVICIOS.map((s) => (
              <a
                key={s.foto}
                href={BOOKING_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="group block break-inside-avoid overflow-hidden rounded-2xl shadow-sm transition-[transform,box-shadow] duration-200 ease-[var(--ease-out-expo)] hover:-translate-y-1 hover:shadow-md active:scale-[.98]"
              >
                <Image
                  src={s.foto}
                  alt={s.alt}
                  width={s.w}
                  height={s.h}
                  className="w-full transition-transform duration-500 ease-[var(--ease-out-expo)] group-hover:scale-[1.02]"
                />
              </a>
            ))}
          </div>
        </Reveal>
      </div>
    </section>
  );
}
