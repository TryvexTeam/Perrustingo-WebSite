"use client";

/* Editor de tramos de precio por peso.
 *
 * POR QUÉ EXISTE (pedido del cliente, 27-jul): probando la página él mismo, un
 * perrito de 8 kg caía en "Pequeño (6–10 kg)" y salía $20.000 cuando
 * corresponden $25.000–$30.000. Con cinco escalones fijos, los bordes siempre
 * cobran de menos. Y el problema de fondo era que los cortes vivían en el
 * código: ajustar un precio obligaba a un despliegue.
 *
 * Aquí se cambian los cortes y los valores sin tocar código. Cada tramo declara
 * solo DESDE qué peso rige; el "hasta" se calcula del siguiente, así que no hay
 * forma de dejar un peso sin precio por error. Ver lib/tramos.ts y migración 032.
 */

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { notificarTramosActualizados, obtenerTramos } from "@/lib/tramosDatos";
import { guardarTramosAction } from "@/app/dashboard/tarifas/actions";
import { ordenar, precioDe, rangoLegible, validar, type Tramo } from "@/lib/tramos";
import { formatCLP } from "@/lib/reserva";

/** Pesos con los que se prueba la tabla en vivo, incluido el caso que falló. */
const PESOS_PRUEBA = [2, 4, 6.5, 8, 12, 18, 30, 50, 70];

