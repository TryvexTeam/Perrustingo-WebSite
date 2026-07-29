import { offsetNegocio } from "./agenda";

/* Motor de disponibilidad (PRP-001 Fase 5).

   Tres reglas, que antes no existían:
     1. lead time  — cuánta anticipación mínima exige el local
     2. tramos     — qué horas se atienden cada día
     3. capacidad  — cuántas citas caben a la misma hora (peluqueros)

   Todo el cálculo vive acá, puro y sin React ni Supabase, porque lo usan
   DOS lados que no pueden discrepar: el formulario (para ofrecer horarios)
   y el endpoint (para aceptar o rechazar la reserva). Si cada uno tuviera
   su propia versión, la UI ofrecería cupos que el servidor rechaza.

   Zona horaria: todo se ancla a America/Santiago vía `offsetNegocio()`,
   que devuelve -04:00 o -03:00 según el horario de verano. El navegador de
   un cliente puede estar en otra zona y el servidor corre en UTC; sin fijar
   el huso, una cita de las 9:00 se convierte en otra hora en cada capa. */

/* Offset por defecto. NO se usa para construir instantes — para eso está
   `offsetNegocio(fecha)` de lib/agenda.ts, que devuelve -04:00 o -03:00 según
   el horario de verano chileno. Fijarlo a mano corría las citas una hora
   entre septiembre y abril. Queda solo como valor de referencia. */
export const TZ_OFFSET = "-04:00";

export interface DisponibilidadConfig {
  leadTimeDias: number;
  duracionBloqueMin: number;
  capacidadFallback: number;
  pendienteOcupa: boolean;
  /** Citas sin completar que puede tener un mismo teléfono. 0 = sin tope.
      Lo aplica un trigger en la base (migración 017), no la aplicación:
      un control que vive solo en el código se puede rodear yendo directo
      a la API. */
  maxCitasActivasTelefono: number;
  /** Texto por defecto de una fecha bloqueada (migración 026). Editable
      desde el panel: es lo que leen los clientes de Rodolfo. */
  mensajeDiaLleno: string;
}

export const MENSAJE_DIA_LLENO_DEFAULT =
  "Los cupos de este día ya están tomados. Pruebe con otra fecha 🐾";

export const CONFIG_DEFAULT: DisponibilidadConfig = {
  leadTimeDias: 1,
  duracionBloqueMin: 60,
  capacidadFallback: 1,
  pendienteOcupa: true,
  maxCitasActivasTelefono: 4,
  mensajeDiaLleno: MENSAJE_DIA_LLENO_DEFAULT,
};

export interface Tramo {
  /** 0 = domingo … 6 = sábado (igual que Date.getDay()). */
  diaSemana: number;
  /** "HH:MM" o "HH:MM:SS" como los devuelve Postgres. */
  horaInicio: string;
  horaFin: string;
  activo: boolean;
}

export interface Bloque {
  /** Instante de inicio en ISO con offset de Santiago. */
  inicio: string;
  /** "09:00" — para mostrar. */
  etiqueta: string;
  /** Cuántos cupos quedan libres. */
  libres: number;
}

/** Una fecha que el local decidió no atender (migración 026).

    Se modela aparte de los tramos porque son cosas distintas: el tramo dice
    "los martes se atiende de 9 a 19" y la excepción dice "este martes no".
    Meterlo en los tramos obligaría a desactivar todos los martes.

    `mensaje` es lo que lee el cliente, y por pedido de Rodolfo habla de
    cupos agotados, no de local cerrado: un día libre no debe leerse como
    que el negocio no está funcionando. El motivo real no viaja hasta acá
    —se queda en la base— así que este objeto es seguro de mandar al
    navegador. */
export interface Excepcion {
  /** YYYY-MM-DD. */
  fecha: string;
  mensaje: string;
}

/** Texto que se muestra cuando no hay nada que ofrecer y la fecha no está
    bloqueada a mano: el día simplemente se llenó o no se atiende. */
export const MENSAJE_SIN_CUPO = "Ese día no queda ningún horario libre. Pruebe con otra fecha 🐾";

/** La excepción de esa fecha, si la hay. */
export function excepcionDe(fecha: string, excepciones: Excepcion[]): Excepcion | null {
  return excepciones.find((e) => e.fecha === fecha) ?? null;
}

