"use client";

/* Editor de ajuste de precio por altura.
 *
 * POR QUÉ EXISTE (pedido del 4-ago): el formulario ya le preguntaba la altura
 * al cliente y no hacía nada con ella. Dos perros de 10 kg no dan el mismo
 * trabajo si uno es alto y delgado y el otro bajo y compacto.
 *
 * Mismo modelo que los tramos de peso: cada franja declara solo DESDE qué
 * altura rige y el "hasta" sale de la siguiente, así que no hay forma de dejar
 * una altura sin cubrir. La diferencia es qué aporta la fila — allá el precio
 * base, acá un ajuste sobre ese precio.
 *
 * DE FÁBRICA NO COBRA NADA: viene una sola franja desde 0 cm con 0%. Es
 * deliberado. Inventar nosotros un porcentaje sería cobrarle de más a clientes
 * reales sin que nadie lo haya decidido. Ver lib/tramosAltura.ts y migración 033.
 */

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  notificarTramosAlturaActualizados,
  obtenerTramosAltura,
} from "@/lib/tramosAlturaDatos";
import { guardarTramosAlturaAction } from "@/app/dashboard/tarifas/actions";
import {
  ajusteDeAltura,
  ordenarAltura,
  rangoLegible,
  validarAltura,
  type TramoAltura,
} from "@/lib/tramosAltura";

/** Alturas con las que se prueba la tabla en vivo, de un chihuahua a un gran danés. */
const ALTURAS_PRUEBA = [18, 25, 32, 40, 48, 55, 70];

