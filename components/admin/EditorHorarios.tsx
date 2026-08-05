"use client";

import { useMemo, useState } from "react";
import { guardarHorarioAction } from "@/app/dashboard/horarios/actions";
import {
  DIAS_SEMANA,
  aHora,
  aMinutos,
  horaCorta,
  resumenDelDia,
  validarHorario,
  type TramoPeluquero,
} from "@/lib/horarios";

/* Horario propio de cada peluquero. La regla que hay que tener presente al
   leer esto: una persona SIN ningún tramo trabaja todo el horario del local.
   Por eso la pantalla nunca dice "sin horario" a secas —sonaría a que no
   trabaja— sino que lo explica.

   La colación no es un campo: es el hueco entre dos tramos. El botón la ofrece
   en palabras porque así la piensa quien configura, pero lo que se guarda son
   las horas que SÍ atiende. Ver el porqué en lib/horarios.ts. */

export interface PeluqueroConHorario {
  id: string;
  nombre: string;
  tramos: TramoPeluquero[];
}

interface EditorHorariosProps {
  peluqueros: PeluqueroConHorario[];
}

const CAMPO =
  "rounded-xl border-2 border-white bg-white px-3 py-2 text-sm font-semibold text-ink focus:border-teal focus:outline-none disabled:opacity-50";

/** Jornada que se propone al marcar un día que estaba libre. No se guarda sola:
    es lo que aparece en los campos para que nadie parta de 00:00 a 00:00. */
const JORNADA_SUGERIDA = { horaInicio: "09:00", horaFin: "18:00" };

