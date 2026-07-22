import type { SupabaseClient } from "@supabase/supabase-js";

/* Fotos de la reserva (pedido de Rodolfo 19-jul): foto actual del perrito
   + imagen de referencia del corte. Suben al bucket 'reservas' bajo la
   carpeta del usuario (la policy de storage exige uid como primer folder). */

const MAX_BYTES = 8 * 1024 * 1024;
const TIPOS_OK = ["image/jpeg", "image/png", "image/webp", "image/heic"];

export type TagFoto = "actual" | "referencia";

export function fotoValida(file: File): string | null {
  if (!TIPOS_OK.includes(file.type)) return "Usa una imagen (JPG, PNG o WebP).";
  if (file.size > MAX_BYTES) return "La imagen no puede superar los 8 MB.";
  return null;
}

/** Sube una foto y devuelve su URL pública, o null si falla.
    Falla suave: una foto caída nunca debe botar la reserva completa. */
export async function subirFotoReserva(
  supabase: SupabaseClient,
  uid: string,
  file: File,
  perroIndex: number,
  tag: TagFoto
): Promise<string | null> {
  try {
    const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
    const ruta = `${uid}/${Date.now()}-perro${perroIndex + 1}-${tag}.${ext}`;
    const { error } = await supabase.storage.from("reservas").upload(ruta, file, {
      cacheControl: "3600",
      upsert: false,
    });
    if (error) return null;
    const { data } = supabase.storage.from("reservas").getPublicUrl(ruta);
    return data.publicUrl;
  } catch {
    return null;
  }
}
