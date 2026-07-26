"use client";

import { createClient } from "@/lib/supabase/client";

/* Subida de la imagen de un anuncio al bucket `promos` (público, con
   policies de escritura solo para el equipo — migración 003).

   Vive separado de lib/promos.ts porque eso es dominio compartido con el
   servidor y esto usa `document`/`canvas`: mezclarlos obligaría a marcar
   todo el módulo como cliente y los server actions no podrían importarlo
   (ya nos pasó en la Fase 2 con `admiteMontoFijo`). */

const MAX_LADO_PX = 900;
const CALIDAD_JPEG = 0.85;
const MAX_BYTES = 8 * 1024 * 1024;

/** Reduce la imagen antes de subirla: un arte de 4 MB no aporta nada sobre
    un banner que se ve a 900 px, y sí encarece la carga de la landing. */
function comprimir(file: File): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new window.Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      const escala = Math.min(1, MAX_LADO_PX / Math.max(img.width, img.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(img.width * escala);
      canvas.height = Math.round(img.height * escala);
      const ctx = canvas.getContext("2d");
      if (!ctx) return reject(new Error("Canvas no disponible"));
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error("No se pudo procesar la imagen"))),
        "image/jpeg",
        CALIDAD_JPEG
      );
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("No se pudo leer la imagen"));
    };
    img.src = url;
  });
}

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

  const comprimida = await comprimir(file);
  const supabase = createClient();
  const ruta = `${promoId}-${Date.now()}.jpg`;
  const { error } = await supabase.storage.from("promos").upload(ruta, comprimida, {
    cacheControl: "3600",
    contentType: "image/jpeg",
    upsert: false,
  });
  if (error) throw new Error("No se pudo subir la imagen. Revise su sesión de admin.");

  const { data } = supabase.storage.from("promos").getPublicUrl(ruta);
  return data.publicUrl;
}
