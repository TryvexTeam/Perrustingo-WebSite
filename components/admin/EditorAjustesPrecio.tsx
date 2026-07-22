"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  notificarAjustesPrecioActualizados,
  obtenerTodosAjustesPrecio,
  type FilaAjustePrecioAdmin,
} from "@/lib/ajustesPrecio";
import { guardarAjustesPrecioAction } from "@/app/dashboard/tarifas/actions";

/* Editor de recargos/descuentos del formulario — antes fijos en código
   (lib/reserva.ts), ahora en la tabla `ajustes_precio` (migración 007).
   La clave (categoria+clave) NUNCA se edita acá — solo pct/etiqueta/activo,
   reforzado además por GRANT de columna en Postgres. */

const CATEGORIA_LABEL: Record<string, string> = {
  pelo: "Recargo por tipo de pelo",
  temperamento: "Recargo por temperamento",
  zona_sensible: "Zonas sensibles",
  cachorro: "Descuento cachorro",
  primera_cita: "Descuento primera cita",
};

const ORDEN_CATEGORIAS = ["pelo", "temperamento", "zona_sensible", "cachorro", "primera_cita"];

function agrupar(filas: FilaAjustePrecioAdmin[]): [string, FilaAjustePrecioAdmin[]][] {
  const grupos = new Map<string, FilaAjustePrecioAdmin[]>();
  for (const f of filas) {
    const lista = grupos.get(f.categoria) ?? [];
    lista.push(f);
    grupos.set(f.categoria, lista);
  }
  return ORDEN_CATEGORIAS.filter((c) => grupos.has(c)).map((c) => [c, grupos.get(c)!]);
}

