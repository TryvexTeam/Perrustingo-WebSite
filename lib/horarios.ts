/* Horario propio de cada peluquero — dominio puro, sin Supabase ni React.
 *
 * POR QUÉ EXISTE (pedido de Rodolfo, 5-ago): los tramos de disponibilidad son
 * del LOCAL —"los martes se atiende de 9 a 19"— y valen igual para todos. Si
 * alguien trabaja solo de tarde, entra más tarde los lunes o para a almorzar,
 * no había dónde escribirlo: había que cargarle un bloqueo a mano cada semana.
 *
 * LA REGLA QUE MANDA, y de la que cuelga todo lo demás: quien no tiene ningún
 * tramo configurado cuenta como que trabaja TODO el horario del local. Es el
 * comportamiento de hoy, y es lo que hace que aplicar esto no cambie nada hasta
 * que alguien configure su horario. Si la ausencia significara "no trabaja", el
 * día que se despliegue la agenda quedaría en cero para todo el mundo y el
 * negocio dejaría de recibir reservas sin que nadie hubiera tocado nada.
 *
 * LA COLACIÓN NO ES UN CAMPO. Se expresa partiendo la jornada en dos tramos
 * (9–13 y 14–18). Un campo aparte para el descanso obligaría a decidir qué pasa
 * si cae fuera de la jornada, si hay dos, o si alguien trabaja de corrido. Con
 * tramos no hay caso raro que inventar: lo que no está cubierto, no se trabaja.
 * El panel igual habla de "almuerzo", porque así lo piensa quien lo configura.
 */

/** Un tramo que una persona sí atiende. La colación es el hueco entre dos. */
export interface TramoPeluquero {
  /** Presente en lo que viene de la base; ausente en un tramo recién creado. */
  id?: string;
  /** 0 = domingo … 6 = sábado, igual que `Date.getDay()`. */
  diaSemana: number;
  /** "HH:MM" o "HH:MM:SS" como lo devuelve Postgres. */
  horaInicio: string;
  horaFin: string;
  activo: boolean;
}

/** Lo que el formulario público puede saber: cuántos atienden, nunca quiénes. */
export interface HorarioAgregado {
  diaSemana: number;
  horaInicio: string;
  horaFin: string;
  peluqueros: number;
}

export const DIAS_SEMANA = [
  "Domingo",
  "Lunes",
  "Martes",
  "Miércoles",
  "Jueves",
  "Viernes",
  "Sábado",
] as const;

/** Minutos desde medianoche de un "HH:MM[:SS]". */
export function aMinutos(hora: string): number {
  const [h, m] = hora.split(":");
  return parseInt(h, 10) * 60 + parseInt(m ?? "0", 10);
}

