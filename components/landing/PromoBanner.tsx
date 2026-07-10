"use client";

import Image from "next/image";
import { usePromos, type PromoSlot } from "@/lib/promos";
import { Reveal } from "@/components/ui/Reveal";

/* Banner promocional intermedio — renderiza el anuncio que el admin asignó
   a esta posición de la landing. Si no hay ninguno, no ocupa espacio. */

export function PromoBanner({ slot, id }: { slot: PromoSlot; id?: string }) {
  const promos = usePromos().filter((p) => p.slot === slot);
  if (promos.length === 0) return null;

  return (
    <section id={id} className="scroll-mt-20 bg-cream px-5 py-10">
      <div className="mx-auto flex max-w-6xl flex-col items-center gap-6">
        {promos.map((promo) => (
          <Reveal key={promo.id} className={promo.vertical ? "w-full max-w-md" : "w-full max-w-3xl"}>
            <Image
              src={promo.img}
              alt={promo.alt}
              width={promo.vertical ? 1086 : 1536}
              height={promo.vertical ? 1448 : 1024}
              className="w-full rounded-[28px] shadow-[0_2px_16px_rgba(47,62,70,0.1)] transition-transform duration-300 ease-[var(--ease-out-expo)] hover:-translate-y-1"
            />
          </Reveal>
        ))}
      </div>
    </section>
  );
}
