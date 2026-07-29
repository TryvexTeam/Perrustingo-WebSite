"use client";

import { useState } from "react";
import {
  bloquearFechaAction,
  liberarFechaAction,
  type ExcepcionEditable,
} from "@/app/dashboard/disponibilidad/actions";
import { hoyEnSantiago } from "@/lib/disponibilidad";

/* Días libres (reunión con Rodolfo, 27-jul).

   La idea del cliente: cuando se toma un día, que el formulario NO diga
   "cerrado" sino que los cupos están tomados. Por eso esta pantalla separa
   dos textos que es fácil confundir:

     · el mensaje  — lo lee el cliente
     · la nota     — la lee solo Rodolfo, nunca sale de acá

   La pantalla lo dice con todas sus letras en cada campo, porque escribir
   "vacaciones" en la casilla equivocada publicaría justo lo que la regla
   trata de esconder. */

interface EditorExcepcionesProps {
  excepcionesIniciales: ExcepcionEditable[];
  /** Texto general, para mostrar qué verá el cliente si no se escribe uno. */
  mensajePorDefecto: string;
}

/** "2026-08-12" → "martes 12 de agosto". Con la fecha partida a mano: pasar
    un YYYY-MM-DD por `new Date()` lo lee como UTC y en Chile muestra el día
    anterior. */
