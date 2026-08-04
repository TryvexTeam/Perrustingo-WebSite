/* Política de atrasos y cancelaciones — dominio puro, sin React ni Supabase.
 *
 * POR QUÉ ESTÁ SEPARADO: el recargo por atraso es plata que se le cobra a un
 * cliente en la puerta del local. Ese cálculo tiene que poder leerse, probarse
 * y discutirse sin arrastrar un navegador ni una base de datos detrás. Lo que
 * decide cuánto se cobra vive acá; lo que decide SI se cobra es el equipo.
 *
 * POR QUÉ TODO SE APAGA CON UN SOLO BOOLEANO: `activa = false` no es una
 * preferencia, es el estado de fábrica (migración 035). Un recargo solo es
 * defendible si el cliente lo aceptó al reservar, y hoy el formulario todavía
 * no se lo comunica. Por eso cada función de dinero pregunta primero por
 * `pol.activa` y devuelve el resultado neutro: encender la política es una
 * decisión del dueño, no un descuido de configuración.
 */

/* Único import del módulo, y solo de tipos: no entra código de Supabase acá.
   El cliente llega por parámetro, así que sirve tanto el del navegador como el
   del servidor. */
import type { SupabaseClient } from "@supabase/supabase-js";

export interface PoliticaCitas {
  /** Interruptor maestro. Apagada = no se cobra ni se penaliza nada. */
  readonly activa: boolean;
  /** Minutos de atraso que el local tolera antes de decidir si toma la cita. */
  readonly toleranciaMin: number;
  /** Tasa de referencia por hora de atraso, en pesos. Se prorratea. */
  readonly recargoAtrasoHora: number;
  /** Cancelar con menos de estas horas de anticipación penaliza. */
  readonly cancelacionHoras: number;
  /** Recargo que se arrastra a la SIGUIENTE cita, en porcentaje. */
  readonly cancelacionPct: number;
  /** Si cancelar hace perder el cupón usado. */
  readonly pierdeCupon: boolean;
  /** Lo que se le muestra al cliente ANTES de reservar. */
  readonly textoCliente: string;
}

/* Los mismos valores que siembra la migración 035. Se repiten acá para que la
   página no quede sin nada que mostrar si la lectura falla — pero con
   `activa: false`, que es lo único que importa que no se equivoque: ante duda,
   no se cobra. */
export const POLITICA_DEFAULT: PoliticaCitas = {
  activa: false,
  toleranciaMin: 30,
  recargoAtrasoHora: 5000,
  cancelacionHoras: 24,
  cancelacionPct: 30,
  pierdeCupon: true,
  textoCliente:
    "Le esperamos hasta 30 minutos. Pasado ese tiempo se aplica un recargo proporcional ($5.000 por hora) y la entrega se corre. Puede cancelar gratis desde su correo hasta 24 horas antes; después, su próxima cita tendrá un recargo del 30% y se pierde el cupón usado.",
};

/**
 * Cuánto propone cobrar el atraso.
 *
 * PRORRATEADO, no por bloques: cobrar la hora completa por 10 minutos de
 * atraso es lo que hace que una regla razonable se sienta un castigo. Media
 * hora con la tasa de $5.000 da exactamente $2.500, que es el número que el
 * dueño confirmó el 4-ago.
 *
 * El redondeo va a la centena porque en Chile nadie cobra $3.333: un cliente
 * que llega 40 minutos tarde ve "+$3.300" y entiende de dónde sale.
 *
 * Devuelve 0 con la política apagada. Ese cero es la garantía de que instalar
 * la capacidad no cobra nada por sí sola.
 */
export function recargoPorAtraso(minutosAtraso: number, pol: PoliticaCitas): number {
  if (!pol.activa) return 0;
  if (!Number.isFinite(minutosAtraso) || minutosAtraso <= 0) return 0;
  if (pol.recargoAtrasoHora <= 0) return 0;
  const exacto = (minutosAtraso / 60) * pol.recargoAtrasoHora;
  return Math.round(exacto / 100) * 100;
}

/**
 * ¿El atraso pasó el límite que el local aguanta?
 *
 * No decide nada por sí sola: pasada la tolerancia, el equipo decide si toma
 * la cita o no. Esta función solo le pone el nombre a esa frontera para que el
 * panel pueda avisar en vez de que el peluquero calcule de memoria.
 */
export function excedeTolerancia(minutosAtraso: number, pol: PoliticaCitas): boolean {
  if (!pol.activa) return false;
  if (!Number.isFinite(minutosAtraso)) return false;
  return minutosAtraso > pol.toleranciaMin;
}

/**
 * Minutos entre la hora agendada y la llegada real.
 *
 * Llegar antes o puntual es 0, nunca negativo: un número negativo acá se
 * multiplicaría por la tasa y terminaría como un descuento que nadie ofreció.
 * Los segundos se truncan hacia abajo — cobrar por un minuto que todavía no
 * termina de correr es indefendible frente al cliente.
 */