export function EditorTramos() {
  const [tramos, setTramos] = useState<Tramo[]>([]);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [guardado, setGuardado] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let vivo = true;
    void (async () => {
      const t = await obtenerTramos(createClient());
      if (!vivo) return;
      setTramos(ordenar(t));
      setCargando(false);
    })();
    return () => {
      vivo = false;
    };
  }, []);

  const problemas = useMemo(() => validar(tramos), [tramos]);
  const ordenados = useMemo(() => ordenar(tramos), [tramos]);

  function actualizar(id: string, campo: "nombre" | "desdeKg" | "precio", valor: string) {
    setGuardado(false);
    setTramos((prev) =>
      prev.map((t) => {
        if (t.id !== id) return t;
        if (campo === "nombre") return { ...t, nombre: valor };
        // Un campo vacío se lee como 0, no como NaN: NaN se propaga al cálculo
        // y convierte un error de tipeo en un precio imposible de diagnosticar.
        const n = valor.trim() === "" ? 0 : Number(valor.replace(",", "."));
        if (!Number.isFinite(n)) return t;
        return campo === "desdeKg" ? { ...t, desdeKg: n } : { ...t, precio: Math.round(n) };
      })
    );
  }

  function agregar() {
    setGuardado(false);
    const ultimo = ordenados[ordenados.length - 1];
    setTramos((prev) => [
      ...prev,
      {
        id: `nuevo-${prev.length}-${prev.reduce((a, t) => a + t.desdeKg, 0)}`,
        nombre: "Tramo nuevo",
        desdeKg: ultimo ? ultimo.desdeKg + 5 : 0,
        precio: ultimo ? ultimo.precio : 20000,
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
      const r = await guardarTramosAction(ordenados);
      if (!r.success) {
        // Nunca un fallo mudo: si no se pudo guardar, se dice por qué.
        setError(r.error ?? "No se pudo guardar.");
        return;
      }
      setGuardado(true);
      notificarTramosActualizados();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falló la conexión al guardar.");
    } finally {
      setGuardando(false);
    }
  }

  if (cargando) {
    return (
      <section className="rounded-3xl border border-ink/10 bg-white p-6">
        <p className="text-sm text-ink-soft">Cargando tramos…</p>
      </section>
    );
  }

  return (
    <section className="rounded-3xl border border-ink/10 bg-white p-6">
      <h2 className="font-display text-xl font-extrabold tracking-tight text-ink">
        Precio según el peso
      </h2>
      <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-ink-soft">
        Cada tramo indica <strong>desde</strong> qué peso rige. El límite de arriba sale del tramo
        siguiente, así que ningún perrito puede quedar sin precio. Los cambios se ven al instante en
        el formulario de reserva.
      </p>

      <div className="mt-5 overflow-x-auto">
        <table className="w-full min-w-[560px] border-separate border-spacing-y-1.5 text-left">
          <thead>
            <tr className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-ink-soft">
              <th className="px-3 py-1">Nombre</th>
              <th className="px-3 py-1">Desde (kg)</th>
              <th className="px-3 py-1">Rango que cubre</th>
              <th className="px-3 py-1">Precio</th>
              <th className="px-3 py-1 sr-only">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {ordenados.map((t) => {
              const conProblema = problemas.some((p) => p.id === t.id);
              return (
                <tr key={t.id} className={conProblema ? "bg-red-50" : "bg-cream/60"}>
                  <td className="rounded-l-xl px-3 py-2">
                    <input
                      aria-label={`Nombre del tramo que empieza en ${t.desdeKg} kg`}
                      value={t.nombre}
                      onChange={(e) => actualizar(t.id, "nombre", e.target.value)}
                      className="w-full rounded-lg border border-ink/15 bg-white px-2.5 py-1.5 text-sm text-ink"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      aria-label={`Peso desde el que rige ${t.nombre}`}
                      inputMode="decimal"
                      value={String(t.desdeKg)}
                      onChange={(e) => actualizar(t.id, "desdeKg", e.target.value)}
                      className="w-24 rounded-lg border border-ink/15 bg-white px-2.5 py-1.5 text-sm tabular-nums text-ink"
                    />
                  </td>
                  <td className="px-3 py-2 text-sm text-ink-soft">{rangoLegible(ordenados, t.id)}</td>
                  <td className="px-3 py-2">
                    <input
                      aria-label={`Precio de ${t.nombre}`}
                      inputMode="numeric"
                      value={String(t.precio)}
                      onChange={(e) => actualizar(t.id, "precio", e.target.value)}
                      className="w-28 rounded-lg border border-ink/15 bg-white px-2.5 py-1.5 text-sm tabular-nums text-ink"
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
              );
            })}
          </tbody>
        </table>
      </div>

      <button
        type="button"
        onClick={agregar}
        className="mt-3 rounded-xl border border-ink/15 px-3.5 py-2 text-sm font-bold text-ink transition hover:bg-cream"
      >
        + Agregar tramo
      </button>

      {/* Los problemas se muestran ANTES de guardar y con el motivo escrito: es
          la diferencia entre corregir una fila y descubrir el error cuando un
          cliente ya está cotizando. */}
      {problemas.length > 0 && (
        <ul className="mt-4 space-y-1 rounded-2xl border border-red-200 bg-red-50 p-3.5">
          {problemas.map((p, i) => (
            <li key={i} className="text-sm leading-relaxed text-red-800">
              {p.mensaje}
            </li>
          ))}
        </ul>
      )}

      {/* Prueba en vivo: la tabla dice qué cobraría cada perrito antes de
          guardar. Incluye a propósito los 8 kg — el caso que el cliente probó
          y salió mal. Ver el número correcto ahí es la confirmación de que
          quedó bien, sin tener que ir al formulario a simular una reserva. */}
      <div className="mt-5 rounded-2xl border border-ink/10 bg-cream/50 p-3.5">
        <p className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-ink-soft">
          Qué cobraría con esta tabla
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          {PESOS_PRUEBA.map((kg) => {
            const p = precioDe(ordenados, kg);
            return (
              <span
                key={kg}
                className="rounded-lg border border-ink/10 bg-white px-2.5 py-1 text-xs tabular-nums text-ink"
              >
                {String(kg).replace(".", ",")} kg ·{" "}
                <strong>{p === null ? "sin precio" : formatCLP(p)}</strong>
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
          {guardando ? "Guardando…" : "Guardar tramos"}
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
