import Image from "next/image";
import Link from "next/link";
import { Reveal } from "@/components/ui/Reveal";

interface Servicio {
  /** Ancla — las cards de "¿Qué incluye?" enlazan aquí */
  id: string;
  foto: string;
  alt: string;
  w: number;
  h: number;
  /** Servicio del formulario que se preselecciona al hacer clic */
  servicio?: string;
}

/* Tres columnas explícitas balanceadas por altura real de cada arte.
   La última card de cada columna se estira (flex-1 + object-cover) para que
   las tres columnas cierren exactamente iguales — sin huecos posibles. */
const COLUMNAS: Servicio[][] = [
  [
    { id: "servicio-spa", foto: "/servicios/spa.png", alt: "Día de spa — relajación, mascarillas y mucho mimo", w: 784, h: 844, servicio: "Spa completo" },
    { id: "servicio-bano", foto: "/servicios/bano.png", alt: "Baño relajante — limpieza profunda con amor y cuidado", w: 1948, h: 924, servicio: "Baño completo (sin corte de pelo)" },
    { id: "servicio-corte", foto: "/servicios/corte-estilo.png", alt: "Corte y estilo — el look perfecto para tu mejor amigo", w: 1924, h: 916, servicio: "Baño + corte de pelo" },
    { id: "servicio-secado", foto: "/servicios/secado.png", alt: "Secado profesional con productos de calidad para su pelaje", w: 772, h: 840, servicio: "Solo baño y secado" },
  ],
  [
    { id: "servicio-dental", foto: "/servicios/dental.png", alt: "Limpieza dental — sonrisas frescas y aliento saludable", w: 760, h: 848 },
    { id: "servicio-oidos", foto: "/servicios/oidos.png", alt: "Limpieza de oídos — oídos limpios, perrito sano", w: 1320, h: 768 },
    { id: "servicio-unas", foto: "/servicios/unas.png", alt: "Cuidado de uñas — uñitas sanas, paseos seguros y sin rasguños", w: 1268, h: 760, servicio: "Solo uñas" },
    { id: "servicio-accesorios", foto: "/servicios/accesorios.png", alt: "Accesorios — collares, moños y más para tu consentido", w: 748, h: 816 },
  ],
  [
    { id: "servicio-fragancia", foto: "/servicios/fragancia.png", alt: "Fragancia que enamora — aromas suaves y duraderos", w: 756, h: 848 },
    { id: "servicio-cachorro", foto: "/servicios/cachorro.png", alt: "Corte de cachorro — ternura que se ve y se siente", w: 1264, h: 772, servicio: "Baño + corte de pelo" },
    { id: "servicio-peinado", foto: "/servicios/peinado.png", alt: "Peinado y deslanado — adiós al pelo muerto", w: 1536, h: 1024, servicio: "Spa completo" },
    { id: "servicio-glandulas", foto: "/servicios/glandulas.png", alt: "Higiene completa — drenaje o limpieza de glándulas con delicadeza", w: 1536, h: 1024, servicio: "Baño completo (sin corte de pelo)" },
  ],
];

function urlReserva(servicio?: string): string {
  return servicio ? `/reserva?servicio=${encodeURIComponent(servicio)}` : "/reserva";
}

function CardServicio({ s }: { s: Servicio }) {
  return (
    <Link
      id={s.id}
      href={urlReserva(s.servicio)}
      className="group relative block overflow-hidden rounded-2xl shadow-sm transition-[transform,box-shadow] duration-200 ease-[var(--ease-out-expo)] hover:-translate-y-1 hover:shadow-md active:scale-[.98] lg:last:flex-1"
    >
      <Image
        src={s.foto}
        alt={s.alt}
        width={s.w}
        height={s.h}
        className="h-full w-full object-cover transition-transform duration-500 ease-[var(--ease-out-expo)] group-hover:scale-[1.02]"
      />
      <span className="pointer-events-none absolute bottom-3 right-3 rounded-full bg-white/90 px-3 py-1.5 text-xs font-extrabold text-teal-dark opacity-0 shadow-sm transition-opacity duration-200 group-hover:opacity-100">
        {s.servicio ? "Reservar este servicio →" : "Reservar →"}
      </span>
    </Link>
  );
}

export function Servicios() {
  return (
    <section id="servicios" className="scroll-mt-20 bg-blend-white-to-cream px-5 py-16">
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
          <div className="grid gap-4 lg:grid-cols-3 lg:items-stretch">
            {COLUMNAS.map((columna, c) => (
              <div key={c} className="flex flex-col gap-4">
                {columna.map((s) => (
                  <CardServicio key={s.id} s={s} />
                ))}
              </div>
            ))}
          </div>
        </Reveal>
      </div>
    </section>
  );
}
