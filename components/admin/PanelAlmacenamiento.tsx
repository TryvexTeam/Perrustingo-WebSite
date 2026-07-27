"use client";

import { useCallback, useEffect, useState } from "react";
import {
  revisarAlmacenamiento,
  limpiarFotosVencidas,
  type ResumenAlmacenamiento,
} from "@/app/dashboard/fotos/actions";
import { MESES_RETENCION } from "@/lib/retencion";

/* Espacio de fotos y limpieza de lo vencido (PRP-002 F5).

   Dos números y un botón. La tentación era hacer un tablero con gráficos;
   pero acá el equipo solo necesita saber si le queda espacio y si hay algo
   que ya cumplió su plazo. Todo lo demás sería adorno sobre una decisión
   que se toma una vez cada varios meses. */

const BARRA_COLOR = {
  ok: "bg-teal",
  atencion: "bg-orange",
  critico: "bg-[#d64550]",
} as const;

const AVISO_COLOR = {
  ok: "",
  atencion: "bg-[#fde4c8] text-[#7a4d10]",
  critico: "bg-[#fbdbe7] text-[#7a1030]",
} as const;

export function PanelAlmacenamiento() {
  const [datos, setDatos] = useState<ResumenAlmacenamiento | null>(null);
  const [limpiando, setLimpiando] = useState(false);
  const [confirmando, setConfirmando] = useState(false);
  const [aviso, setAviso] = useState("");

  const cargar = useCallback(async () => {
    setDatos(await revisarAlmacenamiento());
  }, []);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  const limpiar = async () => {
    setLimpiando(true);
    setAviso("");
    const r = await limpiarFotosVencidas();
    setLimpiando(false);
    setConfirmando(false);
    // El número sale del conteo real de filas eliminadas, no de cuántas se
    // pensaba borrar.
    setAviso(
      r.success
        ? r.borradas === 0
          ? "No había fotos vencidas."
          : `Listo: ${r.borradas} ${r.borradas === 1 ? "foto borrada" : "fotos borradas"}.`
        : r.error ?? "No se pudo limpiar."
    );
    await cargar();
  };

  if (!datos) {
    return (
      <section className="rounded-3xl bg-white p-6 shadow-sm">
        <p className="text-sm text-ink-soft">Revisando el almacenamiento…</p>
      </section>
    );
  }

  if (datos.error) {
    return (
      <section className="rounded-3xl bg-white p-6 shadow-sm">
        <p className="text-sm font-semibold text-ink-soft">{datos.error}</p>
      </section>
    );
  }

  const { espacio, vencidas, total, sinRuta } = datos;
  const porcentaje = Math.min(100, Math.round(espacio.porcentaje * 100));

  return (
    <section className="rounded-3xl bg-white p-6 shadow-sm">
      <h2 className="font-display text-lg font-extrabold text-ink">
        Fotos guardadas
      </h2>

      <div className="mt-4 flex flex-wrap items-baseline gap-x-3">
        <span className="font-display text-3xl font-extrabold text-ink">{total}</span>
        <span className="text-sm text-ink-soft">
          {total === 1 ? "foto en total" : "fotos en total"}
        </span>
      </div>

      {/* La barra usa el mismo color del aviso: si está en naranja, el
          número y la barra cuentan lo mismo de un vistazo. */}
      <div className="mt-3 h-2.5 w-full overflow-hidden rounded-full bg-cream">
        <div
          className={`h-full rounded-full transition-[width] duration-500 ${BARRA_COLOR[espacio.nivel]}`}
          style={{ width: `${Math.max(porcentaje, 2)}%` }}
          role="progressbar"
          aria-valuenow={porcentaje}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Espacio de fotos usado"
        />
      </div>
      <p className="mt-1.5 text-xs text-ink-soft">
        {porcentaje}% del espacio disponible
      </p>

      {espacio.mensaje && (
        <p
          className={`mt-4 rounded-2xl px-4 py-3 text-xs font-semibold leading-relaxed ${AVISO_COLOR[espacio.nivel]}`}
        >
          {espacio.nivel === "critico" ? "🚨" : "⚠️"} {espacio.mensaje}
        </p>
      )}

      {aviso && (
        <p
          role="status"
          className="mt-4 rounded-2xl bg-[#d5efe2] px-4 py-3 text-xs font-semibold text-teal-dark"
        >
          {aviso}
        </p>
      )}

      <div className="mt-5 border-t border-zinc-100 pt-5">
        <p className="text-sm font-bold text-ink">
          Fotos con más de {MESES_RETENCION} meses
        </p>
        <p className="mt-1 text-xs leading-relaxed text-ink-soft">
          {vencidas === 0
            ? "Ninguna por ahora. Todo lo guardado sigue dentro del plazo."
            : `Hay ${vencidas} ${vencidas === 1 ? "foto que ya cumplió" : "fotos que ya cumplieron"} el plazo de resguardo y se ${vencidas === 1 ? "puede borrar" : "pueden borrar"}.`}
        </p>

        {sinRuta > 0 && (
          <p className="mt-2 rounded-xl bg-cream px-3 py-2 text-xs leading-relaxed text-ink-soft">
            Además hay {sinRuta} {sinRuta === 1 ? "foto antigua" : "fotos antiguas"} sin
            ruta guardada: no se pueden borrar automáticamente sin dejar el
            archivo suelto. Avise al desarrollador si aparece este mensaje.
          </p>
        )}

        {vencidas > 0 &&
          (confirmando ? (
            <div className="mt-3">
              <p className="mb-2 rounded-xl bg-[#fbdbe7] px-3 py-2 text-xs leading-relaxed text-[#7a1030]">
                Se borrarán <strong>{vencidas}</strong>{" "}
                {vencidas === 1 ? "foto" : "fotos"} y sus archivos. Es
                evidencia de visitas de hace más de {MESES_RETENCION} meses:
                una vez borrada no se recupera.
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={limpiar}
                  disabled={limpiando}
                  className="rounded-full bg-[#d64550] px-5 py-2 text-xs font-extrabold text-white shadow-[0_2px_0_rgba(120,10,30,.3)] transition-[background-color,transform] duration-150 hover:bg-[#b83743] active:translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {limpiando ? "Borrando…" : `Sí, borrar ${vencidas}`}
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmando(false)}
                  className="text-xs font-bold text-ink-soft underline underline-offset-2 hover:text-ink"
                >
                  Mejor no
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmando(true)}
              className="mt-3 rounded-full border-2 border-[#d64550] px-4 py-2 text-xs font-bold text-[#d64550] transition-colors hover:bg-[#fbdbe7]"
            >
              Borrar las vencidas
            </button>
          ))}
      </div>
    </section>
  );
}