export function EditorAjustesPrecio() {
  const [filas, setFilas] = useState<FilaAjustePrecioAdmin[]>([]);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [guardado, setGuardado] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelado = false;
    obtenerTodosAjustesPrecio(createClient()).then((f) => {
      if (!cancelado) {
        setFilas(f);
        setCargando(false);
      }
    });
    return () => {
      cancelado = true;
    };
  }, []);

  const actualizar = (
    categoria: string,
    clave: string,
    cambios: Partial<Pick<FilaAjustePrecioAdmin, "pct" | "etiqueta" | "activo">>
  ) => {
    setFilas((prev) =>
      prev.map((f) =>
        f.categoria === categoria && f.clave === clave ? { ...f, ...cambios } : f
      )
    );
    setGuardado(false);
  };

  const guardar = async () => {
    setGuardando(true);
    setError("");
    const resultado = await guardarAjustesPrecioAction(filas);
    setGuardando(false);
    if (!resultado.success) {
      setError(resultado.error ?? "No se pudo guardar.");
      return;
    }
    notificarAjustesPrecioActualizados();
    setGuardado(true);
  };

  return (
    <div className="rounded-3xl bg-white p-7 shadow-sm">
      {cargando ? (
        <div role="status" className="mb-5 flex items-center gap-2 rounded-2xl bg-cream px-4 py-3 text-xs font-semibold text-ink-soft">
          <span aria-hidden="true">⏳</span>
          Cargando recargos y descuentos…
        </div>
      ) : (
        <div className="mb-5 flex items-center gap-2 rounded-2xl bg-[#d5efe2] px-4 py-3 text-xs font-semibold text-teal-dark">
          <span aria-hidden="true">🌐</span>
          Se aplican al instante en el formulario de reserva.
        </div>
      )}
      {error && (
        <div role="alert" className="mb-5 flex items-center gap-2 rounded-2xl bg-[#fbdbe7] px-4 py-3 text-xs font-semibold text-[#7a1030]">
          <span aria-hidden="true">⚠️</span>
          {error}
        </div>
      )}

      <h2 className="font-display text-lg font-extrabold text-ink">
        Recargos y descuentos del formulario
      </h2>
      <p className="mt-1 text-xs text-ink-soft">
        Se suman todos entre sí sobre el precio base (no se multiplican en
        cadena). Apagá uno para que deje de aplicarse sin borrarlo.
      </p>

      <div className="mt-5 space-y-6">
        {agrupar(filas).map(([categoria, filasCategoria]) => (
          <div key={categoria}>
            <h3 className="mb-2 text-sm font-extrabold text-ink">
              {CATEGORIA_LABEL[categoria] ?? categoria}
            </h3>
            <div className="space-y-2">
              {filasCategoria.map((f) => {
                const esTope = f.categoria === "zona_sensible" && f.clave === "tope";
                if (esTope) {
                  // El tope es un LÍMITE, no un recargo — apagarlo no "no
                  // cobra el tope", significa que el recargo por zonas
                  // queda sin techo. No lleva checkbox a propósito.
                  return (
                    <div
                      key={`${f.categoria}-${f.clave}`}
                      className="rounded-2xl border-2 border-dashed border-ink/15 bg-white px-4 py-3"
                    >
                      <div className="flex flex-wrap items-center gap-3">
                        <input
                          type="text"
                          value={f.etiqueta}
                          onChange={(e) => actualizar(f.categoria, f.clave, { etiqueta: e.target.value })}
                          disabled={cargando || guardando}
                          maxLength={60}
                          className="min-w-0 flex-1 rounded-xl border-2 border-transparent bg-cream px-2.5 py-1.5 text-sm font-semibold text-ink focus:border-teal focus:outline-none disabled:opacity-50"
                        />
                        <div className="ml-auto flex items-center gap-1.5">
                          <input
                            type="number"
                            value={f.pct}
                            onChange={(e) =>
                              actualizar(f.categoria, f.clave, { pct: parseFloat(e.target.value) || 0, activo: true })
                            }
                            disabled={cargando || guardando}
                            className="w-20 rounded-xl border-2 border-white bg-cream px-2.5 py-1.5 text-right text-sm font-extrabold text-ink focus:border-teal focus:outline-none disabled:opacity-50"
                          />
                          <span className="text-sm font-bold text-ink-soft">%</span>
                        </div>
                      </div>
                      <p className="mt-1.5 text-[11px] leading-relaxed text-ink-soft">
                        No es un recargo — es el máximo que puede sumar el
                        recargo por zonas, sin importar cuántas se marquen.
                      </p>
                    </div>
                  );
                }
                return (
                <div
                  key={`${f.categoria}-${f.clave}`}
                  className={`flex flex-wrap items-center gap-3 rounded-2xl px-4 py-3 transition-opacity ${
                    f.activo ? "bg-cream" : "bg-cream/50 opacity-60"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={f.activo}
                    onChange={(e) => actualizar(f.categoria, f.clave, { activo: e.target.checked })}
                    disabled={cargando || guardando}
                    className="h-4 w-4 flex-none accent-teal-dark"
                    aria-label={`Activar ${f.etiqueta}`}
                  />
                  <input
                    type="text"
                    value={f.etiqueta}
                    onChange={(e) => actualizar(f.categoria, f.clave, { etiqueta: e.target.value })}
                    disabled={cargando || guardando}
                    maxLength={60}
                    className="min-w-0 flex-1 rounded-xl border-2 border-transparent bg-white/70 px-2.5 py-1.5 text-sm font-semibold text-ink focus:border-teal focus:outline-none disabled:opacity-50"
                  />
                  <div className="ml-auto flex items-center gap-1.5">
                    <input
                      type="number"
                      value={f.pct}
                      onChange={(e) =>
                        actualizar(f.categoria, f.clave, { pct: parseFloat(e.target.value) || 0 })
                      }
                      disabled={cargando || guardando}
                      className="w-20 rounded-xl border-2 border-white bg-white px-2.5 py-1.5 text-right text-sm font-extrabold text-ink focus:border-teal focus:outline-none disabled:opacity-50"
                    />
                    <span className="text-sm font-bold text-ink-soft">%</span>
                  </div>
                </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-7 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={guardar}
          disabled={cargando || guardando}
          className="rounded-full bg-teal px-7 py-3 font-display text-sm font-extrabold text-white shadow-[0_3px_0_rgba(6,58,64,.25)] transition-[background-color,transform,box-shadow] duration-150 hover:bg-teal-dark active:translate-y-0.5 active:shadow-[0_1px_0_rgba(6,58,64,.25)] disabled:cursor-not-allowed disabled:opacity-60 disabled:active:translate-y-0"
        >
          {guardando ? "Guardando…" : "Guardar cambios"}
        </button>
        {guardado && !guardando && (
          <span className="text-sm font-bold text-teal-dark">
            ✓ Guardado — el formulario ya usa estos valores
          </span>
        )}
      </div>
    </div>
  );
}
