"use client";

import type { SupabaseClient } from "@supabase/supabase-js";
import { comprimirImagen, PRESET_EVIDENCIA } from "./imagen";

/* Fotos de la reserva (pedido de Rodolfo 19-jul): foto actual del perrito
   + imagen de referencia del corte. Suben al bucket 'reservas' bajo la
   carpeta del usuario (la policy de storage exige uid como primer folder).

   Desde PRP-002 F1 se comprimen antes de subir: una foto de celular pesa
   3–5 MB y así baja a ~150 KB. Sin esto el almacenamiento se llena en
   semanas y cada pantalla que muestre la foto se vuelve lenta. */

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
    const comprimida = await comprimirImagen(file, PRESET_EVIDENCIA);
    // `null` = el navegador no pudo decodificarla y el original pesa
    // demasiado. Subirlo igual sería justo lo que la compresión evita.
    if (!comprimida) return null;

    const ruta = `${uid}/${Date.now()}-perro${perroIndex + 1}-${tag}.${comprimida.extension}`;
    const { error } = await supabase.storage.from("reservas").upload(ruta, comprimida.blob, {
      cacheControl: "3600",
      contentType: comprimida.tipo,
      upsert: false,
    });
    if (error) return null;
    const { data } = supabase.storage.from("reservas").getPublicUrl(ruta);
    return data.publicUrl;
  } catch {
    return null;
  }
}