function fechaLarga(fecha: string): string {
  const [a, m, d] = fecha.split("-").map(Number);
  return new Date(a, m - 1, d).toLocaleDateString("es-CL", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

export function EditorExcepciones({
  excepcionesIniciales,
  mensajePorDefecto,
}: EditorExcepcionesProps) {
  const [excepciones, setExcepciones] = useState(excepcionesIniciales);
  const [fecha, setFecha] = useState("");
  const [mensaje, setMensaje] = useState("");
  const [nota, setNota] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState("");

  const yaBloqueada = excepciones.some((e) => e.fecha === fecha);

  const bloquear = async () => {
    setError("");
    if (!fecha) {
      setError("Elija una fecha.");
      return;
    }
    setOcupado(true);
    const nueva: ExcepcionEditable = { fecha, mensaje, notaInterna: nota };
    const res = await bloquearFechaAction(nueva);
    setOcupado(false);
    if (!res.success) {
      setError(res.error ?? "No se pudo bloquear la fecha.");
      return;
    }
    setExcepciones((prev) =>
      [...prev.filter((e) => e.fecha !== fecha), nueva].sort((a, b) =>
        a.fecha.localeCompare(b.fecha)
      )
    );
    setFecha("");
    setMensaje("");
    setNota("");
  };

  const liberar = async (fechaALiberar: string) => {
    setError("");
    setOcupado(true);
    const res = await liberarFechaAction(fechaALiberar);
    setOcupado(false);
    if (!res.success) {
      setError(res.error ?? "No se pudo liberar la fecha.");
      return;
    }
    setExcepciones((prev) => prev.filter((e) => e.fecha !== fechaALiberar));
  };

  return (
    <div className="rounded-3xl bg-white p-7 shadow-sm">
      <h2 className="font-display text-lg font-extrabold text-ink">Días libres</h2>
      <p className="mt-1 max-w-2xl text-xs leading-relaxed text-ink-soft">
        Bloquee una fecha puntual sin tocar los horarios de la semana. Al
        cliente le aparece que <strong>ya no quedan cupos</strong> ese día —
        nunca que el local está cerrado.
      </p>

      {error && (
        <div
          role="alert"
          className="mt-5 flex items-center gap-2 rounded-2xl bg-[#fbdbe7] px-4 py-3 text-xs font-semibold text-[#7a1030]"
        >
          <span aria-hidden="true">⚠️</span>
          {error}
        </div>
      )}

      <div className="mt-5 rounded-2xl bg-cream px-4 py-4">
        <div className="grid gap-4 sm:grid-cols-[auto_1fr]">
          <div>
            <label htmlFor="fecha-libre" className="text-sm font-bold text-ink">
              Fecha
            </label>
            <input
              id="fecha-libre"
              type="date"
              value={fecha}
              min={hoyEnSantiago()}
              onChange={(e) => {
                setFecha(e.target.value);
                setError("");
              }}
              disabled={ocupado}
              className="mt-2 block rounded-xl border-2 border-white bg-white px-3 py-2 text-sm font-bold text-ink focus:border-teal focus:outline-none disabled:opacity-50"
            />
            {yaBloqueada && (
              <p className="mt-1.5 text-[11px] font-semibold text-[#7a4d10]">
                Esa fecha ya está bloqueada — guardar la reemplaza.
              </p>
            )}
          </div>

          <div>
            <label htmlFor="mensaje-libre" className="text-sm font-bold text-ink">
              Mensaje para el cliente{" "}
              <span className="font-semibold text-ink-soft">(opcional)</span>
            </label>
            <input
              id="mensaje-libre"
              type="text"
              value={mensaje}
              maxLength={200}
              placeholder={mensajePorDefecto}
              onChange={(e) => setMensaje(e.target.value)}
              disabled={ocupado}
              className="mt-2 w-full rounded-xl border-2 border-white bg-white px-3 py-2 text-sm font-semibold text-ink focus:border-teal focus:outline-none disabled:opacity-50"
            />
            <p className="mt-1.5 text-[11px] leading-relaxed text-ink-soft">
              Esto <strong>lo lee el cliente</strong> en el formulario. En
              blanco se usa el texto general.
            </p>
          </div>
        </div>

        <div className="mt-4">
          <label htmlFor="nota-libre" className="text-sm font-bold text-ink">
            Nota para usted <span className="font-semibold text-ink-soft">(opcional)</span>
          </label>
          <input
            id="nota-libre"
            type="text"
            value={nota}
            maxLength={200}
            placeholder="Vacaciones, hora médica…"
            onChange={(e) => setNota(e.target.value)}
            disabled={ocupado}
            className="mt-2 w-full rounded-xl border-2 border-white bg-white px-3 py-2 text-sm font-semibold text-ink focus:border-teal focus:outline-none disabled:opacity-50"
          />
          <p className="mt-1.5 text-[11px] leading-relaxed text-ink-soft">
            🔒 Solo la ve usted. <strong>Nunca</strong> sale al formulario ni
            al sitio público.
          </p>
        </div>

        <button
          type="button"
          onClick={bloquear}
          disabled={ocupado || !fecha}
          className="mt-4 rounded-full bg-teal px-6 py-2.5 font-display text-sm font-extrabold text-white shadow-[0_3px_0_rgba(6,58,64,.25)] transition-[background-color,transform,box-shadow] duration-150 hover:bg-teal-dark active:translate-y-0.5 active:shadow-[0_1px_0_rgba(6,58,64,.25)] disabled:cursor-not-allowed disabled:opacity-60 disabled:active:translate-y-0"
        >
          {ocupado ? "Guardando…" : "Bloquear este día"}
        </button>
      </div>

      <div className="mt-6">
        <h3 className="text-xs font-extrabold uppercase tracking-wider text-ink-soft">
          Fechas bloqueadas
        </h3>

        {excepciones.length === 0 ? (
          <p className="mt-3 rounded-2xl bg-cream px-4 py-3 text-xs font-semibold text-ink-soft">
            No hay ningún día bloqueado. La agenda sigue los horarios de la semana.
          </p>
        ) : (
          <ul className="mt-3 space-y-2">
            {excepciones.map((e) => (
              <li
                key={e.fecha}
                className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-2xl bg-cream px-4 py-3"
              >
                <span className="text-sm font-extrabold text-ink first-letter:uppercase">
                  {fechaLarga(e.fecha)}
                </span>
                {e.notaInterna && (
                  <span className="rounded-full bg-white px-2.5 py-0.5 text-[11px] font-bold text-ink-soft">
                    🔒 {e.notaInterna}
                  </span>
                )}
                <span className="basis-full text-[11px] leading-relaxed text-ink-soft">
                  El cliente lee: “{e.mensaje.trim() || mensajePorDefecto}”
                </span>
                <button
                  type="button"
                  onClick={() => liberar(e.fecha)}
                  disabled={ocupado}
                  className="ml-auto rounded-full bg-white px-3 py-1.5 text-xs font-bold text-teal-dark transition-colors hover:bg-sky/40 disabled:opacity-50"
                >
                  Volver a abrir
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
