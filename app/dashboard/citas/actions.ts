"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { EstadoCita } from "@/lib/citas";

const TRANSICIONES_EQUIPO: Record<string, EstadoCita[]> = {
  pendiente: ["confirmada", "cancelada"],
  confirmada: ["en_proceso", "cancelada"],
  en_proceso: ["completada", "cancelada"],
};

interface ResultadoAccion {
  success: boolean;
  error?: string;
}

interface OpcionesHorario {
  /** yyyy-mm-ddThh:mm:ss local — al confirmar, fija la hora real de la cita. */
  fechaCita?: string;
  duracionHoras?: number;
}

/** Cambia el estado de una cita. Solo equipo (admin/trabajador); RLS refuerza. */
export async function cambiarEstadoCita(
  citaId: string,
  nuevoEstado: EstadoCita,
  horario?: OpcionesHorario
): Promise<ResultadoAccion> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Sesión expirada." };

  const { data: perfil } = await supabase
    .from("perfiles")
    .select("rol")
    .eq("id", user.id)
    .single();
  if (!perfil || !["admin", "trabajador"].includes(perfil.rol)) {
    return { success: false, error: "Sin permisos." };
  }

  const { data: cita } = await supabase
    .from("sesiones")
    .select("estado")
    .eq("id", citaId)
    .single();
  if (!cita) return { success: false, error: "Cita no encontrada." };

  const permitidas = TRANSICIONES_EQUIPO[cita.estado] ?? [];
  if (!permitidas.includes(nuevoEstado)) {
    return { success: false, error: `No se puede pasar de ${cita.estado} a ${nuevoEstado}.` };
  }

  const cambios: Record<string, unknown> = {
    estado: nuevoEstado,
    updated_at: new Date().toISOString(),
  };
  if (horario?.fechaCita) {
    const inicio = new Date(horario.fechaCita);
    if (isNaN(inicio.getTime())) return { success: false, error: "Horario inválido." };
    cambios.fecha_cita = inicio.toISOString();
    const duracion = horario.duracionHoras ?? 1.5;
    cambios.fecha_fin = new Date(inicio.getTime() + duracion * 3_600_000).toISOString();
  }

  const { error } = await supabase
    .from("sesiones")
    .update(cambios)
    .eq("id", citaId);

  if (error) return { success: false, error: "No se pudo actualizar." };

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/citas");
  revalidatePath("/agenda");
  return { success: true };
}
