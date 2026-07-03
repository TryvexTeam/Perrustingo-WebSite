import { Reveal } from "./Reveal";

const PROXIMOS = [
  {
    emoji: "🏠",
    titulo: "Perrustingo a domicilio",
    descripcion:
      "Pronto llevaremos el spa canino hasta donde tú estás. Tu perro, mimado sin salir de casa.",
    bg: "bg-[#fde4c8]",
    circleBg: "bg-[#fcd5a0]",
  },
  {
    emoji: "🚗",
    titulo: "Servicio de retiro y entrega",
    descripcion:
      "Recogemos a tu perro en tu dirección y lo devolvemos listo, limpio y feliz.",
    bg: "bg-[#e3f1fb]",
    circleBg: "bg-[#b6d9f5]",
  },
  {
    emoji: "⭐",
    titulo: "Recomendaciones",
    descripcion:
      "Consejos, productos y rutinas de cuidado para mantener a tu perro perfecto entre visitas.",
    bg: "bg-[#d8f0e3]",
    circleBg: "bg-[#a3d9bc]",
  },
];

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

        <div className="mt-10 grid gap-5 md:grid-cols-3">
          {PROXIMOS.map((item, i) => (
            <Reveal key={item.titulo} delay={i * 80}>
              <div
                className={`relative flex h-full flex-col items-center gap-4 overflow-hidden rounded-3xl ${item.bg} p-7 text-center`}
              >
                <span className="absolute right-4 top-4 rounded-full bg-white/80 px-3 py-1 text-[10px] font-extrabold uppercase tracking-wider text-ink-soft">
                  Próximamente
                </span>
                <span
                  aria-hidden="true"
                  className={`flex h-14 w-14 items-center justify-center rounded-full ${item.circleBg} text-2xl`}
                >
                  {item.emoji}
                </span>
                <h3 className="font-display text-base font-bold text-ink">{item.titulo}</h3>
                <p className="text-sm leading-relaxed text-ink-soft">{item.descripcion}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
