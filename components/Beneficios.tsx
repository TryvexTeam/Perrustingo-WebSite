import { Reveal } from "./Reveal";

const BENEFICIOS = [
  {
    emoji: "🐾",
    circleBg: "bg-[#fdeaf1]",
    titulo: "Atención con cariño",
    detalle: "Tratamos a cada perro como si fuera nuestro.",
  },
  {
    emoji: "💬",
    circleBg: "bg-[#e3f1fb]",
    titulo: "Aviso por WhatsApp",
    detalle: "Te escribimos cuando tu perro está listo.",
  },
  {
    emoji: "🏷️",
    circleBg: "bg-[#fde4c8]",
    titulo: "Precios claros",
    detalle: "Te confirmamos el precio según tamaño y estado antes de empezar.",
  },
  {
    emoji: "⭐",
    circleBg: "bg-[#ece4f7]",
    titulo: "4.6 en Google",
    detalle: "Más de 135 familias nos recomiendan.",
  },
];

export function Beneficios() {
  return (
    <section className="bg-white px-5 py-14">
      <div className="mx-auto grid max-w-6xl gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {BENEFICIOS.map((b, i) => (
          <Reveal key={b.titulo} delay={i * 60}>
            <div className="flex h-full items-start gap-4 rounded-3xl bg-cream p-6 transition-transform duration-200 ease-[var(--ease-out-expo)] hover:-translate-y-1">
              <span
                aria-hidden="true"
                className={`flex h-12 w-12 flex-none items-center justify-center rounded-full ${b.circleBg} text-xl`}
              >
                {b.emoji}
              </span>
              <div>
                <h3 className="font-display text-sm font-extrabold">{b.titulo}</h3>
                <p className="mt-1 text-sm leading-relaxed text-ink-soft">{b.detalle}</p>
              </div>
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  );
}
