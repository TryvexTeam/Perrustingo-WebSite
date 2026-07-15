"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import {
  guardarPromos,
  leerPromos,
  PROMOS_DEFAULT,
  restaurarPromos,
  SLOT_LABELS,
  subirImagenPromo,
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
  const [subiendo, setSubiendo] = useState<string | null>(null);
  const [errorSubida, setErrorSubida] = useState<string | null>(null);

  useEffect(() => {
    setPromos(leerPromos());
  }, []);

  const updSlot = (id: string, slot: PromoSlot) => {
    setPromos((prev) => prev.map((p) => (p.id === id ? { ...p, slot } : p)));
    setGuardado(false);
  };

  const subirImagen = async (id: string, file: File | undefined) => {
    if (!file) return;
    setErrorSubida(null);
    setSubiendo(id);
    try {
      const img = await subirImagenPromo(id, file);
      setPromos((prev) => prev.map((p) => (p.id === id ? { ...p, img } : p)));
      setGuardado(false);
    } catch (error: unknown) {
      setErrorSubida(error instanceof Error ? error.message : "Error al subir la imagen.");
    } finally {
      setSubiendo(null);
    }
  };

  const quitarImagen = (id: string) => {
    const original = PROMOS_DEFAULT.find((p) => p.id === id);
    if (!original) return;
    setPromos((prev) => prev.map((p) => (p.id === id ? { ...p, img: original.img } : p)));
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
              unoptimized={!promo.img.startsWith("/")}
              className={`w-full rounded-xl object-cover shadow-sm ${promo.vertical ? "max-h-52 object-top" : ""}`}
            />
            <p className="text-sm font-bold leading-tight text-ink">{promo.nombre}</p>
            <div className="flex flex-wrap items-center gap-2">
              <label className="cursor-pointer rounded-full border-2 border-teal/40 px-4 py-1.5 text-xs font-bold text-teal-dark transition-colors hover:bg-sky/40">
                {subiendo === promo.id ? "Subiendo…" : "📤 Subir imagen"}
                <input
                  type="file"
                  accept="image/*"
                  className="sr-only"
                  disabled={subiendo !== null}
                  onChange={(e) => {
                    subirImagen(promo.id, e.target.files?.[0]);
                    e.target.value = "";
                  }}
                />
              </label>
              {promo.img !== PROMOS_DEFAULT.find((p) => p.id === promo.id)?.img && (
                <button
                  type="button"
                  onClick={() => quitarImagen(promo.id)}
                  className="rounded-full border-2 border-ink/15 px-4 py-1.5 text-xs font-bold text-ink-soft transition-colors hover:border-red-300 hover:text-red-600"
                >
                  Quitar personalizada
                </button>
              )}
            </div>
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

      {errorSubida && (
        <p className="mt-4 rounded-xl bg-red-50 px-4 py-2 text-sm font-semibold text-red-700">
          {errorSubida}
        </p>
      )}

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