/** "09:00" a partir de los minutos. */
export function aHora(minutos: number): string {
  const h = Math.floor(minutos / 60);
  const m = minutos % 60;
  return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`;
}

/** Recorta "09:00:00" a "09:00" para los `<input type="time">`. */
export function horaCorta(hora: string): string {
  return hora.slice(0, 5);
}

/**
 * ¿Cuánta gente atiende en este minuto de este día de la semana?
 *
 * `sinHorario` son los peluqueros que no configuraron nada: cuentan siempre,
 * por la regla de arriba. Sin ese sumando, configurar a UNA persona haría
 * desaparecer de la cuenta a todas las demás.
 *
 * El resultado es la capacidad BASE del bloque. Los bloqueos puntuales (día
 * libre, hora médica) se restan después, en `capacidadEnMinuto` — son cosas
 * distintas: el horario dice "los martes trabajo de 14 a 19" y el bloqueo dice
 * "este martes no puedo".
 */
export function peluquerosEnMinuto(
  diaSemana: number,
  minuto: number,
  agregados: HorarioAgregado[],
  sinHorario: number
): number {
  let cuenta = sinHorario;
  for (const a of agregados) {
    if (a.diaSemana !== diaSemana) continue;
    if (minuto >= aMinutos(a.horaInicio) && minuto < aMinutos(a.horaFin)) {
      cuenta += a.peluqueros;
    }
  }
  return cuenta;
}

/**
 * Arma la función de capacidad que consume `bloquesDisponibles`.
 *
 * Devuelve `null` cuando no hay nada que aportar —la migración no está
 * aplicada, o todavía nadie configuró su horario— y en ese caso quien llama
 * sigue con la capacidad plana de siempre. Es la diferencia entre "no cambió
 * nada" y "la agenda quedó en cero": lo segundo dejaría al local sin recibir
 * reservas por una tabla vacía.
 */
export function capacidadSegunHorarios(
  datos: { agregados: HorarioAgregado[]; sinHorario: number; total: number } | null,
  diaSemanaDe: (fecha: string) => number
): ((fecha: string, minuto: number) => number) | null {
  if (!datos) return null;
  // Nadie configuró nada: todos siguen con el horario del local.
  if (datos.agregados.length === 0) return null;

  return (fecha, minuto) =>
    peluquerosEnMinuto(diaSemanaDe(fecha), minuto, datos.agregados, datos.sinHorario);
}

/** ¿Se pisan dos tramos? Se tocan en el borde (13:00 fin y 13:00 inicio) NO
    cuenta como solape: es exactamente cómo se escribe una jornada de corrido
    partida en dos. */
export function seSolapan(a: TramoPeluquero, b: TramoPeluquero): boolean {
  if (a.diaSemana !== b.diaSemana) return false;
  return aMinutos(a.horaInicio) < aMinutos(b.horaFin) && aMinutos(b.horaInicio) < aMinutos(a.horaFin);
}

/**
 * Valida los tramos de UNA persona antes de guardarlos.
 *
 * Devuelve los problemas escritos, no un booleano: quien configura tiene que
 * poder leer qué está mal y en qué día, no que "no se pudo guardar". Se
 * devuelven TODOS de una vez para no corregir de a uno por viaje a la base.
 */
export function validarHorario(tramos: TramoPeluquero[]): string[] {
  const problemas: string[] = [];

  for (const t of tramos) {
    const dia = DIAS_SEMANA[t.diaSemana] ?? `Día ${t.diaSemana}`;

    if (!/^\d{2}:\d{2}(:\d{2})?$/.test(t.horaInicio) || !/^\d{2}:\d{2}(:\d{2})?$/.test(t.horaFin)) {
      problemas.push(`${dia}: falta completar la hora de entrada o la de salida.`);
      continue;
    }
    /* El mismo CHECK que la base (`horario_tramo_con_sentido`). Se comprueba
       acá además de allá para que el mensaje diga qué día está mal, en vez de
       llegar como un error de Postgres que no nombra ninguno. */
    if (aMinutos(t.horaInicio) >= aMinutos(t.horaFin)) {
      problemas.push(`${dia}: la hora de salida (${horaCorta(t.horaFin)}) va antes que la de entrada (${horaCorta(t.horaInicio)}).`);
    }
  }

  /* Solapes. Dos tramos pisados en el mismo día contarían a la persona DOS
     veces en la capacidad de esa hora, y el formulario ofrecería un cupo que
     no existe: alguien llegaría con su perrito a una hora que nadie puede
     atender. */
  for (let i = 0; i < tramos.length; i++) {
    for (let j = i + 1; j < tramos.length; j++) {
      if (seSolapan(tramos[i], tramos[j])) {
        const dia = DIAS_SEMANA[tramos[i].diaSemana] ?? `Día ${tramos[i].diaSemana}`;
        problemas.push(
          `${dia}: dos horarios se pisan (${horaCorta(tramos[i].horaInicio)}–${horaCorta(tramos[i].horaFin)} y ${horaCorta(tramos[j].horaInicio)}–${horaCorta(tramos[j].horaFin)}). Para una colación, deje el hueco entre los dos.`
        );
      }
    }
  }

  return problemas;
}

/** Cómo se le lee el horario de un día a una persona, en palabras. */
export function resumenDelDia(tramos: TramoPeluquero[]): string {
  const activos = tramos
    .filter((t) => t.activo)
    .sort((a, b) => aMinutos(a.horaInicio) - aMinutos(b.horaInicio));

  if (activos.length === 0) return "Libre";

  const partes = activos.map((t) => `${horaCorta(t.horaInicio)}–${horaCorta(t.horaFin)}`);
  if (activos.length === 1) return partes[0];

  /* Con dos tramos seguidos, el hueco ES la colación y conviene nombrarla: es
     lo que la persona quiso configurar, y verlo escrito confirma que quedó
     como pensaba. */
  const hueco = aMinutos(activos[1].horaInicio) - aMinutos(activos[0].horaFin);
  if (activos.length === 2 && hueco > 0) {
    return `${partes[0]} y ${partes[1]} (colación de ${horaCorta(activos[0].horaFin)} a ${horaCorta(activos[1].horaInicio)})`;
  }
  return partes.join(" · ");
}