/** Minutos desde medianoche de un "HH:MM[:SS]". */
function aMinutos(hora: string): number {
  const [h, m] = hora.split(":");
  return parseInt(h, 10) * 60 + parseInt(m ?? "0", 10);
}

function dosDigitos(n: number): string {
  return n.toString().padStart(2, "0");
}

export function etiquetaHora(minutos: number): string {
  return `${dosDigitos(Math.floor(minutos / 60))}:${dosDigitos(minutos % 60)}`;
}

/** Fecha de hoy en Santiago, como YYYY-MM-DD. */
export function hoyEnSantiago(ahora: Date = new Date()): string {
  return ahora.toLocaleDateString("en-CA", { timeZone: "America/Santiago" });
}

/** Suma días a una fecha YYYY-MM-DD sin pasar por Date (evita que el huso
    del entorno corra el resultado un día). */
export function sumarDias(fecha: string, dias: number): string {
  const [a, m, d] = fecha.split("-").map(Number);
  const base = new Date(Date.UTC(a, m - 1, d));
  base.setUTCDate(base.getUTCDate() + dias);
  return base.toISOString().slice(0, 10);
}

/** Primera fecha reservable según el lead time. Con lead time 2 y hoy 10,
    la primera es el 12. */
export function primeraFechaReservable(
  config: DisponibilidadConfig,
  ahora: Date = new Date()
): string {
  return sumarDias(hoyEnSantiago(ahora), config.leadTimeDias);
}

export function cumpleLeadTime(
  fecha: string,
  config: DisponibilidadConfig,
  ahora: Date = new Date()
): boolean {
  return fecha >= primeraFechaReservable(config, ahora);
}

/** Día de la semana (0-6) de un YYYY-MM-DD, leído como fecha de Santiago. */
export function diaSemanaDe(fecha: string): number {
  const [a, m, d] = fecha.split("-").map(Number);
  return new Date(Date.UTC(a, m - 1, d)).getUTCDay();
}

/** Instante ISO del bloque que empieza a `minutos` del día `fecha`.
    Usa el offset real de esa fecha en Chile (DST), no uno fijo. */
export function instanteDeBloque(fecha: string, minutos: number): string {
  return `${fecha}T${etiquetaHora(minutos)}:00${offsetNegocio(fecha)}`;
}

/** Clave canónica de un instante (UTC). El mismo momento se escribe de dos
    formas: Postgres lo devuelve en UTC y los bloques se arman con el offset
    de Santiago. Comparados como texto no coinciden nunca — y un horario
    lleno se vería libre. Todo lo que toque la ocupación pasa por acá. */
export function claveInstante(inicio: string): string {
  return new Date(inicio).toISOString();
}

function normalizarOcupacion(ocupacion: Record<string, number>): Record<string, number> {
  const mapa: Record<string, number> = {};
  for (const [clave, valor] of Object.entries(ocupacion)) {
    mapa[claveInstante(clave)] = valor;
  }
  return mapa;
}

/** Los inicios de bloque que el local atiende ese día, en minutos.
    Un bloque solo cuenta si CABE COMPLETO en el tramo: ofrecer las 18:30
    en un tramo que cierra a las 19:00 con bloques de 60 min sería vender
    media hora que no existe. */
export function bloquesDelDia(
  fecha: string,
  tramos: Tramo[],
  config: DisponibilidadConfig
): number[] {
  const dia = diaSemanaDe(fecha);
  const delDia = tramos.filter((t) => t.activo && t.diaSemana === dia);

  const inicios = new Set<number>();
  for (const tramo of delDia) {
    const desde = aMinutos(tramo.horaInicio);
    const hasta = aMinutos(tramo.horaFin);
    for (let m = desde; m + config.duracionBloqueMin <= hasta; m += config.duracionBloqueMin) {
      inicios.add(m);
    }
  }
  return [...inicios].sort((a, b) => a - b);
}

/** Bloques ofrecibles de un día: los que el local atiende, menos los que ya
    están llenos, menos los que quedaron atrás si el día es hoy. */
