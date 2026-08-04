"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { diaSemanaDe } from "@/lib/disponibilidad";

interface ResultadoAccion {
  success: boolean;
  error?: string;
}

export interface TramoEditable {
  diaSemana: number;
  horaInicio: string;
  horaFin: string;
  activo: boolean;
}

export interface ConfigEditable {
  leadTimeDias: number;
  duracionBloqueMin: number;
  capacidadFallback: number;
  pendienteOcupa: boolean;
  maxCitasActivasTelefono: number;
  mensajeDiaLleno: string;
}

/** Una fecha bloqueada tal como la edita el admin. A diferencia de lo que
    ve el cliente, acá sí viaja `notaInterna`: es la pantalla de Rodolfo. */
export interface ExcepcionEditable {
  /** YYYY-MM-DD. */
  fecha: string;
  /** Vacío = usar el texto general de la config. */
  mensaje: string;
  notaInterna: string;
}

/* Escrituras de la disponibilidad (PRP-001 Fase 5). Guard admin + RLS,
   igual que el resto del panel. */

async function exigirAdmin(): Promise<
  { supabase: Awaited<ReturnType<typeof createClient>> } | { error: string }
> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Sesión expirada." };

  const { data: perfil } = await supabase
    .from("perfiles")
    .select("rol")
    .eq("id", user.id)
    .single();
  if (perfil?.rol !== "admin") return { error: "Sin permisos." };

  return { supabase };
}

const HORA = /^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/;

/** Guarda las reglas generales y los tramos de cada día en un solo paso.
    Los tramos se reemplazan completos porque quitar uno es tan válido como
    agregarlo, y un upsert parcial dejaría vivos los que el admin borró. */
export async function guardarDisponibilidadAction(
  config: ConfigEditable,
  tramos: TramoEditable[]
): Promise<ResultadoAccion> {
  const sesion = await exigirAdmin();
  if ("error" in sesion) return { success: false, error: sesion.error };

  if (
    !Number.isInteger(config.leadTimeDias) ||
    config.leadTimeDias < 0 ||
    config.leadTimeDias > 60
  ) {
    return { success: false, error: "La anticipación debe estar entre 0 y 60 días." };
  }
  if (
    !Number.isInteger(config.duracionBloqueMin) ||
    config.duracionBloqueMin < 15 ||
    config.duracionBloqueMin > 240
  ) {
    return { success: false, error: "El bloque debe durar entre 15 y 240 minutos." };
  }
  if (
    !Number.isInteger(config.capacidadFallback) ||
    config.capacidadFallback < 1 ||
    config.capacidadFallback > 20
  ) {
    return { success: false, error: "La capacidad de respaldo debe estar entre 1 y 20." };
  }
  if (
    !Number.isInteger(config.maxCitasActivasTelefono) ||
    config.maxCitasActivasTelefono < 0 ||
    config.maxCitasActivasTelefono > 50
  ) {
    return { success: false, error: "El tope por teléfono debe estar entre 0 y 50." };
  }
  const mensajeDiaLleno = config.mensajeDiaLleno.trim();
  if (mensajeDiaLleno.length < 1 || mensajeDiaLleno.length > 200) {
    return {
      success: false,
      error: "El mensaje de día sin cupo debe tener entre 1 y 200 caracteres.",
    };
  }

  for (const tramo of tramos) {
    if (!Number.isInteger(tramo.diaSemana) || tramo.diaSemana < 0 || tramo.diaSemana > 6) {
      return { success: false, error: "Día inválido." };
    }
    if (!HORA.test(tramo.horaInicio) || !HORA.test(tramo.horaFin)) {
      return { success: false, error: "Las horas deben tener formato HH:MM." };
    }
    if (tramo.horaFin <= tramo.horaInicio) {
      // El CHECK de la migración lo rechazaría igual, pero con un error de
      // Postgres: mejor decirlo en palabras antes de llegar allá.
      return { success: false, error: "La hora de cierre debe ser posterior a la de apertura." };
    }
  }

  const { error: errorConfig, data: filaConfig } = await sesion.supabase
    .from("disponibilidad_config")
    .update({
      lead_time_dias: config.leadTimeDias,
      duracion_bloque_min: config.duracionBloqueMin,
      capacidad_fallback: config.capacidadFallback,
      pendiente_ocupa: config.pendienteOcupa,
      max_citas_activas_telefono: config.maxCitasActivasTelefono,
      mensaje_dia_lleno: mensajeDiaLleno,
      updated_at: new Date().toISOString(),
    })
    .eq("singleton", true)
    .select("singleton");

  if (errorConfig) {
    return {
      success: false,
      error:
        errorConfig.code === "42501"
          ? "La base de datos rechazó el cambio (permisos)."
          : "No se pudo guardar la configuración.",
    };
  }
  if (!filaConfig || filaConfig.length === 0) {
    return { success: false, error: "No se guardó la configuración (permisos)." };
  }

  /* Reemplazo completo de los tramos. Desde acá no hay transacción —
     PostgREST hace una petición por operación—, así que borrar-e-insertar
     tiene un hueco: si el insert falla después del borrado, el salón queda
     SIN NINGÚN horario publicado y el formulario no ofrece ninguna hora, en
     silencio, hasta que alguien vuelva a guardar (con tramos vacíos no hay
     fallback: `obtenerDisponibilidad` devuelve lista vacía tal cual).
     Se leen los tramos vigentes antes de borrar para poder restaurarlos. */
  const { data: tramosPrevios } = await sesion.supabase
    .from("disponibilidad_tramos")
    .select("dia_semana, hora_inicio, hora_fin, activo");

  const { error: errorBorrado } = await sesion.supabase
    .from("disponibilidad_tramos")
    .delete()
    .gte("dia_semana", 0);
  if (errorBorrado) return { success: false, error: "No se pudieron actualizar los horarios." };

  if (tramos.length > 0) {
    const { error: errorInsert } = await sesion.supabase.from("disponibilidad_tramos").insert(
      tramos.map((t) => ({
        dia_semana: t.diaSemana,
        hora_inicio: t.horaInicio,
        hora_fin: t.horaFin,
        activo: t.activo,
      }))
    );
    if (errorInsert) {
      /* Restaurar lo que había. Si también falla, decirlo con todas sus
         letras: "no se guardó" a secas dejaría creer que el horario anterior
         sigue vigente, cuando en realidad no queda ninguno. */
      if (tramosPrevios && tramosPrevios.length > 0) {
        const { error: errorRestauracion } = await sesion.supabase
          .from("disponibilidad_tramos")
          .insert(tramosPrevios);
        if (errorRestauracion) {
          console.error("[disponibilidad] tramos borrados y sin restaurar", {
            mensaje: errorRestauracion.message,
          });
          return {
            success: false,
            error:
              "No se guardaron los horarios Y el horario anterior no se pudo restaurar: " +
              "ahora mismo el sitio no ofrece ninguna hora. Vuelva a guardar cuanto antes.",
          };
        }
      }
      return {
        success: false,
        error: "No se pudieron guardar los horarios. El horario anterior sigue vigente.",
      };
    }
  }

  revalidatePath("/dashboard/disponibilidad");
  revalidatePath("/reserva");
  return { success: true };
}

