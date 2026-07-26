"use client";

import { useState } from "react";
import {
  guardarDisponibilidadAction,
  type ConfigEditable,
  type TramoEditable,
} from "@/app/dashboard/disponibilidad/actions";

/* Reglas de la agenda: con cuánta anticipación se pide una cita, qué horas
   se atienden cada día y cuántas caben a la vez (PRP-001 Fase 5). */

const DIAS = [
  { valor: 1, nombre: "Lunes" },
  { valor: 2, nombre: "Martes" },
  { valor: 3, nombre: "Miércoles" },
  { valor: 4, nombre: "Jueves" },
  { valor: 5, nombre: "Viernes" },
  { valor: 6, nombre: "Sábado" },
  { valor: 0, nombre: "Domingo" },
];

interface EditorDisponibilidadProps {
  configInicial: ConfigEditable;
  tramosIniciales: TramoEditable[];
  /** Cuántos peluqueros están marcados hoy (Fase 1) y capacidad efectiva. */
  peluqueros: number;
  capacidad: number;
}

/** Recorta "09:00:00" a "09:00" — lo que espera un <input type="time">. */
function aHHMM(hora: string): string {
  return hora.slice(0, 5);
}

export function EditorDisponibilidad({
  configInicial,
  tramosIniciales,
  peluqueros,
  capacidad,
}: EditorDisponibilidadProps) {
  const [config, setConfig] = useState<ConfigEditable>(configInicial);
  const [tramos, setTramos] = useState<TramoEditable[]>(
    tramosIniciales.map((t) => ({ ...t, horaInicio: aHHMM(t.horaInicio), horaFin: aHHMM(t.horaFin) }))
  );
  const [guardando, setGuardando] = useState(false);
  const [guardado, setGuardado] = useState(false);
  const [error, setError] = useState("");

  const tocar = () => {
    setGuardado(false);
    setError("");
  };

  const tramoDe = (dia: number) => tramos.filter((t) => t.diaSemana === dia);

  const agregarTramo = (dia: number) => {
    setTramos((prev) => [
      ...prev,
      { diaSemana: dia, horaInicio: "09:00", horaFin: "19:00", activo: true },
    ]);
    tocar();
  };

  const quitarTramo = (indice: number) => {
    setTramos((prev) => prev.filter((_, i) => i !== indice));
    tocar();
  };

  const actualizarTramo = (indice: number, cambios: Partial<TramoEditable>) => {
    setTramos((prev) => prev.map((t, i) => (i === indice ? { ...t, ...cambios } : t)));
    tocar();
  };

  const guardar = async () => {
    setGuardando(true);
    setError("");
    const resultado = await guardarDisponibilidadAction(config, tramos);
    setGuardando(false);
    if (!resultado.success) {
      setError(resultado.error ?? "No se pudo guardar.");
      return;
    }
    setGuardado(true);
  };

  const bloquesPorDia = (dia: number) =>
    tramoDe(dia)
      .filter((t) => t.activo)
      .reduce((total, t) => {
        const min = (h: string) => parseInt(h.slice(0, 2), 10) * 60 + parseInt(h.slice(3, 5), 10);
        const largo = min(t.horaFin) - min(t.horaInicio);
        return total + Math.max(0, Math.floor(largo / config.duracionBloqueMin));
      }, 0);

  return (
    <div className="space-y-6">
      <div className="rounded-3xl bg-white p-7 shadow-sm">
        {error && (
          <div
            role="alert"
            className="mb-5 flex items-center gap-2 rounded-2xl bg-[#fbdbe7] px-4 py-3 text-xs font-semibold text-[#7a1030]"
          >
            <span aria-hidden="true">⚠️</span>
            {error}
          </div>
        )}

        <h2 className="font-display text-lg font-extrabold text-ink">Reglas generales</h2>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div className="rounded-2xl bg-cream px-4 py-3">
            <label htmlFor="lead-time" className="text-sm font-bold text-ink">
              Anticipación mínima
            </label>
            <div className="mt-2 flex items-center gap-2">
              <input
                id="lead-time"
                type="number"
                min={0}
                max={60}
                value={config.leadTimeDias}
                onChange={(e) => {
                  setConfig((c) => ({ ...c, leadTimeDias: parseInt(e.target.value, 10) || 0 }));
                  tocar();
                }}
                disabled={guardando}
                className="w-20 rounded-xl border-2 border-white bg-white px-3 py-2 text-right text-sm font-extrabold text-ink focus:border-teal focus:outline-none disabled:opacity-50"
              />
              <span className="text-sm font-bold text-ink-soft">días</span>
            </div>
            <p className="mt-1.5 text-[11px] leading-relaxed text-ink-soft">
              {config.leadTimeDias === 0
                ? "Se puede pedir para hoy mismo."
                : `Lo más pronto que alguien puede pedir es dentro de ${config.leadTimeDias} ${
                    config.leadTimeDias === 1 ? "día" : "días"
                  }.`}
            </p>
          </div>

          <div className="rounded-2xl bg-cream px-4 py-3">
            <label htmlFor="duracion" className="text-sm font-bold text-ink">
              Duración de cada bloque
            </label>
            <div className="mt-2 flex items-center gap-2">
              <input
                id="duracion"
                type="number"
                min={15}
                max={240}
                step={15}
                value={config.duracionBloqueMin}
                onChange={(e) => {
                  setConfig((c) => ({
                    ...c,
                    duracionBloqueMin: parseInt(e.target.value, 10) || 60,
                  }));
                  tocar();
                }}
                disabled={guardando}
                className="w-20 rounded-xl border-2 border-white bg-white px-3 py-2 text-right text-sm font-extrabold text-ink focus:border-teal focus:outline-none disabled:opacity-50"
              />
              <span className="text-sm font-bold text-ink-soft">minutos</span>
            </div>
            <p className="mt-1.5 text-[11px] leading-relaxed text-ink-soft">
              Cada cuánto se ofrece un horario en el formulario.
            </p>
          </div>
        </div>

        <div className="mt-4 rounded-2xl bg-cream px-4 py-3">
          <p className="text-sm font-bold text-ink">Cuántas citas a la misma hora</p>
          <p className="mt-1.5 text-[11px] leading-relaxed text-ink-soft">
            {peluqueros > 0 ? (
              <>
                Hay <strong>{peluqueros}</strong>{" "}
                {peluqueros === 1 ? "persona marcada" : "personas marcadas"} como que atiende
                citas en <em>Usuarios</em>, así que caben <strong>{capacidad}</strong>{" "}
                {capacidad === 1 ? "cita" : "citas"} por horario.
              </>
            ) : (
              <>
                Nadie está marcado como que atiende citas en <em>Usuarios</em>. Mientras tanto se
                usa la capacidad de respaldo — marque a los peluqueros para que la agenda se
                calcule sola.
              </>
            )}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <label htmlFor="fallback" className="text-xs font-bold text-ink-soft">
              Capacidad de respaldo
            </label>
            <input
              id="fallback"
              type="number"
              min={1}
              max={20}
              value={config.capacidadFallback}
              onChange={(e) => {
                setConfig((c) => ({ ...c, capacidadFallback: parseInt(e.target.value, 10) || 1 }));
                tocar();
              }}
              disabled={guardando}
              className="w-20 rounded-xl border-2 border-white bg-white px-3 py-2 text-right text-sm font-extrabold text-ink focus:border-teal focus:outline-none disabled:opacity-50"
            />
          </div>
        </div>

        <label className="mt-4 flex items-start gap-2 rounded-2xl bg-cream px-4 py-3">
          <input
            type="checkbox"
            checked={config.pendienteOcupa}
            onChange={(e) => {
              setConfig((c) => ({ ...c, pendienteOcupa: e.target.checked }));
              tocar();
            }}
            disabled={guardando}
            className="mt-0.5 h-4 w-4 flex-none accent-teal-dark"
          />
          <span className="text-xs leading-relaxed text-ink-soft">
            <strong className="text-ink">Una solicitud sin confirmar ocupa el cupo.</strong>{" "}
            Recomendado: evita que diez personas pidan la misma hora y haya que rechazar nueve a
            mano. Si lo apaga, solo bloquean las citas ya confirmadas.
          </span>
        </label>
      </div>

      <div className="rounded-3xl bg-white p-7 shadow-sm">
        <h2 className="font-display text-lg font-extrabold text-ink">Horarios de atención</h2>
        <p className="mt-1 text-xs text-ink-soft">
          Un día sin horarios no se ofrece. Puede poner dos tramos para dejar la colación fuera.
        </p>

        <div className="mt-5 space-y-4">
          {DIAS.map((dia) => {
            const propios = tramos
              .map((t, i) => ({ tramo: t, indice: i }))
              .filter(({ tramo }) => tramo.diaSemana === dia.valor);
            const bloques = bloquesPorDia(dia.valor);

            return (
              <div key={dia.valor} className="rounded-2xl bg-cream px-4 py-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-extrabold text-ink">{dia.nombre}</span>
                  {propios.length === 0 ? (
                    <span className="text-xs font-bold text-ink-soft">cerrado</span>
                  ) : (
                    <span className="text-xs text-ink-soft">
                      {bloques} {bloques === 1 ? "horario" : "horarios"} de{" "}
                      {config.duracionBloqueMin} min
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => agregarTramo(dia.valor)}
                    disabled={guardando}
                    className="ml-auto rounded-full bg-white px-3 py-1 text-xs font-bold text-teal-dark disabled:opacity-50"
                  >
                    + Tramo
                  </button>
                </div>

                {propios.map(({ tramo, indice }) => (
                  <div key={indice} className="mt-2 flex flex-wrap items-center gap-2">
                    <label className="sr-only" htmlFor={`inicio-${indice}`}>
                      Hora de apertura de {dia.nombre}
                    </label>
                    <input
                      id={`inicio-${indice}`}
                      type="time"
                      value={tramo.horaInicio}
                      onChange={(e) => actualizarTramo(indice, { horaInicio: e.target.value })}
                      disabled={guardando}
                      className="rounded-xl border-2 border-white bg-white px-3 py-2 text-sm font-bold text-ink focus:border-teal focus:outline-none disabled:opacity-50"
                    />
                    <span className="text-xs font-bold text-ink-soft">a</span>
                    <label className="sr-only" htmlFor={`fin-${indice}`}>
                      Hora de cierre de {dia.nombre}
                    </label>
                    <input
                      id={`fin-${indice}`}
                      type="time"
                      value={tramo.horaFin}
                      onChange={(e) => actualizarTramo(indice, { horaFin: e.target.value })}
                      disabled={guardando}
                      className="rounded-xl border-2 border-white bg-white px-3 py-2 text-sm font-bold text-ink focus:border-teal focus:outline-none disabled:opacity-50"
                    />
                    <label className="flex items-center gap-1.5 text-xs font-bold text-ink-soft">
                      <input
                        type="checkbox"
                        checked={tramo.activo}
                        onChange={(e) => actualizarTramo(indice, { activo: e.target.checked })}
                        disabled={guardando}
                        className="h-4 w-4 accent-teal-dark"
                      />
                      Activo
                    </label>
                    <button
                      type="button"
                      onClick={() => quitarTramo(indice)}
                      disabled={guardando}
                      className="ml-auto text-xs font-bold text-ink-soft underline underline-offset-2 hover:text-[#7a1030] disabled:opacity-50"
                    >
                      Quitar
                    </button>
                  </div>
                ))}
              </div>
            );
          })}
        </div>

        <div className="mt-7 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={guardar}
            disabled={guardando}
            className="rounded-full bg-teal px-7 py-3 font-display text-sm font-extrabold text-white shadow-[0_3px_0_rgba(6,58,64,.25)] transition-[background-color,transform,box-shadow] duration-150 hover:bg-teal-dark active:translate-y-0.5 active:shadow-[0_1px_0_rgba(6,58,64,.25)] disabled:cursor-not-allowed disabled:opacity-60 disabled:active:translate-y-0"
          >
            {guardando ? "Guardando…" : "Guardar disponibilidad"}
          </button>
          {guardado && !guardando && (
            <span className="text-sm font-bold text-teal-dark">
              ✓ Guardado — el formulario ya ofrece estos horarios
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
