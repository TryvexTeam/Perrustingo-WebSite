"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import {
  guardarPromos,
  leerPromos,
  PROMOS_DEFAULT,
  restaurarPromos,
  SLOT_LABELS,
  type Promo,
  type PromoSlot,
} from "@/lib/promos";

/* Gestor de anuncios del admin — asigna cada promo a una posición de la
   landing o la oculta. Los cambios se ven al instante en la web. */

const SLOTS: PromoSlot[] = [
  "tras-servicios",
  "tras-resenas",
  "tras-tamanos",
  "pre-footer",
  "oculto",
];

export function EditorPromos() {
  const [promos, setPromos] = useState<Promo[]>(PROMOS_DEFAULT);
  const [guardado, setGuardado] = useState(false);

  useEffect(() => {
    setPromos(leerPromos());
  }, []);

  const updSlot = (id: string, slot: PromoSlot) => {
    setPromos((prev) => prev.map((p) => (p.id === id ? { ...p, slot } : p)));
    setGuardado(false);
  };

  const guardar = () => {
    guardarPromos(promos);
    setGuardado(true);
  };

  const restaurar = () => {
    restaurarPromos();
    setPromos(PROMOS_DEFAULT);
    setGuardado(true);
  };

  return (
    <div className="rounded-3xl bg-white p-7 shadow-sm">
      <div className="mb-5 flex items-center gap-2 rounded-2xl bg-[#fde4c8] px-4 py-3 text-xs font-semibold text-[#7a4d10]">
        <span aria-hidden="true">📣</span>
        Elige en qué parte de la landing aparece cada anuncio, o márcalo como
        oculto. Los cambios se guardan en este navegador (modo maqueta).
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {promos.map((promo) => (
          <div key={promo.id} className="flex flex-col gap-3 rounded-2xl bg-cream p-4">
            <Image
              src={promo.img}
              alt={promo.alt}
              width={400}
              height={promo.vertical ? 533 : 267}
              className={`w-full rounded-xl object-cover shadow-sm ${promo.vertical ? "max-h-52 object-top" : ""}`}
            />
            <p className="text-sm font-bold leading-tight text-ink">{promo.nombre}</p>
            <select
              value={promo.slot}
              onChange={(e) => updSlot(promo.id, e.target.value as PromoSlot)}
              aria-label={`Posición del anuncio ${promo.nombre}`}
              className="w-full rounded-xl border-2 border-ink/10 bg-white px-3 py-2.5 text-sm font-semibold text-ink focus:border-teal focus:outline-none"
            >
              {SLOTS.map((s) => (
                <option key={s} value={s}>{SLOT_LABELS[s]}</option>
              ))}
            </select>
          </div>
        ))}
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={guardar}
          className="rounded-full bg-teal px-7 py-3 font-display text-sm font-extrabold text-white shadow-[0_3px_0_rgba(6,58,64,.25)] transition-[background-color,transform,box-shadow] duration-150 hover:bg-teal-dark active:translate-y-0.5 active:shadow-[0_1px_0_rgba(6,58,64,.25)]"
        >
          Guardar cambios
        </button>
        <button
          type="button"
          onClick={restaurar}
          className="rounded-full border-2 border-ink/15 px-6 py-3 font-display text-sm font-extrabold text-ink transition-colors hover:border-ink/30"
        >
          Restaurar posiciones originales
        </button>
        {guardado && (
          <span className="text-sm font-bold text-teal-dark">
            ✓ Guardado — la landing ya muestra la nueva distribución
          </span>
        )}
      </div>
    </div>
  );
}