export function EditorHorarios({ peluqueros }: EditorHorariosProps) {
  const [equipo, setEquipo] = useState<PeluqueroConHorario[]>(peluqueros);
  const [abierto, setAbierto] = useState<string | null>(peluqueros[0]?.id ?? null);
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [guardado, setGuardado] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [problemas, setProblemas] = useState<string[]>([]);

  const cambiar = (peluqueroId: string, tramos: TramoPeluquero[]) => {
    setEquipo((prev) => prev.map((p) => (p.id === peluqueroId ? { ...p, tramos } : p)));
    setGuardado(null);
    setError("");
    setProblemas([]);
  };

  const tramosDelDia = (p: PeluqueroConHorario, dia: number) =>
    p.tramos
      .filter((t) => t.diaSemana === dia)
      .sort((a, b) => aMinutos(a.horaInicio) - aMinutos(b.horaInicio));

  const alternarDia = (p: PeluqueroConHorario, dia: number) => {
    const tiene = tramosDelDia(p, dia).length > 0;
    if (tiene) {
      // Destildar el día lo deja libre: se quitan sus tramos.
      cambiar(p.id, p.tramos.filter((t) => t.diaSemana !== dia));
      return;
    }
    cambiar(p.id, [...p.tramos, { diaSemana: dia, ...JORNADA_SUGERIDA, activo: true }]);
  };

  const editarTramo = (
    p: PeluqueroConHorario,
    dia: number,
    indice: number,
    cambios: Partial<TramoPeluquero>
  ) => {
    let visto = -1;
    cambiar(
      p.id,
      p.tramos.map((t) => {
        if (t.diaSemana !== dia) return t;
        visto++;
        return visto === indice ? { ...t, ...cambios } : t;
      })
    );
  };

  /** Parte la jornada en dos y deja una hora de hueco: eso es la colación. */
  const agregarColacion = (p: PeluqueroConHorario, dia: number) => {
    const delDia = tramosDelDia(p, dia);
    if (delDia.length !== 1) return;

    const unico = delDia[0];
    const desde = aMinutos(unico.horaInicio);
    const hasta = aMinutos(unico.horaFin);
    // Al medio de la jornada, redondeado a la hora en punto.
    const medio = Math.floor((desde + hasta) / 2 / 60) * 60;
    const finColacion = Math.min(medio + 60, hasta);

    // Una jornada demasiado corta no da para partirse.
    if (medio <= desde || finColacion >= hasta) return;

    const resto = p.tramos.filter((t) => t.diaSemana !== dia);
    cambiar(p.id, [
      ...resto,
      { diaSemana: dia, horaInicio: unico.horaInicio, horaFin: aHora(medio), activo: true },
      { diaSemana: dia, horaInicio: aHora(finColacion), horaFin: unico.horaFin, activo: true },
    ]);
  };

  const quitarTramo = (p: PeluqueroConHorario, dia: number, indice: number) => {
    let visto = -1;
    cambiar(
      p.id,
      p.tramos.filter((t) => {
        if (t.diaSemana !== dia) return true;
        visto++;
        return visto !== indice;
      })
    );
  };

  const guardar = async (p: PeluqueroConHorario) => {
    const encontrados = validarHorario(p.tramos);
    if (encontrados.length > 0) {
      setProblemas(encontrados);
      setError("");
      return;
    }
    setOcupado(p.id);
    setError("");
    setProblemas([]);

    const resultado = await guardarHorarioAction(p.id, p.tramos);
    setOcupado(null);

    if (!resultado.success) {
      setProblemas(resultado.problemas ?? []);
      setError(resultado.error ?? (resultado.problemas ? "" : "No se pudo guardar."));
      return;
    }
    setGuardado(p.id);
  };

  if (equipo.length === 0) {
    return (
      <div className="rounded-3xl bg-white p-10 text-center shadow-sm">
        <p className="font-display text-lg font-extrabold text-ink">
          Todavía no hay nadie que atienda citas
        </p>
        <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-ink-soft">
          Marque a alguien como que atiende citas en <strong>Usuarios</strong> y
          después vuelva acá para darle su horario.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {error && (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-2xl bg-[#fbdbe7] px-4 py-3 text-xs font-semibold text-[#7a1030]"
        >
          <span aria-hidden="true">⚠️</span>
          {error}
        </div>
      )}

      {problemas.length > 0 && (
        <div
          role="alert"
          className="rounded-2xl bg-[#fbdbe7] px-4 py-3 text-xs font-semibold text-[#7a1030]"
        >
          <p className="font-extrabold">Revise esto antes de guardar:</p>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            {problemas.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
        </div>
      )}

      {equipo.map((p) => {
        const trabajando = ocupado === p.id;
        const estaAbierto = abierto === p.id;
        const sinNada = p.tramos.length === 0;

        return (
          <div key={p.id} className="rounded-3xl bg-white p-6 shadow-sm">
            <button
              type="button"
              onClick={() => setAbierto(estaAbierto ? null : p.id)}
              className="flex w-full items-center justify-between gap-3 text-left"
              aria-expanded={estaAbierto}
            >
              <span>
                <span className="font-display text-lg font-extrabold text-ink">{p.nombre}</span>
                <span className="mt-0.5 block text-[11px] font-semibold text-ink-soft">
                  {sinNada
                    ? "Sigue el horario del local (todos los días que el local atiende)"
                    : DiasResumidos(p)}
                </span>
              </span>
              <span className="text-xs font-bold text-teal-dark">
                {estaAbierto ? "Cerrar" : "Editar"}
              </span>
            </button>

            {estaAbierto && (
              <div className="mt-5 space-y-3">
                {sinNada && (
                  <p className="rounded-2xl bg-[#fde4c8] px-4 py-3 text-[11px] font-semibold leading-relaxed text-[#7a4d10]">
                    Sin horario propio, esta persona cuenta como disponible en todo
                    el horario del local. Marque los días que trabaja para
                    ajustarlo — los que deje sin marcar pasan a ser libres.
                  </p>
                )}

                {DIAS_SEMANA.map((nombreDia, dia) => {
                  const delDia = tramosDelDia(p, dia);
                  const trabaja = delDia.length > 0;

                  return (
                    <div key={dia} className="rounded-2xl bg-cream px-4 py-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <label className="flex items-center gap-2 text-sm font-bold text-ink">
                          <input
                            type="checkbox"
                            checked={trabaja}
                            onChange={() => alternarDia(p, dia)}
                            disabled={trabajando}
                            className="h-4 w-4 accent-teal-dark"
                          />
                          {nombreDia}
                        </label>

                        <span className="text-[11px] font-semibold text-ink-soft">
                          {resumenDelDia(delDia)}
                        </span>
                      </div>

                      {trabaja && (
                        <div className="mt-3 space-y-2">
                          {delDia.map((t, i) => (
                            <div key={i} className="flex flex-wrap items-center gap-2">
                              <input
                                type="time"
                                aria-label={`${nombreDia}: hora de entrada`}
                                value={horaCorta(t.horaInicio)}
                                onChange={(e) =>
                                  editarTramo(p, dia, i, { horaInicio: e.target.value })
                                }
                                disabled={trabajando}
                                className={CAMPO}
                              />
                              <span className="text-xs font-bold text-ink-soft">a</span>
                              <input
                                type="time"
                                aria-label={`${nombreDia}: hora de salida`}
                                value={horaCorta(t.horaFin)}
                                onChange={(e) => editarTramo(p, dia, i, { horaFin: e.target.value })}
                                disabled={trabajando}
                                className={CAMPO}
                              />
                              {delDia.length > 1 && (
                                <button
                                  type="button"
                                  onClick={() => quitarTramo(p, dia, i)}
                                  disabled={trabajando}
                                  className="text-[11px] font-bold text-[#7a1030] underline underline-offset-2"
                                >
                                  quitar
                                </button>
                              )}
                            </div>
                          ))}

                          {delDia.length === 1 && (
                            <button
                              type="button"
                              onClick={() => agregarColacion(p, dia)}
                              disabled={trabajando}
                              className="text-[11px] font-bold text-teal-dark underline underline-offset-2"
                            >
                              + Agregar colación
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}

                <div className="flex flex-wrap items-center gap-3 pt-1">
                  <button
                    type="button"
                    onClick={() => guardar(p)}
                    disabled={trabajando}
                    className="rounded-full bg-teal-dark px-5 py-2 text-sm font-bold text-white disabled:opacity-50"
                  >
                    {trabajando ? "Guardando…" : "Guardar horario"}
                  </button>
                  {guardado === p.id && (
                    <span className="text-xs font-bold text-teal-dark">Guardado ✓</span>
                  )}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/** "Lun, Mar, Vie" — para ver de un vistazo quién trabaja qué días. */
function DiasResumidos(p: PeluqueroConHorario): string {
  const dias = [...new Set(p.tramos.map((t) => t.diaSemana))].sort((a, b) => a - b);
  if (dias.length === 0) return "Sin días marcados";
  return dias.map((d) => DIAS_SEMANA[d].slice(0, 3)).join(", ");
}
