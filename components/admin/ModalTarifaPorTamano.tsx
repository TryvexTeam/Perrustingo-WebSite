"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  notificarAjustesPrecioActualizados,
  obtenerTodosAjustesPrecio,
  type FilaAjustePrecioAdmin,
  type OverrideTamano,
  type TipoAjuste,
} from "@/lib/ajustesPrecio";
import { guardarAjustesTamanoAction } from "@/app/dashboard/tarifas/actions";
import {
  formatCLP,
  montoDeAjuste,
  TAMANO_LABELS,
  type AjustePrecio,
  type TamanoKey,
} from "@/lib/reserva";
import { CampoValorAjuste } from "./CampoValorAjuste";

/* Modal de agregados por tamaño (PRP-001 Fase 2).

   El costo de un agregado era único para todos los tamaños: desmotar a un
   gigante cobraba el mismo % que a un toy. Acá el admin fija el valor de
   cada agregado PARA ESTE TAMAÑO; lo que no toque sigue heredando el
   valor general, y "Usar el general" borra la excepción.

   La distinción hereda/personalizado es deliberada: un override que
   casualmente vale lo mismo que el general NO es lo mismo que heredar —
   si mañana suben el general, el heredado sube y el override no. */

const CATEGORIA_LABEL: Record<string, string> = {
  pelo: "Recargo por tipo de pelo",
  temperamento: "Recargo por temperamento",
  zona_sensible: "Zonas sensibles",
  cachorro: "Descuento cachorro",
  primera_cita: "Descuento primera cita",
};

const ORDEN_CATEGORIAS = ["pelo", "temperamento", "zona_sensible", "cachorro", "primera_cita"];

interface ModalTarifaPorTamanoProps {
  tamano: TamanoKey;
  /** Precio base del tamaño — para mostrar cuánto suma cada agregado en pesos. */
  precioBase: number;
  onCerrar: () => void;
}

interface FilaModal extends FilaAjustePrecioAdmin {
  /** null = hereda el general (valor y forma de cobro). */
  propio: { tipo: TipoAjuste; pct: number; monto: number | null } | null;
}

