"use client";

import { useState } from "react";
import { guardarPoliticaAction } from "@/app/dashboard/politica/actions";
import {
  explicarAtraso,
  recargoPorAtraso,
  type PoliticaCitas,
} from "@/lib/politica";

/* La política de atrasos y cancelaciones (migración 035).
 *
 * Esta pantalla existe para dos cosas, y la segunda es la que importa:
 *   1. Poner los números.
 *   2. ENCENDERLA. Nace apagada de fábrica, y mientras lo esté el sistema no
 *      propone ningún monto.
 *
 * Todo lo que muestra plata sale de `lib/politica.ts` — acá no se recalcula
 * nada. Si la vista previa dijera un número distinto del que después propone
 * el panel de la cita, el dueño estaría encendiendo una regla que no leyó. */

interface EditorPoliticaProps {
  politicaInicial: PoliticaCitas;
}

/** Los atrasos que de verdad pasan en el local, para ver el efecto del cambio
    antes de guardarlo. 30 min es el borde de la tolerancia de fábrica. */
const EJEMPLOS_MINUTOS = [10, 30, 40, 60, 90];

function pesos(n: number): string {
  return "$" + Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

export function EditorPolitica({ politicaInicial }: EditorPoliticaProps) {
  const [politica, setPolitica] = useState<PoliticaCitas>(politicaInicial);
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState("");
  const [aviso, setAviso] = useState("");

  /* `readonly` en la interfaz del dominio impide asignar campo a campo: cada
     cambio arma una política nueva, que además es lo que hay que hacer para
     que la vista previa siga al formulario sin un paso intermedio. */
  const cambiar = (parche: Partial<PoliticaCitas>) => {
    setPolitica((previa) => ({ ...previa, ...parche }));
    setError("");
    setAviso("");
  };

  const textoLimpio = politica.textoCliente.trim();
  const faltaTexto = politica.activa && textoLimpio.length < 20;
  const cambioElInterruptor = politica.activa !== politicaInicial.activa;

  const guardar = async () => {
    setError("");
    setAviso("");
    setOcupado(true);
    const res = await guardarPoliticaAction(politica);
    setOcupado(false);
    if (!res.success) {
      setError(res.error ?? "No se pudo guardar la política.");
      return;
    }
    setAviso(
      politica.activa
        ? "Política guardada y ENCENDIDA. Desde ahora el panel propone recargos por atraso."
        : "Política guardada y apagada. No se propone ni se cobra ningún recargo."
    );
  };

  return (
    <div className="space-y-6">
      {/* ── El interruptor, primero y solo ──────────────────────────────── */}
      <div
        className={`rounded-3xl p-7 shadow-sm ${
          politica.activa ? "bg-[#fde4c8]" : "bg-white"
        }`}
      >
        <h2 className="font-display text-lg font-extrabold text-ink">
          {politica.activa ? "La política está encendida" : "La política está apagada"}
        </h2>
        <p className="mt-1 max-w-2xl text-xs leading-relaxed text-ink-soft">
          {politica.activa
            ? "El panel propone un recargo cuando alguien llega tarde. Nunca lo cobra solo: usted decide cobrar o perdonar en cada cita."
            : "Nadie paga recargo por llegar tarde ni por cancelar. Los números de abajo quedan guardados, pero no se aplican."}
        </p>

        <label className="mt-5 flex items-start gap-3 rounded-2xl bg-white/70 px-4 py-3">
          <input
            type="checkbox"
            checked={politica.activa}
            onChange={(e) => cambiar({ activa: e.target.checked })}
            disabled={ocupado}
            className="mt-0.5 h-5 w-5 accent-teal"
          />
          <span className="text-sm font-bold text-ink">
            Aplicar la política de atrasos y cancelaciones
            <span className="mt-1 block text-[11px] font-semibold leading-relaxed text-ink-soft">
              Enciéndala solo cuando el formulario de reserva ya le muestre estas
              reglas al cliente. Un recargo que el cliente no pudo leer antes de
              reservar se transforma en una discusión en la puerta del local.
            </span>
          </span>
        </label>

        {cambioElInterruptor && (
          <p
            role="status"
            className="mt-3 rounded-2xl bg-white px-4 py-3 text-xs font-bold leading-relaxed text-[#7a4d10]"
          >
            {politica.activa
              ? "⚠️ Va a encenderla. Todavía no se guarda: revise abajo qué se le propondría cobrar a un cliente que llega tarde."
              : "Va a apagarla. Las citas que ya tengan un recargo aceptado lo conservan; las nuevas no proponen nada."}
          </p>
        )}
      </div>

      {/* ── Atrasos ─────────────────────────────────────────────────────── */}
      <div className="rounded-3xl bg-white p-7 shadow-sm">
        <h2 className="font-display text-lg font-extrabold text-ink">Atrasos</h2>
        <p className="mt-1 max-w-2xl text-xs leading-relaxed text-ink-soft">
          El recargo es <strong>proporcional</strong>: media hora de atraso cobra
          media tasa. Cobrar la hora completa por diez minutos es lo que convierte
          una regla razonable en un castigo.
        </p>

        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="pol-tolerancia" className="text-sm font-bold text-ink">
              Tolerancia (minutos)
            </label>
            <input
              id="pol-tolerancia"
              type="number"
              min={0}
              max={240}
              value={politica.toleranciaMin}
              onChange={(e) => cambiar({ toleranciaMin: Number(e.target.value) })}
              disabled={ocupado}
              className="mt-2 w-full rounded-xl border-2 border-cream bg-cream px-3 py-2 text-sm font-bold text-ink focus:border-teal focus:outline-none disabled:opacity-50"
            />
            <p className="mt-1.5 text-[11px] leading-relaxed text-ink-soft">
              Pasado este rato, el panel avisa que el equipo decide si toma la
              cita. No la cancela solo.
            </p>
          </div>

          <div>
            <label htmlFor="pol-tasa" className="text-sm font-bold text-ink">
              Recargo por hora de atraso (pesos)
            </label>
            <input
              id="pol-tasa"
              type="number"
              min={0}
              max={200000}
              step={500}
              value={politica.recargoAtrasoHora}
              onChange={(e) => cambiar({ recargoAtrasoHora: Number(e.target.value) })}
              disabled={ocupado}
              className="mt-2 w-full rounded-xl border-2 border-cream bg-cream px-3 py-2 text-sm font-bold text-ink focus:border-teal focus:outline-none disabled:opacity-50"
            />
            <p className="mt-1.5 text-[11px] leading-relaxed text-ink-soft">
              Tasa de referencia. Media hora cobra{" "}
              {pesos(recargoPorAtraso(30, { ...politica, activa: true }))}.
            </p>
          </div>
        </div>

        {/* Qué se propondría cobrar, con los números que están en pantalla. */}
        <div className="mt-5 rounded-2xl bg-cream px-4 py-4">
          <h3 className="text-xs font-extrabold uppercase tracking-wider text-ink-soft">
            Con estos números, el panel propondría
          </h3>
          <ul className="mt-2 space-y-1">
            {EJEMPLOS_MINUTOS.map((min) => (
              <li key={min} className="text-xs font-semibold leading-relaxed text-ink">
                {explicarAtraso(min, politica)}
              </li>
            ))}
          </ul>
          {!politica.activa && (
            <p className="mt-2 text-[11px] font-bold text-ink-soft">
              Con la política apagada no se propone ningún monto. Marque el
              interruptor de arriba para ver las cifras reales.
            </p>
          )}
        </div>
      </div>

      {/* ── Cancelaciones ───────────────────────────────────────────────── */}
      <div className="rounded-3xl bg-white p-7 shadow-sm">
        <h2 className="font-display text-lg font-extrabold text-ink">Cancelaciones</h2>
        <p className="mt-1 max-w-2xl text-xs leading-relaxed text-ink-soft">
          Cancelar nunca cuesta plata en el momento. Cancelar tarde deja un
          recargo que se aplica a la <strong>siguiente</strong> cita.
        </p>

        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="pol-horas" className="text-sm font-bold text-ink">
              Cancelar gratis hasta (horas antes)
            </label>
            <input
              id="pol-horas"
              type="number"
              min={0}
              max={168}
              value={politica.cancelacionHoras}
              onChange={(e) => cambiar({ cancelacionHoras: Number(e.target.value) })}
              disabled={ocupado}
              className="mt-2 w-full rounded-xl border-2 border-cream bg-cream px-3 py-2 text-sm font-bold text-ink focus:border-teal focus:outline-none disabled:opacity-50"
            />
          </div>

          <div>
            <label htmlFor="pol-pct" className="text-sm font-bold text-ink">
              Recargo en la próxima cita (%)
            </label>
            <input
              id="pol-pct"
              type="number"
              min={0}
              max={100}
              step={1}
              value={politica.cancelacionPct}
              onChange={(e) => cambiar({ cancelacionPct: Number(e.target.value) })}
              disabled={ocupado}
              className="mt-2 w-full rounded-xl border-2 border-cream bg-cream px-3 py-2 text-sm font-bold text-ink focus:border-teal focus:outline-none disabled:opacity-50"
            />
          </div>
        </div>

        <label className="mt-4 flex items-center gap-2 text-sm font-bold text-ink">
          <input
            type="checkbox"
            checked={politica.pierdeCupon}
            onChange={(e) => cambiar({ pierdeCupon: e.target.checked })}
            disabled={ocupado}
            className="h-4 w-4 accent-teal"
          />
          Cancelar hace perder el cupón usado
        </label>
      </div>

      {/* ── Lo que lee el cliente ───────────────────────────────────────── */}
      <div className="rounded-3xl bg-white p-7 shadow-sm">
        <h2 className="font-display text-lg font-extrabold text-ink">
          Lo que lee el cliente antes de reservar
        </h2>
        <p className="mt-1 max-w-2xl text-xs leading-relaxed text-ink-soft">
          Este texto es la única razón por la que un recargo se puede defender.
          Escríbalo con los mismos números que puso arriba — la pantalla no los
          copia sola, porque el cliente merece leerlo en palabras, no en tablas.
        </p>

        <textarea
          id="pol-texto"
          aria-label="Texto de la política para el cliente"
          value={politica.textoCliente}
          maxLength={600}
          rows={5}
          onChange={(e) => cambiar({ textoCliente: e.target.value })}
          disabled={ocupado}
          className="mt-4 w-full rounded-2xl border-2 border-cream bg-cream px-4 py-3 text-sm font-semibold leading-relaxed text-ink focus:border-teal focus:outline-none disabled:opacity-50"
        />
        <p className="mt-1.5 text-[11px] text-ink-soft">
          {textoLimpio.length} de 600 caracteres.
        </p>

        {faltaTexto && (
          <p className="mt-3 rounded-2xl bg-[#fbdbe7] px-4 py-3 text-xs font-bold leading-relaxed text-[#7a1030]">
            No se puede encender la política sin este texto. Es lo que el cliente
            acepta al reservar.
          </p>
        )}
      </div>

      {error && (
        <div
          role="alert"
          className="rounded-2xl bg-[#fbdbe7] px-4 py-3 text-xs font-semibold leading-relaxed text-[#7a1030]"
        >
          <span aria-hidden="true">⚠️ </span>
          {error}
        </div>
      )}

      {aviso && (
        <p role="status" className="rounded-2xl bg-[#d8f0e3] px-4 py-3 text-xs font-bold text-teal-ink">
          ✅ {aviso}
        </p>
      )}

      <button
        type="button"
        onClick={guardar}
        disabled={ocupado || faltaTexto}
        className="rounded-full bg-teal px-6 py-2.5 font-display text-sm font-extrabold text-white shadow-[0_3px_0_rgba(6,58,64,.25)] transition-[background-color,transform,box-shadow] duration-150 hover:bg-teal-dark active:translate-y-0.5 active:shadow-[0_1px_0_rgba(6,58,64,.25)] disabled:cursor-not-allowed disabled:opacity-60 disabled:active:translate-y-0"
      >
        {ocupado
          ? "Guardando…"
          : politica.activa
            ? "Guardar y aplicar la política"
            : "Guardar (queda apagada)"}
      </button>
    </div>
  );
}
