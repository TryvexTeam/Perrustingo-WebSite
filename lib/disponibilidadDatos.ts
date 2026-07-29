import type { SupabaseClient } from "@supabase/supabase-js";
import {
  CONFIG_DEFAULT,
  MENSAJE_DIA_LLENO_DEFAULT,
  type DisponibilidadConfig,
  type Excepcion,
  type Tramo,
} from "./disponibilidad";

/* Lectura de la disponibilidad desde Supabase. Separado del motor
   (lib/disponibilidad.ts) para que el cálculo se pueda probar sin base de
   datos, y separado de los hooks para que lo puedan usar tanto el
   formulario (cliente) como el endpoint (servidor). */

/* eslint-disable @typescript-eslint/no-explicit-any -- el cliente de
   Supabase se recibe genérico: lo crean el navegador y el servidor con
   tipos distintos, y acá solo se usan `.from()` y `.rpc()`. */
type Cliente = SupabaseClient<any, any, any>;

export interface DisponibilidadCompleta {
  config: DisponibilidadConfig;
  tramos: Tramo[];
  capacidad: number;
}

interface FilaConfig {
  lead_time_dias: number;
  duracion_bloque_min: number;
  capacidad_fallback: number;
  pendiente_ocupa: boolean;
  max_citas_activas_telefono: number;
  mensaje_dia_lleno: string | null;
}

interface FilaTramo {
  dia_semana: number;
  hora_inicio: string;
  hora_fin: string;
  activo: boolean;
}

const COLUMNAS_CONFIG =
  "lead_time_dias, duracion_bloque_min, capacidad_fallback, pendiente_ocupa, max_citas_activas_telefono, mensaje_dia_lleno";

/* Sin `mensaje_dia_lleno`: el set que existía antes de la migración 026.
   Pedir una columna inexistente no devuelve null, devuelve error 42703 y se
   cae TODA la configuración — o sea, el formulario deja de ofrecer horarios.
   Una base sin migrar no puede tumbar las reservas. */
const COLUMNAS_CONFIG_LEGADO =
  "lead_time_dias, duracion_bloque_min, capacidad_fallback, pendiente_ocupa, max_citas_activas_telefono";

async function leerConfig(supabase: Cliente) {
  const intento = await supabase
    .from("disponibilidad_config")
    .select(COLUMNAS_CONFIG)
    .eq("singleton", true)
    .maybeSingle();

  if (!intento.error) return intento.data;

  const legado = await supabase
    .from("disponibilidad_config")
    .select(COLUMNAS_CONFIG_LEGADO)
    .eq("singleton", true)
    .maybeSingle();
  return legado.data;
}

export async function obtenerDisponibilidad(supabase: Cliente): Promise<DisponibilidadCompleta> {
  const [config, { data: tramos }, { data: capacidad }] = await Promise.all([
    leerConfig(supabase),
    supabase
      .from("disponibilidad_tramos")
      .select("dia_semana, hora_inicio, hora_fin, activo")
      .order("dia_semana"),
    supabase.rpc("capacidad_paralela"),
  ]);

  const c = config as FilaConfig | null;

  return {
    config: c
      ? {
          leadTimeDias: c.lead_time_dias,
          duracionBloqueMin: c.duracion_bloque_min,
          capacidadFallback: c.capacidad_fallback,
          pendienteOcupa: c.pendiente_ocupa,
          maxCitasActivasTelefono: c.max_citas_activas_telefono ?? CONFIG_DEFAULT.maxCitasActivasTelefono,
          // La columna llega vacía si la migración 026 todavía no se aplicó.
          mensajeDiaLleno: c.mensaje_dia_lleno?.trim() || MENSAJE_DIA_LLENO_DEFAULT,
        }
      : CONFIG_DEFAULT,
    tramos: ((tramos as FilaTramo[] | null) ?? []).map((t) => ({
      diaSemana: t.dia_semana,
      horaInicio: t.hora_inicio,
      horaFin: t.hora_fin,
      activo: t.activo,
    })),
    // La capacidad NUNCA debe quedar en 0 por un error de lectura: sería
    // cerrar la agenda entera en silencio. Si la función no responde, se
    // asume 1 (el local atiende a alguien).
    capacidad: typeof capacidad === "number" && capacidad > 0 ? capacidad : 1,
  };
}

/** Citas ya tomadas por bloque, en el rango pedido. La función de la DB
    devuelve solo (inicio, cantidad): ni nombres ni teléfonos, así que es
    seguro consultarla desde el formulario público. */
export async function obtenerOcupacion(
  supabase: Cliente,
  desdeISO: string,
  hastaISO: string
): Promise<Record<string, number>> {
  const { data } = await supabase.rpc("ocupacion_por_bloque", {
    desde: desdeISO,
    hasta: hastaISO,
  });

  const mapa: Record<string, number> = {};
  for (const fila of (data as { inicio: string; cantidad: number }[] | null) ?? []) {
    // Postgres devuelve el instante en UTC ("...Z") y los bloques se
    // generan con el offset de Santiago: hay que normalizar a un mismo
    // formato o ningún horario coincidiría nunca (y todo parecería libre).
    mapa[new Date(fila.inicio).toISOString()] = fila.cantidad;
  }
  return mapa;
}

/** Fechas bloqueadas por el local en un rango (migración 026).

    Pasa por la función `excepciones_en_rango`, no por la tabla: la tabla
    guarda además el motivo real ("vacaciones") y ese dato no sale al
    público. La función devuelve solo (fecha, mensaje), ya resuelto contra
    el texto por defecto de la config.

    Ante error devuelve lista vacía a propósito. Si la migración todavía no
    se aplicó no hay fechas bloqueadas que perder, y dejar caer el
    formulario entero por esto sería peor: se dejarían de vender horas
    reales por una tabla que no existe. El servidor valida igual (ver
    `evaluarReserva`), así que una lectura vacía acá no abre un hueco: el
    endpoint vuelve a consultar antes de aceptar. */
export async function obtenerExcepciones(
  supabase: Cliente,
  desde: string,
  hasta: string
): Promise<Excepcion[]> {
  const { data, error } = await supabase.rpc("excepciones_en_rango", { desde, hasta });
  if (error) return [];

  return ((data as { fecha: string; mensaje: string }[] | null) ?? []).map((f) => ({
    // Postgres devuelve DATE como "YYYY-MM-DD"; se compara como texto con la
    // fecha del formulario, así que no debe pasar por `new Date()` (correría
    // el día según el huso de quien lo lea).
    fecha: f.fecha.slice(0, 10),
    mensaje: f.mensaje,
  }));
}

/** Normaliza un instante a la clave con la que se consulta la ocupación. */
export function claveOcupacion(inicioISO: string): string {
  return new Date(inicioISO).toISOString();
}