export function ModalTarifaPorTamano({
  tamano,
  precioBase,
  onCerrar,
}: ModalTarifaPorTamanoProps) {
  const [filas, setFilas] = useState<FilaModal[]>([]);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");
  const cajaRef = useRef<HTMLDivElement>(null);
  const cerrarRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    let cancelado = false;
    const supabase = createClient();

    Promise.all([
      obtenerTodosAjustesPrecio(supabase),
      supabase
        .from("ajustes_precio_tamano")
        .select("categoria, clave, tamano, pct, tipo, monto")
        .eq("tamano", tamano),
    ]).then(([generales, { data: overrides }]) => {
      if (cancelado) return;
      const propios = (overrides as OverrideTamano[] | null) ?? [];
      setFilas(
        generales.map((g) => {
          const o = propios.find((p) => p.categoria === g.categoria && p.clave === g.clave);
          return {
            ...g,
            propio: o
              ? { tipo: o.tipo ?? "pct", pct: Number(o.pct), monto: o.monto }
              : null,
          };
        })
      );
      setCargando(false);
    });

    return () => {
      cancelado = true;
    };
  }, [tamano]);

  // Foco inicial dentro del modal + cierre con Escape. Sin esto, el teclado
  // queda atrapado detrás del overlay y el modal es inusable sin mouse.
  useEffect(() => {
    cerrarRef.current?.focus();
    const alPresionar = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCerrar();
    };
    window.addEventListener("keydown", alPresionar);
    return () => window.removeEventListener("keydown", alPresionar);
  }, [onCerrar]);

  const actualizar = (categoria: string, clave: string, propio: FilaModal["propio"]) =>
    setFilas((prev) =>
      prev.map((f) => (f.categoria === categoria && f.clave === clave ? { ...f, propio } : f))
    );

  const guardar = async () => {
    setGuardando(true);
    setError("");
    const resultado = await guardarAjustesTamanoAction(
      tamano,
      filas.map((f) => ({
        categoria: f.categoria,
        clave: f.clave,
        // pct null = borrar la excepción, este tamaño vuelve al general.
        pct: f.propio ? f.propio.pct : null,
        tipo: f.propio?.tipo,
        monto: f.propio?.monto,
      }))
    );
    setGuardando(false);
    if (!resultado.success) {
      setError(resultado.error ?? "No se pudo guardar.");
      return;
    }
    // Mismo evento que el resto del panel: los `useAjustesPorTamano()`
    // montados (vista previa, formulario en otra pestaña) recargan solos.
    notificarAjustesPrecioActualizados();
    onCerrar();
  };

  const grupos = ORDEN_CATEGORIAS.map(
    (categoria) => [categoria, filas.filter((f) => f.categoria === categoria)] as const
  ).filter(([, lista]) => lista.length > 0);

  const personalizados = filas.filter((f) => f.propio !== null).length;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 p-0 sm:items-center sm:p-6"
      onMouseDown={(e) => {
        if (!cajaRef.current?.contains(e.target as Node)) onCerrar();
      }}
    >
      <div
        ref={cajaRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="titulo-modal-tamano"
        className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-t-3xl bg-white p-6 shadow-xl sm:rounded-3xl"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-teal-dark">
              Agregados de este tamaño
            </p>
            <h2
              id="titulo-modal-tamano"
              className="mt-1 font-display text-xl font-extrabold text-ink"
            >
              {TAMANO_LABELS[tamano]}
            </h2>
            <p className="mt-1 text-xs text-ink-soft">
              Base {formatCLP(precioBase)} ·{" "}
              {personalizados === 0
                ? "todo hereda los valores generales"
                : `${personalizados} personalizado${personalizados === 1 ? "" : "s"}`}
            </p>
          </div>
          <button
            ref={cerrarRef}
            type="button"
            onClick={onCerrar}
            aria-label="Cerrar"
            className="rounded-full bg-cream px-3 py-2 text-sm font-bold text-ink-soft transition-colors hover:bg-ink/10"
          >
            ✕
          </button>
        </div>

        {error && (
          <div
            role="alert"
            className="mt-4 flex items-center gap-2 rounded-2xl bg-[#fbdbe7] px-4 py-3 text-xs font-semibold text-[#7a1030]"
          >
            <span aria-hidden="true">⚠️</span>
            {error}
          </div>
        )}

        {cargando ? (
          <p role="status" className="py-10 text-center text-sm text-ink-soft">
            ⏳ Cargando agregados…
          </p>
        ) : (
          <div className="mt-5 space-y-6">
            {grupos.map(([categoria, lista]) => (
              <div key={categoria}>
                <h3 className="mb-2 text-sm font-extrabold text-ink">
                  {CATEGORIA_LABEL[categoria] ?? categoria}
                </h3>
                <div className="space-y-2">
                  {lista.map((f) => {
                    const hereda = f.propio === null;
                    const efectivo: AjustePrecio = hereda
                      ? f.tipo === "monto" && f.monto !== null
                        ? { etiqueta: f.etiqueta, pct: f.pct, monto: f.monto }
                        : { etiqueta: f.etiqueta, pct: f.pct }
                      : f.propio!.tipo === "monto"
                        ? { etiqueta: f.etiqueta, pct: f.propio!.pct, monto: f.propio!.monto ?? 0 }
                        : { etiqueta: f.etiqueta, pct: f.propio!.pct };
                    const enPesos = montoDeAjuste(efectivo, precioBase);
                    const campoId = `pct-${f.categoria}-${f.clave}`;
                    // Cómo se ve el valor general, para el botón de volver a él.
                    const textoGeneral =
                      f.tipo === "monto" && f.monto !== null
                        ? formatCLP(f.monto)
                        : `${f.pct}%`;

                    return (
                      <div
                        key={`${f.categoria}-${f.clave}`}
                        className={`rounded-2xl px-4 py-3 ${hereda ? "bg-cream/60" : "bg-cream"}`}
                      >
                        <div className="flex flex-wrap items-center gap-3">
                          <label
                            htmlFor={campoId}
                            className="min-w-0 flex-1 text-sm font-semibold text-ink"
                          >
                            {f.etiqueta}
                            {!f.activo && (
                              <span className="ml-2 text-[11px] font-bold text-ink-soft">
                                (apagado)
                              </span>
                            )}
                          </label>

                          <CampoValorAjuste
                            id={campoId}
                            categoria={f.categoria}
                            tipo={efectivo.monto !== undefined ? "monto" : "pct"}
                            pct={efectivo.pct}
                            monto={efectivo.monto ?? null}
                            disabled={guardando}
                            atenuado={hereda}
                            // Tocar el valor deja de heredar: el override
                            // nace en el momento en que el admin lo edita.
                            onCambiar={(c) => actualizar(f.categoria, f.clave, c)}
                          />
                        </div>

                        <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1">
                          <span className="text-[11px] text-ink-soft">
                            {enPesos >= 0 ? "+" : "−"}
                            {formatCLP(Math.abs(enPesos))} sobre la base
                            {efectivo.monto !== undefined && " (fijo, no escala)"}
                          </span>
                          {hereda ? (
                            <span className="text-[11px] font-bold text-ink-soft">
                              hereda el general ({textoGeneral})
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => actualizar(f.categoria, f.clave, null)}
                              disabled={guardando}
                              className="text-[11px] font-bold text-teal-dark underline underline-offset-2 disabled:opacity-50"
                            >
                              Usar el general ({textoGeneral})
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="mt-7 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={guardar}
            disabled={cargando || guardando}
            className="rounded-full bg-teal px-7 py-3 font-display text-sm font-extrabold text-white shadow-[0_3px_0_rgba(6,58,64,.25)] transition-[background-color,transform,box-shadow] duration-150 hover:bg-teal-dark active:translate-y-0.5 active:shadow-[0_1px_0_rgba(6,58,64,.25)] disabled:cursor-not-allowed disabled:opacity-60 disabled:active:translate-y-0"
          >
            {guardando ? "Guardando…" : "Guardar este tamaño"}
          </button>
          <button
            type="button"
            onClick={onCerrar}
            disabled={guardando}
            className="text-sm font-bold text-ink-soft underline underline-offset-2 disabled:opacity-50"
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}
