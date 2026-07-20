import type { SupabaseClient } from "@supabase/supabase-js";
import type { EstadoCita } from "./citas";

/* Acciones de equipo sobre `sesiones` — requieren admin/trabajador (RLS
   `equipo_ve_todas_sesiones`). `confirmada_at`/`confirmada_por` los llena
   el trigger `trg_registra_confirmacion` (migración 005), no hace falta
   mandarlos acá. */

export interface ConfirmacionResultado {
  id: string;
  estado: EstadoCita;
  confirmada_at: string | null;
  confirmada_por: string | null;
}

/**
 * Pasa una cita de 'pendiente' (o 'en_proceso') a 'confirmada'. La UI del
 * panel admin llama esto cuando el equipo confirmó con el cliente por
 * mensaje/llamada — recién ahí la cita bloquea el calendario en firme.
 */
export async function confirmarCita(
  supabase: SupabaseClient,
  sesionId: string
): Promise<ConfirmacionResultado | null> {
  const { data, error } = await supabase
    .from("sesiones")
    .update({ estado: "confirmada" satisfies EstadoCita })
    .eq("id", sesionId)
    .select("id, estado, confirmada_at, confirmada_por")
    .single();

  if (error || !data) return null;
  return data as ConfirmacionResultado;
}
