"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

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

  // Reemplazo completo de los tramos.
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
    if (errorInsert) return { success: false, error: "No se pudieron guardar los horarios." };
  }

  revalidatePath("/dashboard/disponibilidad");
  revalidatePath("/reserva");
  return { success: true };
}

/* ── Fechas bloqueadas (migración 026) ──────────────────────────
   Se editan de a una y no en bloque como los tramos: bloquear un día es una
   decisión puntual ("el 12 me tomo la tarde"), y un guardado masivo haría
   que un error de tipeo borrara vacaciones ya cargadas. */

const FECHA = /^\d{4}-\d{2}-\d{2}$/;

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