/* ── Fechas bloqueadas (migración 026) ──────────────────────────
   Se bloquean de a una o por rango, pero NUNCA con un guardado masivo que
   reemplace la tabla: acá todo es aditivo. Esa era la razón original de
   editarlas de a una —un guardado en bloque haría que un error de tipeo
   borrara vacaciones ya cargadas— y sigue en pie. Bloquear un rango agrega
   fechas; para quitar una hay que liberarla, que es una acción aparte. */

const FECHA = /^\d{4}-\d{2}-\d{2}$/;

/* Tope del rango. Un trimestre cubre de sobra unas vacaciones, y ataja el
   error de tipeo que importa: equivocarse en el año ("2027" en vez de 2026")
   generaría cientos de filas de una sola vez. */
const MAX_DIAS_RANGO = 92;

/** Las fechas YYYY-MM-DD de un rango, inclusive en ambos extremos.
    Se camina en UTC a propósito: sumar días sobre una fecha local se rompe
    en el cambio de hora, y en Chile eso pasa dos veces al año. */
function fechasDelRango(desde: string, hasta: string): string[] {
  const [a1, m1, d1] = desde.split("-").map(Number);
  const [a2, m2, d2] = hasta.split("-").map(Number);
  const fin = Date.UTC(a2, m2 - 1, d2);
  const fechas: string[] = [];
  for (let t = Date.UTC(a1, m1 - 1, d1); t <= fin; t += 86_400_000) {
    const d = new Date(t);
    const mes = String(d.getUTCMonth() + 1).padStart(2, "0");
    const dia = String(d.getUTCDate()).padStart(2, "0");
    fechas.push(`${d.getUTCFullYear()}-${mes}-${dia}`);
  }
  return fechas;
}

/** Bloquea una fecha, o actualiza el texto si ya estaba bloqueada. */
export async function bloquearFechaAction(
  excepcion: ExcepcionEditable
): Promise<ResultadoAccion> {
  const sesion = await exigirAdmin();
  if ("error" in sesion) return { success: false, error: sesion.error };

  if (!FECHA.test(excepcion.fecha)) {
    return { success: false, error: "Fecha inválida." };
  }

  const mensaje = excepcion.mensaje.trim();
  if (mensaje.length > 200) {
    return { success: false, error: "El mensaje no puede pasar de 200 caracteres." };
  }
  const nota = excepcion.notaInterna.trim();
  if (nota.length > 200) {
    return { success: false, error: "La nota no puede pasar de 200 caracteres." };
  }

  const { error } = await sesion.supabase.from("disponibilidad_excepciones").upsert(
    {
      fecha: excepcion.fecha,
      // Vacío se guarda como NULL, no como "": así la función de la base
      // cae en el texto general en vez de mostrarle una cadena vacía al
      // cliente.
      mensaje: mensaje || null,
      nota_interna: nota || null,
    },
    { onConflict: "fecha" }
  );

  if (error) {
    return {
      success: false,
      error:
        error.code === "42P01"
          ? "Falta aplicar la migración 026 en la base de datos."
          : error.code === "42501"
            ? "La base de datos rechazó el cambio (permisos)."
            : "No se pudo bloquear la fecha.",
    };
  }

  revalidatePath("/dashboard/disponibilidad");
  revalidatePath("/reserva");
  return { success: true };
}

