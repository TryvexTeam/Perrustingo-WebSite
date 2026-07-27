"use client";

import { useState } from "react";
import { Reveal } from "@/components/ui/Reveal";

const PREGUNTAS = [
  {
    q: "¿Necesito hacer reserva o puedo llegar sin cita?",
    a: "Trabajamos solo con cita previa para garantizar atención personalizada y sin esperas. Agenda con el formulario de reserva inteligente: te toma un minuto y queda con el precio estimado. Al terminar te ponemos en contacto con nuestra atención al cliente por WhatsApp.",
  },
  {
    q: "¿Cuánto tiempo tarda el servicio?",
    a: "Depende del tamaño y el estado del pelo. Un Mini/Toy puede tomar 1 hora; uno Gigante con pelo enredado puede tomar 3–4 horas. Te avisamos por WhatsApp apenas esté listo.",
  },
  {
    q: "¿Por qué los precios son estimados y pueden variar?",
    a: "El precio de la web es un estimado para que agendes con confianza. El valor final depende del estado real del pelo, el comportamiento y el tamaño, y se confirma en la puerta, siempre antes de comenzar. Además premiamos la constancia: quien viene con frecuencia o que recibe mantención en casa (cepillado, desenredado) requiere menos trabajo, y eso se nota en el precio.",
  },
  {
    q: "¿El precio se puede cambiar el día del servicio?",
    a: "El precio se confirma antes de comenzar, según el tamaño, el peso y el estado real del pelo. Si hay diferencia respecto al estimado, te avisamos primero y no procedemos sin tu aprobación.",
  },
  {
    q: "¿Los cachorros pagan según su peso actual?",
    a: "No siempre. Un cachorro de raza grande (por ejemplo un Pastor Alemán de 6 meses) todavía no alcanza su peso adulto, así que el estimado por peso puede quedar corto. En esos casos usamos la tabla de su raza y ajustamos el valor en puerta según su desarrollo.",
  },
  {
    q: "¿Qué pasa si mi perro o perra no se deja atender?",
    a: "Trabajamos con paciencia y sin sujeción abdominal. Si tiene zonas problemáticas, indícalo en la reserva para prepararnos. En casos muy difíciles puede aplicar un recargo por tiempo adicional, que siempre te comunicamos antes.",
  },
  {
    q: "¿Puedo quedarme durante el servicio?",
    a: "Preferimos que los papás esperen afuera — los perros suelen comportarse mejor cuando su familia no está presente. Puedes esperar en un lugar cercano y te avisamos por WhatsApp apenas puedas venir a buscarlo.",
  },
  {
    q: "¿Atienden perros y perras con problemas de salud?",
    a: "Sí, pero necesitamos saberlo de antemano. Indícanos en la reserva si tiene uñas encarnadas, alergias, problemas de piel u otras condiciones para adaptar los productos y el manejo.",
  },
  {
    q: "¿Con qué productos trabajan?",
    a: "Usamos productos de peluquería canina profesional, hipoalergénicos y aptos para pieles sensibles. Si tienes algún shampú o acondicionador específico en casa, puedes traerlo.",
  },
  {
    q: "¿Tienen estacionamiento?",
    a: "Hay estacionamiento disponible en la calle frente al local. También nos quedan cerca de la Av. Renca y hay locomoción colectiva a pocos metros.",
  },
];

function Item({ q, a, open, onToggle }: { q: string; a: string; open: boolean; onToggle: () => void }) {
  return (
    <div className="border-b border-zinc-100 last:border-0">
      <button
        onClick={onToggle}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-4 py-4 text-left text-[15px] font-semibold text-ink transition-colors hover:text-teal-dark"
      >
        <span>{q}</span>
        <span
          aria-hidden="true"
          className={`shrink-0 text-teal-dark transition-transform duration-200 ${open ? "rotate-45" : ""}`}
        >
          <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
            <path d="M10.75 4.75a.75.75 0 0 0-1.5 0v4.5h-4.5a.75.75 0 0 0 0 1.5h4.5v4.5a.75.75 0 0 0 1.5 0v-4.5h4.5a.75.75 0 0 0 0-1.5h-4.5v-4.5Z" />
          </svg>
        </span>
      </button>
      {open && (
        <p className="pb-4 text-[14px] leading-relaxed text-ink-soft">{a}</p>
      )}
    </div>
  );
}

export function FAQ() {
  const [openIdx, setOpenIdx] = useState<number | null>(null);

  return (
    <section id="faq" className="scroll-mt-20 bg-cream px-5 py-16">
      <div className="mx-auto max-w-3xl">
        <Reveal>
          <p className="text-center text-xs font-extrabold uppercase tracking-[0.22em] text-teal-dark">
            Preguntas frecuentes
          </p>
          <h2 className="mt-2 text-center font-display text-3xl font-extrabold tracking-tight md:text-4xl">
            Todo lo que necesitas saber
          </h2>
        </Reveal>

        <Reveal delay={60} className="mt-10">
          <div className="rounded-3xl bg-white px-6 py-2 shadow-sm">
            {PREGUNTAS.map((item, i) => (
              <Item
                key={i}
                q={item.q}
                a={item.a}
                open={openIdx === i}
                onToggle={() => setOpenIdx(openIdx === i ? null : i)}
              />
            ))}
          </div>
        </Reveal>
      </div>
    </section>
  );
}