export function bloquesDisponibles(
  fecha: string,
  tramos: Tramo[],
  config: DisponibilidadConfig,
  capacidad: number,
  ocupacion: Record<string, number>,
  ahora: Date = new Date(),
  excepciones: Excepcion[] = []
): Bloque[] {
  if (!cumpleLeadTime(fecha, config, ahora)) return [];
  // Una fecha bloqueada no ofrece nada, aunque el tramo semanal la atienda.
  if (excepcionDe(fecha, excepciones)) return [];

  const esHoy = fecha === hoyEnSantiago(ahora);
  const minutosAhora = esHoy
    ? (() => {
        const partes = ahora.toLocaleTimeString("en-GB", {
          timeZone: "America/Santiago",
          hour12: false,
        });
        return aMinutos(partes);
      })()
    : -1;

  const tomados = normalizarOcupacion(ocupacion);

  return bloquesDelDia(fecha, tramos, config)
    .filter((m) => !esHoy || m > minutosAhora)
    .map((m) => {
      const inicio = instanteDeBloque(fecha, m);
      const usados = tomados[claveInstante(inicio)] ?? 0;
      return { inicio, etiqueta: etiquetaHora(m), libres: Math.max(0, capacidad - usados) };
    })
    .filter((b) => b.libres > 0);
}

export type MotivoRechazo =
  | "lead_time"
  | "fuera_de_horario"
  | "sin_cupo"
  | "fecha_invalida"
  /* El local bloqueó esa fecha a mano. Se distingue de `sin_cupo` para poder
     medirlo y depurarlo, pero el MENSAJE que recibe el cliente habla de
     cupos: el motivo nunca sale de la aplicación (el endpoint devuelve
     `mensaje`, no `motivo`). */
  | "dia_bloqueado";

export interface Veredicto {
  ok: boolean;
  motivo?: MotivoRechazo;
  /** Explicación lista para mostrarle a la persona. Un rechazo sin motivo
      es indiagnosticable para quien lo recibe. */
  mensaje?: string;
}

const FORMATO_FECHA = /^\d{4}-\d{2}-\d{2}$/;

/** ¿Se puede aceptar esta reserva? Es la función que manda: el formulario la
    usa para no ofrecer lo imposible y el endpoint para no aceptarlo.
    `cupos` es cuántas citas entran de una vez (una reserva de 3 perritos
    ocupa 3 lugares del mismo bloque). */
export function evaluarReserva(params: {
  fecha: string;
  inicio: string;
  tramos: Tramo[];
  config: DisponibilidadConfig;
  capacidad: number;
  ocupacion: Record<string, number>;
  cupos?: number;
  ahora?: Date;
  excepciones?: Excepcion[];
}): Veredicto {
  const { fecha, inicio, tramos, config, capacidad, ocupacion } = params;
  const cupos = params.cupos ?? 1;
  const ahora = params.ahora ?? new Date();
  const excepciones = params.excepciones ?? [];

  if (!FORMATO_FECHA.test(fecha)) {
    return { ok: false, motivo: "fecha_invalida", mensaje: "La fecha no es válida." };
  }

  /* Antes que nada: la fecha puede estar bloqueada aunque el tramo semanal
     la atienda y aunque queden cupos. Esta comprobación tiene que vivir acá
     y no solo en la pantalla — si el formulario esconde el día pero el
     endpoint lo acepta, basta con mandar el request a mano para reservar el
     día libre de Rodolfo. */
  const bloqueada = excepcionDe(fecha, excepciones);
  if (bloqueada) {
    return { ok: false, motivo: "dia_bloqueado", mensaje: bloqueada.mensaje };
  }

  if (!cumpleLeadTime(fecha, config, ahora)) {
    const dias = config.leadTimeDias;
    return {
      ok: false,
      motivo: "lead_time",
      mensaje:
        dias === 1
          ? "Las reservas se piden con al menos un día de anticipación."
          : `Las reservas se piden con al menos ${dias} días de anticipación.`,
    };
  }

  const minutosValidos = bloquesDelDia(fecha, tramos, config);
  const esperados = minutosValidos.map((m) => claveInstante(instanteDeBloque(fecha, m)));
  if (!esperados.includes(claveInstante(inicio))) {
    return {
      ok: false,
      motivo: "fuera_de_horario",
      mensaje: "Ese horario no está dentro de la atención de ese día.",
    };
  }

  const usados = normalizarOcupacion(ocupacion)[claveInstante(inicio)] ?? 0;
  if (usados + cupos > capacidad) {
    const libres = Math.max(0, capacidad - usados);
    return {
      ok: false,
      motivo: "sin_cupo",
      mensaje:
        libres === 0
          ? "Ese horario ya está tomado. Elija otro, por favor."
          : `A esa hora queda ${libres} cupo y usted pidió ${cupos}.`,
    };
  }

  return { ok: true };
}
