import { Reveal } from "@/components/ui/Reveal";
import { CloudCard, type CloudCardTone } from "@/components/ui/CloudCard";
import { IluSlot } from "@/components/ui/IluSlot";
import { IluCorazon, IluEstrella, IluEtiqueta, IluWhatsApp } from "@/components/ui/Ilustraciones";

const BENEFICIOS: {
  tone: CloudCardTone;
  visual: React.ReactNode;
  titulo: string;
  detalle: string;
}[] = [
  {
    tone: "rose",
    visual: (
      <IluSlot
        src="/ilustraciones/corazon.png"
        alt="Corazón con huella en 3D"
        fallback={<IluCorazon className="h-[74%] w-[74%]" />}
      />
    ),
    titulo: "Atención con cariño",
    detalle: "Tratamos a cada perro como si fuera nuestro.",
  },
  {
    tone: "mint",
    visual: (
      <IluSlot
        src="/ilustraciones/whatsapp.png"
        alt="Burbuja de WhatsApp en 3D"
        fallback={<IluWhatsApp className="h-[74%] w-[74%]" />}
      />
    ),
    titulo: "Aviso por WhatsApp",
    detalle: "Te escribimos cuando tu perro está listo.",
  },
  {
    tone: "peach",
    visual: (
      <IluSlot
        src="/ilustraciones/etiqueta.png"
        alt="Etiqueta de precio en 3D"
        fallback={<IluEtiqueta className="h-[74%] w-[74%]" />}
      />
    ),
    titulo: "Precios claros",
    detalle: "Te confirmamos el precio según tamaño y estado antes de empezar.",
  },
  {
    tone: "sky",
    visual: (
      <IluSlot
        src="/ilustraciones/estrella.png"
        alt="Estrella dorada feliz en 3D"
        fallback={<IluEstrella className="h-[74%] w-[74%]" />}
      />
    ),
    titulo: "4.6 en Google",
    detalle: "Más de 135 familias nos recomiendan.",
  },
];

export function Beneficios() {
  return (
    <section className="bg-blend-white-to-cream px-5 py-14">
      <div className="mx-auto grid max-w-6xl grid-cols-2 gap-4 lg:grid-cols-4 lg:gap-5">
        {BENEFICIOS.map((b, i) => (
          <Reveal key={b.titulo} delay={i * 60} className="h-full">
            <CloudCard tone={b.tone} visual={b.visual} titulo={b.titulo} index={i} compact>
              {b.detalle}
            </CloudCard>
          </Reveal>
        ))}
      </div>
    </section>
  );
}
