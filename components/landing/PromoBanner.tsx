"use client";

import Image from "next/image";
import { usePromos, type PromoSlot } from "@/lib/promos";
import { Reveal } from "@/components/ui/Reveal";

/* Banner promocional intermedio — renderiza los anuncios que el admin asignó
   a esta posición de la landing. Si no hay ninguno, no ocupa espacio.
   Dos o más artes verticales se muestran lado a lado para comprimir el scroll. */

export function PromoBanner({ slot, id }: { slot: PromoSlot; id?: string }) {
  const promos = usePromos().filter((p) => p.slot === slot);
  if (promos.length === 0) return null;

  const verticales = promos.filter((p) => p.vertical);
  const horizontales = promos.filter((p) => !p.vertical);
  const enPareja = verticales.length > 1;

  const arte = (promo: (typeof promos)[number]) => (
    <Image
      src={promo.img}
      alt={promo.alt}
      width={promo.vertical ? 1086 : 1536}
      height={promo.vertical ? 1448 : 1024}
      unoptimized={!promo.img.startsWith("/")}
      className="w-full rounded-[28px] shadow-[0_2px_16px_rgba(47,62,70,0.1)] transition-transform duration-300 ease-[var(--ease-out-expo)] hover:-translate-y-1"
    />
  );

  return (
    <section id={id} className="scroll-mt-20 bg-cream px-5 py-10">
      <div className="mx-auto flex max-w-6xl flex-col items-center gap-6">
        {horizontales.map((promo) => (
          <Reveal key={promo.id} className="w-full max-w-3xl">
            {arte(promo)}
          </Reveal>
        ))}

        {enPareja ? (
          <div className="grid w-full max-w-4xl grid-cols-1 gap-6 sm:grid-cols-2">
            {verticales.map((promo) => (
              <Reveal key={promo.id}>{arte(promo)}</Reveal>
            ))}
          </div>
        ) : (
          verticales.map((promo) => (
            <Reveal key={promo.id} className="w-full max-w-md">
              {arte(promo)}
            </Reveal>
          ))
        )}
      </div>
    </section>
  );
}