/** Lo que devuelve el bloqueo por rango: cuántos días quedaron tomados y
    cuántos se saltaron por ser días sin atención. */
export interface ResultadoRango extends ResultadoAccion {
  bloqueadas?: number;
  omitidas?: number;
}

/**
 * Bloquea todas las fechas de un rango de una sola vez, con el mismo mensaje
 * y la misma nota.
 *
 * Es ADITIVO: hace upsert de las fechas del rango y no toca ninguna otra. Un
 * día que ya estaba bloqueado se actualiza con el texto nuevo; los que
 * quedaron fuera del rango siguen igual. Nada de esto borra vacaciones ya
 * cargadas, que era el riesgo por el que esta sección se editaba de a un día.
 */
export async function bloquearRangoAction(rango: {
  desde: string;
  hasta: string;
  mensaje: string;
  notaInterna: string;
  /** Días de la semana (0=domingo … 6=sábado) en que el local atiende. Los
      demás se omiten: bloquear un día que ya no tiene horario no cambia nada
      para el cliente y llena la lista de fechas inútiles. */
  diasAtendidos: number[];
}): Promise<ResultadoRango> {
  const sesion = await exigirAdmin();
  if ("error" in sesion) return { success: false, error: sesion.error };

  if (!FECHA.test(rango.desde) || !FECHA.test(rango.hasta)) {
    return { success: false, error: "Fecha inválida." };
  }
  if (rango.hasta < rango.desde) {
    return { success: false, error: "La fecha de término va antes que la de inicio." };
  }

  const mensaje = rango.mensaje.trim();
  if (mensaje.length > 200) {
    return { success: false, error: "El mensaje no puede pasar de 200 caracteres." };
  }
  const nota = rango.notaInterna.trim();
  if (nota.length > 200) {
    return { success: false, error: "La nota no puede pasar de 200 caracteres." };
  }

  const todas = fechasDelRango(rango.desde, rango.hasta);
  if (todas.length > MAX_DIAS_RANGO) {
    return {
      success: false,
      error: `El rango tiene ${todas.length} días y el máximo es ${MAX_DIAS_RANGO}. Revise las fechas — si de verdad son tantos, hágalo en dos tandas.`,
    };
  }

  /* Se filtra por día de la semana con la lista que manda la pantalla, que
     sale de los tramos vigentes. Si llegara vacía se bloquea todo el rango:
     omitir días por una lista que no se pudo leer sería peor que dejar
     alguna fecha de más. */
  const atendidos = new Set(rango.diasAtendidos);
  const aBloquear =
    atendidos.size === 0
      ? todas
      : todas.filter((f) => atendidos.has(diaSemanaDe(f)));

  if (aBloquear.length === 0) {
    return {
      success: false,
      error: "En ese rango no hay ningún día de atención, así que no hay nada que bloquear.",
    };
  }

  const { error } = await sesion.supabase.from("disponibilidad_excepciones").upsert(
    aBloquear.map((fecha) => ({
      fecha,
      // Vacío se guarda como NULL para que la función de la base caiga en el
      // texto general, igual que en el bloqueo de a una.
      mensaje: mensaje || null,
      nota_interna: nota || null,
    })),
    { onConflict: "fecha" }
  );

  if (error) {
    return {
      success: false,
      error:
        error.code === "42P01"
          ? "Falta aplicar la migración 026 en la base de datos."
          : error.code === "42501"
            ? "La base de datos rechazó el cambio (permisos)."
            : "No se pudieron bloquear las fechas.",
    };
  }

  revalidatePath("/dashboard/disponibilidad");
  revalidatePath("/reserva");
  return {
    success: true,
    bloqueadas: aBloquear.length,
    omitidas: todas.length - aBloquear.length,
  };
}

/** Vuelve a abrir una fecha. */
export async function liberarFechaAction(fecha: string): Promise<ResultadoAccion> {
  const sesion = await exigirAdmin();
  if ("error" in sesion) return { success: false, error: sesion.error };

  if (!FECHA.test(fecha)) return { success: false, error: "Fecha inválida." };

  const { error } = await sesion.supabase
    .from("disponibilidad_excepciones")
    .delete()
    .eq("fecha", fecha);

  if (error) return { success: false, error: "No se pudo liberar la fecha." };

  revalidatePath("/dashboard/disponibilidad");
  revalidatePath("/reserva");
  return { success: true };
}
