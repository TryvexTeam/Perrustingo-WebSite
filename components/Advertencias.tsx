import Image from "next/image";
import { Reveal } from "./Reveal";

const AVISOS = [
  {
    foto: "/cards/card-precio.png",
    titulo: "Precio según tamaño y estado",
    detalle:
      "Calculamos el valor final según el tamaño, el peso y el estado del pelo de tu perro. Te confirmamos el precio antes de empezar.",
  },
  {
    foto: "/cards/card-conducta.png",
    titulo: "Conducta del perro",
    detalle:
      "Si tu perro se pone nervioso o difícil durante la sesión, podemos aplicar un recargo. Siempre te avisamos con el motivo.",
  },
  {
    foto: "/cards/card-tiempos.png",
    titulo: "Tiempos de trabajo",
    detalle:
      "Nos tomamos entre 2 y 3 horas en promedio por sesión completa. Trabajamos con calma para que tu perro no lo pase mal.",
  },
];

export function Advertencias() {
  return (
    <section id="advertencias" className="scroll-mt-20 bg-cream px-5 pb-16">
      <div className="mx-auto max-w-6xl">
        <Reveal>
          <p className="text-center text-xs font-extrabold uppercase tracking-[0.22em] text-teal-dark">
            Transparencia
          </p>
          <h2 className="mt-2 text-center font-display text-3xl font-extrabold tracking-tight md:text-4xl">
            Antes de reservar, ten en cuenta
          </h2>
        </Reveal>
        <div className="mt-10 grid gap-5 md:grid-cols-3">
          {AVISOS.map((aviso, i) => (
            <Reveal key={aviso.titulo} delay={i * 70}>
              <div className="tilt-card flex h-full flex-col items-center gap-4 overflow-hidden rounded-3xl bg-white p-7 pt-0 text-center shadow-sm">
                <Image
                  src={aviso.foto}
                  alt=""
                  aria-hidden="true"
                  width={640}
                  height={480}
                  className="-mx-7 w-[calc(100%+3.5rem)] max-w-none object-cover"
                />
                <h3 className="font-display text-base font-bold">{aviso.titulo}</h3>
                <p className="text-sm leading-relaxed text-ink-soft">{aviso.detalle}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
