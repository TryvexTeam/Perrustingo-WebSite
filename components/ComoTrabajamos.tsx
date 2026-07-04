import { Flotantes } from "./Flotantes";
import { Reveal } from "./Reveal";
import { CloudCard, type CloudCardTone } from "./ui/CloudCard";
import { IluSlot } from "./ui/IluSlot";
import { IluCachorro, IluCasa, IluPluma } from "./ui/Ilustraciones";

const PILARES: {
  tone: CloudCardTone;
  visual: React.ReactNode;
  titulo: React.ReactNode;
  detalle: React.ReactNode;
}[] = [
  {
    tone: "sky",
    visual: (
      <IluSlot
        src="/ilustraciones/casa.png"
        alt="Casita acogedora en 3D"
        fallback={<IluCasa className="h-[74%] w-[74%]" />}
      />
    ),
    titulo: (
      <>
        Atención en
        <br />
        nuestro hogar
      </>
    ),
    detalle: (
      <>
        Atendemos en un domicilio particular acondicionado según los últimos
        estándares técnicos. Trabajamos solo con cita previa, así encontramos
        un horario conveniente y ni tú ni tu perro tienen que esperar.
      </>
    ),
  },
  {
    tone: "rose",
    visual: (
      <IluSlot
        src="/ilustraciones/pluma.png"
        alt="Pluma suave lavanda en 3D"
        fallback={<IluPluma className="h-[72%] w-[72%]" />}
      />
    ),
    titulo: (
      <>
        Libertad y
        <br />
        cero estrés
      </>
    ),
    detalle: (
      <>
        No usamos jaula de secado, brazo de sujeción ni correa abdominal. Tu
        perro no tiene que estar sujeto y quieto todo el tiempo:{" "}
        <strong className="font-bold text-ink">
          tiene total libertad para moverse y sentarse.
        </strong>
      </>
    ),
  },
  {
    tone: "lilac",
    visual: (
      <IluSlot
        src="/ilustraciones/cachorro.png"
        alt="Cachorro feliz en 3D"
        fallback={<IluCachorro className="h-[80%] w-[80%]" />}
      />
    ),
    titulo: (
      <>
        Familiarización
        <br />
        para cachorros
      </>
    ),
    detalle: (
      <>
        Presentamos de forma lúdica el cepillo, la bañera, la mesa, el secador
        y la máquina, y acostumbramos a tu cachorro a que le toquen las patas,
        el hocico y la cara. Así sus visitas crecen sin miedo ni estrés.
      </>
    ),
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
        <div className="mt-10 grid gap-6 md:grid-cols-3">
          {PILARES.map((pilar, i) => (
            <Reveal key={i} delay={i * 70} className="h-full">
              <CloudCard tone={pilar.tone} visual={pilar.visual} titulo={pilar.titulo} index={i}>
                {pilar.detalle}
              </CloudCard>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