export function minutosDeAtraso(horaCita: string | Date, horaLlegada: string | Date): number {
  const cita = horaCita instanceof Date ? horaCita : new Date(horaCita);
  const llegada = horaLlegada instanceof Date ? horaLlegada : new Date(horaLlegada);
  if (isNaN(cita.getTime()) || isNaN(llegada.getTime())) return 0;
  const diff = llegada.getTime() - cita.getTime();
  if (diff <= 0) return 0;
  return Math.floor(diff / 60_000);
}

/**
 * ¿Cancelar ahora deja recargo para la próxima cita?
 *
 * Cancelar es siempre gratis en el momento: lo que hace la cancelación tardía
 * es dejar un recargo pendiente. Con la política apagada no deja nada.
 *
 * Una cita ya pasada no se penaliza acá: eso es un "no se presentó", que es
 * otro problema y se conversa, no se cobra por una regla de horas.
 */
export function penalizaCancelacion(
  fechaCita: string | Date,
  ahora: Date,
  pol: PoliticaCitas
): boolean {
  if (!pol.activa) return false;
  const cita = fechaCita instanceof Date ? fechaCita : new Date(fechaCita);
  if (isNaN(cita.getTime())) return false;
  const horasFaltantes = (cita.getTime() - ahora.getTime()) / 3_600_000;
  if (horasFaltantes <= 0) return false;
  return horasFaltantes < pol.cancelacionHoras;
}

/** La fila de `politica_citas` tal como la devuelve PostgREST. */
interface FilaPolitica {
  activa: boolean | null;
  tolerancia_min: number | null;
  recargo_atraso_hora: number | null;
  cancelacion_horas: number | null;
  cancelacion_pct: number | string | null;
  pierde_cupon: boolean | null;
  texto_cliente: string | null;
}

/** Traduce la fila a dominio. `numeric` llega como string en PostgREST. */
export function filaAPolitica(fila: FilaPolitica): PoliticaCitas {
  return {
    activa: fila.activa ?? false,
    toleranciaMin: fila.tolerancia_min ?? POLITICA_DEFAULT.toleranciaMin,
    recargoAtrasoHora: fila.recargo_atraso_hora ?? POLITICA_DEFAULT.recargoAtrasoHora,
    cancelacionHoras: fila.cancelacion_horas ?? POLITICA_DEFAULT.cancelacionHoras,
    cancelacionPct: Number(fila.cancelacion_pct ?? POLITICA_DEFAULT.cancelacionPct),
    pierdeCupon: fila.pierde_cupon ?? POLITICA_DEFAULT.pierdeCupon,
    textoCliente: fila.texto_cliente ?? POLITICA_DEFAULT.textoCliente,
  };
}

/**
 * Lee la política de la base.
 *
 * Ante cualquier fallo cae en `POLITICA_DEFAULT`, que viene apagada. Un error
 * de red no puede terminar en un cobro: si no se sabe qué dice la política, no
 * se cobra. La caída se registra igual — un fallback silencioso que además
 * miente sobre el estado es peor que el error original.
 */
export async function obtenerPolitica(supabase: SupabaseClient): Promise<PoliticaCitas> {
  try {
    const { data, error } = await supabase
      .from("politica_citas")
      .select(
        "activa, tolerancia_min, recargo_atraso_hora, cancelacion_horas, cancelacion_pct, pierde_cupon, texto_cliente"
      )
      .maybeSingle();

    if (error || !data) {
      if (error) console.warn("[politica] no se pudo leer, se usa la de fábrica (apagada):", error);
      return POLITICA_DEFAULT;
    }
    return filaAPolitica(data);
  } catch (e) {
    console.warn("[politica] lectura fallida, se usa la de fábrica (apagada):", e);
    return POLITICA_DEFAULT;
  }
}

/** Cómo se le explica el atraso a una persona: el porqué del número. */
export function explicarAtraso(minutosAtraso: number, pol: PoliticaCitas): string {
  if (minutosAtraso <= 0) return "Llegó a la hora: sin recargo.";
  if (!pol.activa) {
    return `Llegó ${minutosAtraso} min tarde. La política está apagada: no se propone recargo.`;
  }
  const monto = recargoPorAtraso(minutosAtraso, pol);
  const base = `Llegó ${minutosAtraso} min tarde → +${formatoPesos(monto)}`;
  return excedeTolerancia(minutosAtraso, pol)
    ? `${base} (pasó los ${pol.toleranciaMin} min de tolerancia: el equipo decide si toma la cita)`
    : base;
}

/* Formateo local y mínimo: este módulo no debe depender de lib/reserva, que
   arrastra el resto del dominio de precios. */
function formatoPesos(n: number): string {
  return "$" + Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}
