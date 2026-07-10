"use client";

import { useEffect, useRef } from "react";
import { SITE } from "@/lib/site";
import { Reveal } from "@/components/ui/Reveal";

interface Resena {
  autor: string;
  texto: string;
  avatarBg: string;
}

const RESENAS: Resena[] = [
  {
    autor: "Daniela Araneda B.",
    avatarBg: "bg-[#58cc02]",
    texto:
      "¡Mi perro quedó hermoso! Es un labrador y el corte quedó parejo, como en ninguna peluquería lo habían dejado antes. Lo llevo hace años, muchas gracias 🫶🏽",
  },
  {
    autor: "Jazmin",
    avatarBg: "bg-[#1cb0f6]",
    texto: "Llevé a mi perrita golden retriever, la dejaron hermosa. Gracias por la atención 💛",
  },
  {
    autor: "Jorge Luis Salinas C.",
    avatarBg: "bg-[#ce82ff]",
    texto:
      "Un muy buen lugar, mi Moana siempre llega limpia y hermosa sin ningún problema. Excelente servicio, full recomendado 🙌🏻",
  },
  {
    autor: "Guister Maldonado",
    avatarBg: "bg-[#ff9600]",
    texto: "¡Excelente servicio! Muy dedicado en su trabajo y preocupado por el bienestar de los perritos 👍🏻👍🏻",
  },
  {
    autor: "Jorge Abarca",
    avatarBg: "bg-[#ff4b4b]",
    texto: "Dejaron a mi perrita irreconocible jajaja, muy linda con sus moñitos que le pusieron. ¡Buen servicio!",
  },
  {
    autor: "Denisse",
    avatarBg: "bg-[#2b70c9]",
    texto: "Muy buena atención, quedó muy regaloneada 🤞✨",
  },
  {
    autor: "Tamara Paillao",
    avatarBg: "bg-[#00cd9c]",
    texto:
      "Gracias por el tiempo y la dedicación para explicar cualquier detalle. Llegué sin expectativas y me sorprendió gratamente. Hoy tienes un nuevo cliente: ¡mi Lucas!",
  },
  {
    autor: "Vannia Brizuela",
    avatarBg: "bg-[#ff86d0]",
    texto:
      "Nuestra perrita viejita estaba en pésimas condiciones y la dejaron hermosa, su pelito bien cortado. Y lo mejor: sin tranquilizantes. ¡Recomendados 1000%!",
  },
  {
    autor: "Marianela Hermosilla",
    avatarBg: "bg-[#8549ba]",
    texto:
      "Llevé a mis regalones Luna y Terry, ambos adultos mayores, y quedaron muy lindos a pesar de que son muy inquietos. Todo un profesional, los trata con cariño.",
  },
  {
    autor: "Krom Arl",
    avatarBg: "bg-[#f7c948]",
    texto: "La atención 10/10, muy amables y realmente hicieron un trabajo increíble. 100% recomendados.",
  },
  {
    autor: "Graziele de Oliveira",
    avatarBg: "bg-[#0fa3b1]",
    texto:
      "Me encantó la preparación que hicieron para el cumpleaños de mi Bê. ¡El mejor servicio de peluquería canina de Chile y Brasil!",
  },
  {
    autor: "Leonardo Riffo",
    avatarBg: "bg-[#e76f51]",
    texto: "La atención y la calidad del servicio brindado es muy buena y recomendable.",
  },
];

function Stars() {
  return (
    <div aria-label="5 estrellas" className="text-orange">
      {"★★★★★"}
    </div>
  );
}

