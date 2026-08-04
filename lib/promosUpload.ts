"use client";

import { createClient } from "@/lib/supabase/client";
import { comprimirImagen, PRESET_BANNER } from "@/lib/imagen";

/* Subida de la imagen de un anuncio al bucket `promos` (público, con
   policies de escritura solo para el equipo — migración 003).

   Vive separado de lib/promos.ts porque eso es dominio compartido con el
   servidor y esto usa `document`/`canvas`: mezclarlos obligaría a marcar
   todo el módulo como cliente y los server actions no podrían importarlo
   (ya nos pasó en la Fase 2 con `admiteMontoFijo`).

   La compresión vive en lib/imagen.ts, compartida con las fotos de las
   citas: tener dos compresores terminaría en calidades distintas y en
   arreglar cada defecto dos veces. */

const MAX_BYTES = 8 * 1024 * 1024;

/** Sube la imagen y devuelve su URL pública. Lanza con un mensaje legible:
    un fallo mudo acá deja al admin sin saber si el anuncio quedó o no. */
export async function subirImagenPromo(promoId: string, file: File): Promise<string> {
  if (!file.type.startsWith("image/")) throw new Error("El archivo debe ser una imagen.");
  if (file.size > MAX_BYTES) throw new Error("Máximo 8 MB.");

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url || url.includes("TU_PROYECTO")) {
    // Antes esto caía a un dataURL guardado en localStorage. Ya no: sería
    // volver justo al problema que la Fase 3 vino a resolver (una imagen
    // que solo existe en un navegador), pero disfrazado de que funcionó.
    throw new Error("Sin base de datos conectada no se pueden subir imágenes.");
  }

  const comprimida = await comprimirImagen(file, PRESET_BANNER);
  if (!comprimida) throw new Error("No se pudo procesar la imagen. Pruebe con otra.");

  const supabase = createClient();
  const ruta = `${promoId}-${Date.now()}.${comprimida.extension}`;
  const { error } = await supabase.storage.from("promos").upload(ruta, comprimida.blob, {
    cacheControl: "3600",
    contentType: comprimida.tipo,
    upsert: false,
  });
  if (error) throw new Error("No se pudo subir la imagen. Revise su sesión de admin.");

  const { data } = supabase.storage.from("promos").getPublicUrl(ruta);
  return data.publicUrl;
}
