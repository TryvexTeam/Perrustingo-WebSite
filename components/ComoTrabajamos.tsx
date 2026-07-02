import { Flotantes } from "./Flotantes";
import { Reveal } from "./Reveal";

const PILARES = [
  {
    emoji: "🏡",
    circleBg: "bg-[#fde4c8]",
    titulo: "Atención en nuestro hogar",
    detalle:
      "Atendemos en un domicilio particular acondicionado según los últimos estándares técnicos. Trabajamos solo con cita previa, así encontramos un horario conveniente y ni tú ni tu perro tienen que esperar.",
  },
  {
    emoji: "🕊️",
    circleBg: "bg-[#e3f1fb]",
    titulo: "Libertad y cero estrés",
    detalle:
      "No usamos jaula de secado, brazo de sujeción ni correa abdominal. Tu perro no tiene que estar sujeto y quieto todo el tiempo: tiene total libertad para moverse y sentarse.",
  },
  {
    emoji: "🐶",
    circleBg: "bg-[#fdeaf1]",
    titulo: "Familiarización para cachorros",
    detalle:
      "Presentamos de forma lúdica el cepillo, la bañera, la mesa, el secador y la máquina, y acostumbramos a tu cachorro a que le toquen las patas, el hocico y la cara. Así sus visitas crecen sin miedo ni estrés.",
  },
];

export function ComoTrabajamos() {
  return (
    <section id="como-trabajamos" className="relative scroll-mt-20 overflow-hidden bg-cream px-5 py-16">
      <Flotantes />
      <div className="relative mx-auto max-w-6xl">
        <Reveal>
          <p className="text-center text-xs font-extrabold uppercase tracking-[0.22em] text-teal-dark">
            Así trabajamos
          </p>
          <h2 className="mt-2 text-center font-display text-3xl font-extrabold tracking-tight md:text-4xl">
            Queremos que tu perro espere con ilusión su visita
          </h2>
        </Reveal>
        <div className="mt-10 grid gap-5 md:grid-cols-3">
          {PILARES.map((pilar, i) => (
            <Reveal key={pilar.titulo} delay={i * 70}>
              <div className="flex h-full flex-col items-center gap-4 rounded-3xl bg-white p-7 text-center shadow-sm transition-transform duration-200 ease-[var(--ease-out-expo)] hover:-translate-y-1">
                <span
                  aria-hidden="true"
                  className={`flex h-14 w-14 items-center justify-center rounded-full ${pilar.circleBg} text-2xl`}
                >
                  {pilar.emoji}
                </span>
                <h3 className="font-display text-base font-bold">{pilar.titulo}</h3>
                <p className="text-sm leading-relaxed text-ink-soft">{pilar.detalle}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