export function EditorTramosAltura() {
  const [tramos, setTramos] = useState<TramoAltura[]>([]);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [guardado, setGuardado] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let vivo = true;
    void (async () => {
      const t = await obtenerTramosAltura(createClient());
      if (!vivo) return;
      setTramos(ordenarAltura(t));
      setCargando(false);
    })();
    return () => {
      vivo = false;
    };
  }, []);

  const problemas = useMemo(() => validarAltura(tramos), [tramos]);
  const ordenados = useMemo(() => ordenarAltura(tramos), [tramos]);
  const sinEfecto = useMemo(() => ordenados.every((t) => t.pct === 0), [ordenados]);

  function actualizar(id: string, campo: "nombre" | "desdeCm" | "pct", valor: string) {
    setGuardado(false);
    setTramos((prev) =>
      prev.map((t) => {
        if (t.id !== id) return t;
        if (campo === "nombre") return { ...t, nombre: valor };
        // Un campo vacío se lee como 0, no como NaN: NaN se propaga al cálculo
        // y convierte un error de tipeo en un precio imposible de diagnosticar.
        const n = valor.trim() === "" ? 0 : Number(valor.replace(",", "."));
        if (!Number.isFinite(n)) return t;
        return campo === "desdeCm" ? { ...t, desdeCm: n } : { ...t, pct: n };
      })
    );
  }

  function agregar() {
    setGuardado(false);
    const ultimo = ordenados[ordenados.length - 1];
    setTramos((prev) => [
      ...prev,
      {
        id: `nuevo-${prev.length}-${prev.reduce((a, t) => a + t.desdeCm, 0)}`,
        nombre: "Franja nueva",
        desdeCm: ultimo ? ultimo.desdeCm + 10 : 0,
        pct: 0,
      },
    ]);
  }

  function quitar(id: string) {
    setGuardado(false);
    setTramos((prev) => prev.filter((t) => t.id !== id));
  }

  async function guardar() {
    setGuardando(true);
    setError("");
    setGuardado(false);
    try {
      const r = await guardarTramosAlturaAction(ordenados);
      if (!r.success) {
        // Nunca un fallo mudo: si no se pudo guardar, se dice por qué.
        setError(r.error ?? "No se pudo guardar.");
        return;
      }
      setGuardado(true);
      notificarTramosAlturaActualizados();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falló la conexión al guardar.");
    } finally {
      setGuardando(false);
    }
  }

  if (cargando) {
    return (
      <section className="rounded-3xl border border-ink/10 bg-white p-6">
        <p className="text-sm text-ink-soft">Cargando franjas de altura…</p>
      </section>
    );
  }

  return (
    <section className="rounded-3xl border border-ink/10 bg-white p-6">
      <h2 className="font-display text-xl font-extrabold tracking-tight text-ink">
        Ajuste según la altura
      </h2>
      <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-ink-soft">
        Se suma o resta sobre el precio del peso. Cada franja indica{" "}
        <strong>desde</strong> qué altura rige; el límite de arriba sale de la siguiente, así que
        ninguna altura queda sin cubrir. Un 0% significa que esa franja no cambia el precio.
      </p>

      {/* Que no cobre nada no es un error, pero sí algo que el dueño debe saber
          que está así — si lo configuró y quedó en 0, lo está viendo. */}
      {sinEfecto && (
        <p className="mt-3 rounded-2xl border border-ink/10 bg-cream/70 px-3.5 py-2.5 text-sm text-ink-soft">
          Ahora mismo la altura <strong>no cambia el precio</strong>: todas las franjas están en 0%.
          Así viene de fábrica, a propósito. Ponga sus porcentajes cuando los tenga definidos.
        </p>
      )}

      <div className="mt-5 overflow-x-auto">
        <table className="w-full min-w-[560px] border-separate border-spacing-y-1.5 text-left">
          <thead>
            <tr className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-ink-soft">
              <th className="px-3 py-1">Nombre</th>
              <th className="px-3 py-1">Desde (cm)</th>
              <th className="px-3 py-1">Rango que cubre</th>
              <th className="px-3 py-1">Ajuste (%)</th>
              <th className="px-3 py-1 sr-only">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {ordenados.map((t) => (
              <tr key={t.id} className="bg-cream/60">
                <td className="rounded-l-xl px-3 py-2">
                  <input
                    aria-label={`Nombre de la franja que empieza en ${t.desdeCm} cm`}
                    value={t.nombre}
                    onChange={(e) => actualizar(t.id, "nombre", e.target.value)}
                    className="w-full rounded-lg border border-ink/15 bg-white px-2.5 py-1.5 text-sm text-ink"
                  />
                </td>
                <td className="px-3 py-2">
                  <input
                    aria-label={`Altura desde la que rige ${t.nombre}`}
                    inputMode="decimal"
                    value={String(t.desdeCm)}
                    onChange={(e) => actualizar(t.id, "desdeCm", e.target.value)}
                    className="w-24 rounded-lg border border-ink/15 bg-white px-2.5 py-1.5 text-sm tabular-nums text-ink"
                  />
                </td>
                <td className="px-3 py-2 text-sm text-ink-soft">{rangoLegible(ordenados, t.id)}</td>
                <td className="px-3 py-2">
                  <input
                    aria-label={`Ajuste porcentual de ${t.nombre}`}
                    inputMode="decimal"
                    value={String(t.pct)}
                    onChange={(e) => actualizar(t.id, "pct", e.target.value)}
                    className="w-24 rounded-lg border border-ink/15 bg-white px-2.5 py-1.5 text-sm tabular-nums text-ink"
                  />
                </td>
                <td className="rounded-r-xl px-3 py-2 text-right">
                  <button
                    type="button"
                    onClick={() => quitar(t.id)}
                    className="rounded-lg px-2 py-1 text-xs font-bold text-ink-soft transition hover:bg-red-100 hover:text-red-700"
                  >
                    Quitar
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <button
        type="button"
        onClick={agregar}
        className="mt-3 rounded-xl border border-ink/15 px-3.5 py-2 text-sm font-bold text-ink transition hover:bg-cream"
      >
        + Agregar franja
      </button>

      {/* Los problemas se muestran ANTES de guardar y con el motivo escrito: es
          la diferencia entre corregir una fila y descubrir el error cuando un
          cliente ya está cotizando. */}
      {problemas.length > 0 && (
        <ul className="mt-4 space-y-1 rounded-2xl border border-red-200 bg-red-50 p-3.5">
          {problemas.map((p, i) => (
            <li key={i} className="text-sm leading-relaxed text-red-800">
              {p}
            </li>
          ))}
        </ul>
      )}

      {/* Prueba en vivo: qué ajuste le tocaría a cada altura antes de guardar,
          sin tener que ir al formulario a simular una reserva. */}
      <div className="mt-5 rounded-2xl border border-ink/10 bg-cream/50 p-3.5">
        <p className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-ink-soft">
          Qué ajuste aplicaría con esta tabla
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          {ALTURAS_PRUEBA.map((cm) => {
            const a = ajusteDeAltura(ordenados, cm);
            return (
              <span
                key={cm}
                className="rounded-lg border border-ink/10 bg-white px-2.5 py-1 text-xs tabular-nums text-ink"
              >
                {cm} cm ·{" "}
                <strong>{a === null ? "sin ajuste" : `${a.pct > 0 ? "+" : ""}${a.pct}%`}</strong>
              </span>
            );
          })}
        </div>
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => void guardar()}
          disabled={guardando || problemas.length > 0}
          className="rounded-xl bg-teal-dark px-4 py-2.5 text-sm font-extrabold text-white transition hover:opacity-90 disabled:opacity-40"
        >
          {guardando ? "Guardando…" : "Guardar franjas"}
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
