"use client";

import Image from "next/image";
import { useState } from "react";
import {
  idDesdeNombre,
  SLOTS,
  SLOT_LABELS,
  type Promo,
  type PromoSlot,
} from "@/lib/promos";
import { subirImagenPromo } from "@/lib/promosUpload";
import {
  crearPromoAction,
  eliminarPromoAction,
  guardarPromosAction,
} from "@/app/dashboard/anuncios/actions";

/* Gestor de anuncios del admin — posición en la landing, orden, textos e
   imagen. Todo persiste en la tabla `promos` (migración 011), así que un
   cambio hecho acá se ve en cualquier dispositivo; antes vivía en el
   localStorage del navegador que lo hizo.

   Los anuncios llegan por props desde la página (server): esta lista es el
   borrador editable, y "Guardar" lo manda completo. */

interface EditorPromosProps {
  promosIniciales: Promo[];
}

const ALT_NUEVO =
  "Describa la imagen para quien no puede verla — es lo que lee un lector de pantalla.";

export function EditorPromos({ promosIniciales }: EditorPromosProps) {
  const [promos, setPromos] = useState<Promo[]>(promosIniciales);
  const [guardando, setGuardando] = useState(false);
  const [guardado, setGuardado] = useState(false);
  const [subiendo, setSubiendo] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [porConfirmar, setPorConfirmar] = useState<string | null>(null);

  const actualizar = (id: string, cambios: Partial<Promo>) => {
    setPromos((prev) => prev.map((p) => (p.id === id ? { ...p, ...cambios } : p)));
    setGuardado(false);
  };

  const subirImagen = async (id: string, file: File | undefined) => {
    if (!file) return;
    setError("");
    setSubiendo(id);
    try {
      const img = await subirImagenPromo(id, file);
      actualizar(id, { img });
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error al subir la imagen.");
    } finally {
      setSubiendo(null);
    }
  };

  const mover = (id: string, direccion: -1 | 1) => {
    const promo = promos.find((p) => p.id === id);
    if (!promo) return;
    // El orden es dentro del slot: mover un anuncio no debe reordenar los de
    // otra posición de la landing.
    const hermanos = promos
      .filter((p) => p.slot === promo.slot)
      .sort((a, b) => a.orden - b.orden);
    const i = hermanos.findIndex((p) => p.id === id);
    const j = i + direccion;
    if (j < 0 || j >= hermanos.length) return;

    const reordenados = [...hermanos];
    [reordenados[i], reordenados[j]] = [reordenados[j], reordenados[i]];
    setPromos((prev) =>
      prev.map((p) => {
        const nuevo = reordenados.findIndex((r) => r.id === p.id);
        return nuevo === -1 ? p : { ...p, orden: nuevo };
      })
    );
    setGuardado(false);
  };

  const guardar = async () => {
    setGuardando(true);
    setError("");
    const resultado = await guardarPromosAction(promos);
    setGuardando(false);
    if (!resultado.success) {
      setError(resultado.error ?? "No se pudo guardar.");
      return;
    }
    setGuardado(true);
  };

  const crear = async () => {
    setGuardando(true);
    setError("");
    const nombre = "Anuncio nuevo";
    const nuevo: Promo = {
      id: idDesdeNombre(nombre),
      nombre,
      // Arte de arranque para que la fila no nazca sin imagen (la tabla la
      // exige); el admin sube la suya enseguida.
      img: "/promos/recomendaciones.png",
      alt: ALT_NUEVO,
      vertical: true,
      slot: "oculto",
      orden: promos.filter((p) => p.slot === "oculto").length,
    };
    const resultado = await crearPromoAction(nuevo);
    setGuardando(false);
    if (!resultado.success) {
      setError(resultado.error ?? "No se pudo crear.");
      return;
    }
    setPromos((prev) => [...prev, nuevo]);
    setGuardado(false);
  };

  const eliminar = async (id: string) => {
    setGuardando(true);
    setError("");
    const resultado = await eliminarPromoAction(id);
    setGuardando(false);
    setPorConfirmar(null);
    if (!resultado.success) {
      setError(resultado.error ?? "No se pudo eliminar.");
      return;
    }
    setPromos((prev) => prev.filter((p) => p.id !== id));
  };

  const bloqueado = guardando || subiendo !== null;

  return (
    <div className="rounded-3xl bg-white p-7 shadow-sm">
      <div className="mb-5 flex items-center gap-2 rounded-2xl bg-[#d5efe2] px-4 py-3 text-xs font-semibold text-teal-dark">
        <span aria-hidden="true">🌐</span>
        Guardado en la base de datos — la landing lo muestra igual en todos los
        dispositivos, no solo en este navegador.
      </div>

      {error && (
        <div
          role="alert"
          className="mb-5 flex items-center gap-2 rounded-2xl bg-[#fbdbe7] px-4 py-3 text-xs font-semibold text-[#7a1030]"
        >
          <span aria-hidden="true">⚠️</span>
          {error}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        {promos.map((promo) => {
          const hermanos = promos
            .filter((p) => p.slot === promo.slot)
            .sort((a, b) => a.orden - b.orden);
          const posicion = hermanos.findIndex((p) => p.id === promo.id);

          return (
            <div key={promo.id} className="flex flex-col gap-3 rounded-2xl bg-cream p-4">
              <Image
                src={promo.img}
                alt={promo.alt}
                width={400}
                height={promo.vertical ? 533 : 267}
                unoptimized={!promo.img.startsWith("/")}
                className={`w-full rounded-xl object-cover shadow-sm ${
                  promo.vertical ? "max-h-52 object-top" : ""
                }`}
              />

              <label htmlFor={`nombre-${promo.id}`} className="sr-only">
                Nombre del anuncio
              </label>
              <input
                id={`nombre-${promo.id}`}
                type="text"
                value={promo.nombre}
                onChange={(e) => actualizar(promo.id, { nombre: e.target.value })}
                disabled={bloqueado}
                maxLength={80}
                className="rounded-xl border-2 border-transparent bg-white px-3 py-2 text-sm font-bold text-ink focus:border-teal focus:outline-none disabled:opacity-50"
              />

              <label
                htmlFor={`alt-${promo.id}`}
                className="text-[11px] font-extrabold uppercase tracking-wider text-ink-soft"
              >
                Texto alternativo
              </label>
              <textarea
                id={`alt-${promo.id}`}
                value={promo.alt}
                onChange={(e) => actualizar(promo.id, { alt: e.target.value })}
                disabled={bloqueado}
                maxLength={300}
                rows={2}
                className="rounded-xl border-2 border-transparent bg-white px-3 py-2 text-xs text-ink focus:border-teal focus:outline-none disabled:opacity-50"
              />

              <div className="flex flex-wrap items-center gap-2">
                <label className="cursor-pointer rounded-full border-2 border-teal/40 px-4 py-1.5 text-xs font-bold text-teal-dark transition-colors hover:bg-sky/40">
                  {subiendo === promo.id ? "Subiendo…" : "📤 Subir imagen"}
                  <input
                    type="file"
                    accept="image/*"
                    className="sr-only"
                    disabled={bloqueado}
                    onChange={(e) => {
                      subirImagen(promo.id, e.target.files?.[0]);
                      e.target.value = "";
                    }}
                  />
                </label>

                <label className="flex items-center gap-1.5 text-xs font-bold text-ink-soft">
                  <input
                    type="checkbox"
                    checked={promo.vertical}
                    onChange={(e) => actualizar(promo.id, { vertical: e.target.checked })}
                    disabled={bloqueado}
                    className="h-4 w-4 accent-teal-dark"
                  />
                  Arte vertical
                </label>
              </div>

              <label htmlFor={`slot-${promo.id}`} className="sr-only">
                Posición del anuncio {promo.nombre}
              </label>
              <select
                id={`slot-${promo.id}`}
                value={promo.slot}
                onChange={(e) =>
                  actualizar(promo.id, { slot: e.target.value as PromoSlot, orden: 0 })
                }
                disabled={bloqueado}
                className="w-full rounded-xl border-2 border-ink/10 bg-white px-3 py-2.5 text-sm font-semibold text-ink focus:border-teal focus:outline-none disabled:opacity-50"
              >
                {SLOTS.map((s) => (
                  <option key={s} value={s}>
                    {SLOT_LABELS[s]}
                  </option>
                ))}
              </select>

              <div className="flex flex-wrap items-center gap-2">
                {hermanos.length > 1 && (
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => mover(promo.id, -1)}
                      disabled={bloqueado || posicion === 0}
                      aria-label={`Subir ${promo.nombre} en su posición`}
                      className="rounded-full bg-white px-2.5 py-1 text-xs font-bold text-teal-dark disabled:opacity-30"
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      onClick={() => mover(promo.id, 1)}
                      disabled={bloqueado || posicion === hermanos.length - 1}
                      aria-label={`Bajar ${promo.nombre} en su posición`}
                      className="rounded-full bg-white px-2.5 py-1 text-xs font-bold text-teal-dark disabled:opacity-30"
                    >
                      ↓
                    </button>
                    <span className="text-[11px] font-bold text-ink-soft">
                      {posicion + 1} de {hermanos.length}
                    </span>
                  </div>
                )}

                {porConfirmar === promo.id ? (
                  <span className="ml-auto flex items-center gap-2 text-xs font-bold text-[#7a1030]">
                    ¿Eliminar?
                    <button
                      type="button"
                      onClick={() => eliminar(promo.id)}
                      disabled={bloqueado}
                      className="rounded-full bg-[#fbdbe7] px-3 py-1 font-bold text-[#7a1030] disabled:opacity-50"
                    >
                      Sí, eliminar
                    </button>
                    <button
                      type="button"
                      onClick={() => setPorConfirmar(null)}
                      className="underline underline-offset-2 text-ink-soft"
                    >
                      No
                    </button>
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => setPorConfirmar(promo.id)}
                    disabled={bloqueado}
                    className="ml-auto text-xs font-bold text-ink-soft underline underline-offset-2 hover:text-[#7a1030] disabled:opacity-50"
                  >
                    Eliminar
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={guardar}
          disabled={bloqueado}
          className="rounded-full bg-teal px-7 py-3 font-display text-sm font-extrabold text-white shadow-[0_3px_0_rgba(6,58,64,.25)] transition-[background-color,transform,box-shadow] duration-150 hover:bg-teal-dark active:translate-y-0.5 active:shadow-[0_1px_0_rgba(6,58,64,.25)] disabled:cursor-not-allowed disabled:opacity-60 disabled:active:translate-y-0"
        >
          {guardando ? "Guardando…" : "Guardar cambios"}
        </button>
        <button
          type="button"
          onClick={crear}
          disabled={bloqueado}
          className="rounded-full border-2 border-ink/15 px-6 py-3 font-display text-sm font-extrabold text-ink transition-colors hover:border-ink/30 disabled:cursor-not-allowed disabled:opacity-60"
        >
          + Anuncio nuevo
        </button>
        {guardado && !guardando && (
          <span className="text-sm font-bold text-teal-dark">
            ✓ Guardado — la landing ya muestra la nueva distribución
          </span>
        )}
      </div>
    </div>
  );
}
