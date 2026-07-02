import { Reveal } from "./Reveal";

const AVISOS = [
  {
    emoji: "🏷️",
    circleBg: "bg-[#fde4c8]",
    titulo: "Precio según tamaño y estado",
    detalle:
      "Calculamos el valor final según el tamaño, el peso y el estado del pelo de tu perro. Te confirmamos el precio antes de empezar.",
  },
  {
    emoji: "🐕‍🦺",
    circleBg: "bg-[#e3f1fb]",
    titulo: "Conducta del perro",
    detalle:
      "Si tu perro se pone nervioso o difícil durante la sesión, podemos aplicar un recargo. Siempre te avisamos con el motivo.",
  },
  {
    emoji: "⏱️",
    circleBg: "bg-[#ece4f7]",
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
              <div className="flex h-full flex-col items-center gap-4 rounded-3xl bg-white p-7 text-center shadow-sm transition-transform duration-200 ease-[var(--ease-out-expo)] hover:-translate-y-1">
                <span
                  aria-hidden="true"
                  className={`flex h-14 w-14 items-center justify-center rounded-full ${aviso.circleBg} text-2xl`}
                >
                  {aviso.emoji}
                </span>
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