function TarjetaResena({ resena }: { resena: Resena }) {
  return (
    <blockquote className="flex h-full w-80 flex-none flex-col gap-4 rounded-3xl bg-white p-6 shadow-sm">
      <Stars />
      <p className="flex-1 text-sm leading-relaxed text-ink">“{resena.texto}”</p>
      <footer className="flex items-center gap-3 text-sm">
        <span
          aria-hidden="true"
          className={`flex h-11 w-11 items-center justify-center rounded-full border-[3px] border-white ${resena.avatarBg} font-display text-lg font-extrabold text-white shadow-sm`}
        >
          {resena.autor.charAt(0)}
        </span>
        <span>
          <span className="block font-extrabold">{resena.autor}</span>
          <span className="text-ink-soft">Opinión de Google</span>
        </span>
      </footer>
    </blockquote>
  );
}

/* Carrusel deslizable: scroll horizontal nativo (swipe en móvil, rueda o
   arrastre en desktop) + auto-avance infinito que se pausa mientras el
   usuario interactúa y se reanuda solo. */
function CarruselResenas() {
  const ref = useRef<HTMLDivElement>(null);
  const pausado = useRef(false);
  const reanudarTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    let raf = 0;
    const paso = () => {
      if (!pausado.current) {
        el.scrollLeft += 0.6;
        const mitad = el.scrollWidth / 2;
        if (el.scrollLeft >= mitad) el.scrollLeft -= mitad;
      }
      raf = requestAnimationFrame(paso);
    };
    raf = requestAnimationFrame(paso);

    const pausar = () => {
      pausado.current = true;
      if (reanudarTimer.current) clearTimeout(reanudarTimer.current);
    };
    const reanudarLuego = () => {
      if (reanudarTimer.current) clearTimeout(reanudarTimer.current);
      reanudarTimer.current = setTimeout(() => {
        pausado.current = false;
      }, 2500);
    };
    const salir = () => {
      pausado.current = false;
    };

    el.addEventListener("pointerdown", pausar);
    el.addEventListener("pointerup", reanudarLuego);
    el.addEventListener("touchstart", pausar, { passive: true });
    el.addEventListener("touchend", reanudarLuego);
    el.addEventListener("mouseenter", pausar);
    el.addEventListener("mouseleave", salir);
    el.addEventListener("wheel", reanudarLuego, { passive: true });

    return () => {
      cancelAnimationFrame(raf);
      if (reanudarTimer.current) clearTimeout(reanudarTimer.current);
      el.removeEventListener("pointerdown", pausar);
      el.removeEventListener("pointerup", reanudarLuego);
      el.removeEventListener("touchstart", pausar);
      el.removeEventListener("touchend", reanudarLuego);
      el.removeEventListener("mouseenter", pausar);
      el.removeEventListener("mouseleave", salir);
      el.removeEventListener("wheel", reanudarLuego);
    };
  }, []);

  return (
    <div
      ref={ref}
      aria-label="Carrusel de opiniones — desliza para ver más"
      className="mt-10 flex gap-5 overflow-x-auto px-5 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      {[...RESENAS, ...RESENAS].map((resena, i) => (
        <TarjetaResena key={`${resena.autor}-${i}`} resena={resena} />
      ))}
    </div>
  );
}

export function Resenas() {
  return (
    <section id="opiniones" className="scroll-mt-20 overflow-hidden bg-cream py-16">
      <div className="mx-auto max-w-6xl px-5">
        <Reveal>
          <p className="text-center text-xs font-extrabold uppercase tracking-[0.22em] text-teal-dark">
            Opiniones de Google
          </p>
          <h2 className="mt-2 text-center font-display text-3xl font-extrabold tracking-tight md:text-4xl [text-wrap:balance]">
            Más de 135 familias ya nos confiaron a sus regalones
          </h2>
          <div className="mt-4 flex justify-center">
            <a
              href={SITE.mapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-bold text-teal-ink shadow-sm transition-transform duration-150 hover:-translate-y-0.5"
            >
              <span aria-hidden="true" className="text-orange">★</span>
              {SITE.rating} · {SITE.reviewCount} opiniones en Google
            </a>
          </div>
        </Reveal>
      </div>

      <CarruselResenas />
    </section>
  );
}
