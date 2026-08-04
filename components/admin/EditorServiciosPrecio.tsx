"use client";

/* Ajuste de precio por servicio.
 *
 * POR QUÉ EXISTE (4-ago): el precio salía del peso y sus ajustes, y el
 * servicio elegido no lo tocaba. Un "Spa completo" y un "Solo uñas" del mismo
 * perro costaban exactamente lo mismo.
 *
 * DE FÁBRICA NO COBRA NADA: todos los servicios vienen en 0. Es deliberado —
 * inventar nosotros un recargo sería cobrarle de más a clientes reales sin que
 * nadie lo haya decidido. Ver lib/serviciosPrecio.ts y migración 035. */

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  notificarServiciosPrecioActualizados,
  obtenerServiciosPrecio,
  type AjusteServicio,
} from "@/lib/serviciosPrecio";
import { guardarServiciosPrecioAction } from "@/app/dashboard/tarifas/actions";
import { formatCLP } from "@/lib/reserva";

/** Precio de ejemplo para mostrar el efecto: un perro mediano. */
const BASE_EJEMPLO = 28000;

export function EditorServiciosPrecio() {
  const [servicios, setServicios] = useState<AjusteServicio[]>([]);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [guardado, setGuardado] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let vivo = true;
    void (async () => {
      const s = await obtenerServiciosPrecio(createClient());
      if (!vivo) return;
      setServicios(s);
      setCargando(false);
    })();
    return () => {
      vivo = false;
    };
  }, []);

  const sinEfecto = useMemo(
    () => servicios.every((s) => s.pct === 0 && s.monto === 0),
    [servicios]
  );

  function actualizar(slug: string, campo: "pct" | "monto", valor: string) {
    setGuardado(false);
    setServicios((prev) =>
      prev.map((s) => {
        if (s.slug !== slug) return s;
        // Un campo vacío se lee como 0, no como NaN: NaN se propaga al cálculo
        // y convierte un error de tipeo en un precio imposible de diagnosticar.
        const n = valor.trim() === "" ? 0 : Number(valor.replace(",", "."));
        if (!Number.isFinite(n)) return s;
        return campo === "pct" ? { ...s, pct: n } : { ...s, monto: Math.round(n) };
      })
    );
  }

  async function guardar() {
    setGuardando(true);
    setError("");
    setGuardado(false);
    try {
      const r = await guardarServiciosPrecioAction(servicios);
      if (!r.success) {
        // Nunca un fallo mudo: si no se pudo guardar, se dice por qué.
        setError(r.error ?? "No se pudo guardar.");
        return;
      }
      setGuardado(true);
      notificarServiciosPrecioActualizados();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falló la conexión al guardar.");
    } finally {
      setGuardando(false);
    }
  }

  if (cargando) {
    return (
      <section className="rounded-3xl border border-ink/10 bg-white p-6">
        <p className="text-sm text-ink-soft">Cargando servicios…</p>
      </section>
    );
  }

  if (servicios.length === 0) {
    return (
      <section className="rounded-3xl border border-ink/10 bg-white p-6">
        <h2 className="font-display text-xl font-extrabold tracking-tight text-ink">
          Ajuste según el servicio
        </h2>
        <p className="mt-2 text-sm text-ink-soft">
          No hay servicios cargados. Falta aplicar la migración 035 en la base de datos.
        </p>
      </section>
    );
  }

  return (
    <section className="rounded-3xl border border-ink/10 bg-white p-6">
      <h2 className="font-display text-xl font-extrabold tracking-tight text-ink">
        Ajuste según el servicio
      </h2>
      <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-ink-soft">
        Se suma o resta sobre el precio del peso. Un porcentaje y un monto en 0
        significan que ese servicio no cambia el precio. Los valores negativos
        descuentan — un &ldquo;solo uñas&rdquo; puede costar menos que un baño completo.
      </p>

      {/* Que no cobre nada no es un error, pero sí algo que el dueño debe saber
          que está así — si lo configuró y quedó en 0, lo está viendo. */}
      {sinEfecto && (
        <p className="mt-3 rounded-2xl border border-ink/10 bg-cream/70 px-3.5 py-2.5 text-sm text-ink-soft">
          Ahora mismo el servicio <strong>no cambia el precio</strong>: todos están en 0. Así viene
          de fábrica, a propósito. Ponga sus valores cuando los tenga definidos.
        </p>
      )}

      <div className="mt-5 overflow-x-auto">
        <table className="w-full min-w-[560px] border-separate border-spacing-y-1.5 text-left">
          <thead>
            <tr className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-ink-soft">
              <th className="px-3 py-1">Servicio</th>
              <th className="px-3 py-1">Ajuste (%)</th>
              <th className="px-3 py-1">Monto fijo ($)</th>
              <th className="px-3 py-1">Un mediano pagaría</th>
            </tr>
          </thead>
          <tbody>
            {servicios.map((s) => {
              const total = Math.round((BASE_EJEMPLO * (1 + s.pct / 100) + s.monto) / 100) * 100;
              return (
                <tr key={s.slug} className="bg-cream/60">
                  <td className="rounded-l-xl px-3 py-2 text-sm font-bold text-ink">{s.nombre}</td>
                  <td className="px-3 py-2">
                    <input
                      aria-label={`Ajuste porcentual de ${s.nombre}`}
                      inputMode="decimal"
                      value={String(s.pct)}
                      onChange={(e) => actualizar(s.slug, "pct", e.target.value)}
                      className="w-24 rounded-lg border border-ink/15 bg-white px-2.5 py-1.5 text-sm tabular-nums text-ink"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      aria-label={`Monto fijo de ${s.nombre}`}
                      inputMode="numeric"
                      value={String(s.monto)}
                      onChange={(e) => actualizar(s.slug, "monto", e.target.value)}
                      className="w-28 rounded-lg border border-ink/15 bg-white px-2.5 py-1.5 text-sm tabular-nums text-ink"
                    />
                  </td>
                  {/* Qué pagaría de verdad, para no tener que hacer la cuenta
                      mentalmente ni ir al formulario a simular una reserva. */}
                  <td className="rounded-r-xl px-3 py-2 text-sm tabular-nums text-ink-soft">
                    {formatCLP(BASE_EJEMPLO)} → <strong className="text-ink">{formatCLP(total)}</strong>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="mt-3 text-[11px] leading-relaxed text-ink-soft">
        El ejemplo usa {formatCLP(BASE_EJEMPLO)} como base (un perrito mediano). El precio real de
        cada cliente sale de su peso y sus otros ajustes.
      </p>

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => void guardar()}
          disabled={guardando}
          className="rounded-xl bg-teal-dark px-4 py-2.5 text-sm font-extrabold text-white transition hover:opacity-90 disabled:opacity-40"
        >
          {guardando ? "Guardando…" : "Guardar servicios"}
        </button>
        {guardado && <span className="text-sm font-bold text-teal-dark">Guardado.</span>}
        {error && (
          <span role="alert" className="text-sm font-bold text-red-700">
            {error}
          </span>
        )}
      </div>
    </section>
  );
}
