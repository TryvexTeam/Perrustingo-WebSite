import type { SupabaseClient } from "@supabase/supabase-js";

/* Dominio de notas del peluquero — tabla `notas_perro` (migración 005).
   Historial por PERRO (no por cita): sobrevive entre sesiones para que el
   equipo vea "qué pasó la última vez" al agendar la próxima. Acceso
   restringido a equipo (admin/trabajador) vía RLS — ver `equipo_maneja_notas_perro`. */

export interface NotaPerro {
  id: string;
  perro_id: string;
  sesion_id: string | null;
  autor_id: string | null;
  detalle: string;
  created_at: string;
  /** Presente solo si se pidió el join con perfiles (ver `listarNotasPorPerro`). */
  autor_nombre?: string | null;
}

/** Historial completo de un perro, más reciente primero. */
export async function listarNotasPorPerro(
  supabase: SupabaseClient,
  perroId: string
): Promise<NotaPerro[]> {
  const { data, error } = await supabase
    .from("notas_perro")
    .select("id, perro_id, sesion_id, autor_id, detalle, created_at, autor:perfiles(nombre)")
    .eq("perro_id", perroId)
    .order("created_at", { ascending: false });

  if (error || !data) return [];

  return data.map((fila) => {
    const autor = fila.autor as { nombre: string | null } | { nombre: string | null }[] | null;
    const autorNombre = Array.isArray(autor) ? autor[0]?.nombre : autor?.nombre;
    return {
      id: fila.id,
      perro_id: fila.perro_id,
      sesion_id: fila.sesion_id,
      autor_id: fila.autor_id,
      detalle: fila.detalle,
      created_at: fila.created_at,
      autor_nombre: autorNombre ?? null,
    };
  });
}

/** El peluquero deja una nota al terminar el servicio. `autorId` = auth.uid() del llamador. */
export async function crearNotaPerro(
  supabase: SupabaseClient,
  params: { perroId: string; sesionId?: string | null; autorId: string; detalle: string }
): Promise<NotaPerro | null> {
  const detalle = params.detalle.trim();
  if (!detalle) return null;

  const { data, error } = await supabase
    .from("notas_perro")
    .insert({
      perro_id: params.perroId,
      sesion_id: params.sesionId ?? null,
      autor_id: params.autorId,
      detalle,
    })
    .select("id, perro_id, sesion_id, autor_id, detalle, created_at")
    .single();

  if (error || !data) return null;
  return data as NotaPerro;
}
