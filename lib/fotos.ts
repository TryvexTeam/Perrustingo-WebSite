"use client";

import type { SupabaseClient } from "@supabase/supabase-js";
import { comprimirImagen, PRESET_EVIDENCIA } from "./imagen";
import { BUCKET_FOTOS, SEGUNDOS_FIRMA, rutaDeFoto, type OrigenFoto } from "./fotosComun";

/* Se re-exportan para que los componentes del navegador sigan importando
   todo lo de fotos desde un solo sitio. La definición vive en fotosComun
   porque el servidor también la necesita — ver el comentario de ese archivo. */
export { BUCKET_FOTOS, SEGUNDOS_FIRMA, rutaDeFoto };
export type { OrigenFoto };

/* Fotos de la reserva (pedido de Rodolfo 19-jul): foto actual del perrito
   + imagen de referencia del corte. Suben al bucket 'reservas' bajo la
   carpeta del usuario (la policy de storage exige uid como primer folder).

   Desde PRP-002 F1 se comprimen antes de subir: una foto de celular pesa
   3–5 MB y así baja a ~150 KB. Sin esto el almacenamiento se llena en
   semanas y cada pantalla que muestre la foto se vuelve lenta.

   Desde PRP-002 F4 el bucket es PRIVADO. Estas funciones ya no devuelven una
   URL: devuelven la RUTA del objeto. La diferencia importa — una URL pública
   deja de existir cuando el bucket se cierra, la ruta sobrevive a cualquier
   cambio de política y es lo único que hace falta para firmar un enlace
   temporal cuando alguien con permiso quiere ver la foto. */

const MAX_BYTES = 8 * 1024 * 1024;
const TIPOS_OK = ["image/jpeg", "image/png", "image/webp", "image/heic"];

export type TagFoto = "actual" | "referencia";

export function fotoValida(file: File): string | null {
  if (!TIPOS_OK.includes(file.type)) return "Usa una imagen (JPG, PNG o WebP).";
  if (file.size > MAX_BYTES) return "La imagen no puede superar los 8 MB.";
  return null;
}

/** Sube una foto y devuelve su RUTA dentro del bucket, o null si falla.
    Falla suave: una foto caída nunca debe botar la reserva completa. */
export async function subirFotoReserva(
  supabase: SupabaseClient,
  /* `null` cuando el cliente reserva sin cuenta, que es el camino normal
     desde PRP-003. Antes esta función exigía un uid y, sin él, la foto
     simplemente no se subía: la reserva se creaba, el panel quedaba vacío y
     nadie se enteraba. La foto del "antes" no llegaba casi nunca. */
  uid: string | null,
  file: File,
  perroIndex: number,
  tag: TagFoto
): Promise<string | null> {
  try {
    const comprimida = await comprimirImagen(file, PRESET_EVIDENCIA);
    // `null` = el navegador no pudo decodificarla y el original pesa
    // demasiado. Subirlo igual sería justo lo que la compresión evita.
    if (!comprimida) return null;

    /* Sin sesión va a `anon/`, la carpeta que habilita la migración 023.
       El nombre lleva un identificador aleatorio para que dos personas
       reservando a la vez no choquen — sin uid, el timestamp solo no
       alcanza. */
    const carpeta = uid ?? "anon";
    const sufijo = uid ? "" : `-${crypto.randomUUID().slice(0, 8)}`;
    const ruta = `${carpeta}/${Date.now()}${sufijo}-perro${perroIndex + 1}-${tag}.${comprimida.extension}`;
    const { error } = await supabase.storage.from(BUCKET_FOTOS).upload(ruta, comprimida.blob, {
      cacheControl: "3600",
      contentType: comprimida.tipo,
      upsert: false,
    });
    if (error) return null;
    return ruta;
  } catch {
    return null;
  }
}

/* ── Foto del resultado, subida por el equipo (PRP-002 F3) ──────────── */

export interface ResultadoSubida {
  ruta: string | null;
  error?: string;
}

/** Sube la foto del "después" de una cita. La sube quien está atendiendo,
    desde su propio celular, con las manos recién secadas: si algo falla
    tiene que decir QUÉ falló, no devolver null como la del cliente.

    La ruta sigue empezando por el uid de quien sube — es lo que exige la
    policy de storage (migración 004). Cambiarla a `<sesion_id>/` obligaría a
    reescribir esa policy y a arriesgar que el cliente deje de poder subir. */
export async function subirFotoResultado(
  supabase: SupabaseClient,
  uid: string,
  citaId: string,
  file: File
): Promise<ResultadoSubida> {
  const problema = fotoValida(file);
  if (problema) return { ruta: null, error: problema };

  try {
    const comprimida = await comprimirImagen(file, PRESET_EVIDENCIA);
    if (!comprimida) {
      return { ruta: null, error: "No se pudo procesar la imagen. Intente con otra." };
    }

    const ruta = `${uid}/${Date.now()}-cita${citaId.slice(0, 8)}-despues.${comprimida.extension}`;
    const { error } = await supabase.storage.from(BUCKET_FOTOS).upload(ruta, comprimida.blob, {
      cacheControl: "3600",
      contentType: comprimida.tipo,
      upsert: false,
    });
    if (error) return { ruta: null, error: "No se pudo subir la foto. Revise la conexión." };

    return { ruta };
  } catch {
    return { ruta: null, error: "No se pudo subir la foto." };
  }
}

/* ── Mostrar una foto de un bucket privado ──────────────────────────── */

/** Firma varias fotos de una vez y devuelve ruta → enlace temporal.

    En lote y no una por una: una ficha con seis fotos haría seis viajes de
    red, y el panel se abre con el perrito esperando en la mesa. Las que
    fallen simplemente no aparecen en el mapa — el llamador decide qué
    mostrar en su lugar, que es mejor que romper toda la galería por una. */
export async function firmarFotos(
  supabase: SupabaseClient,
  rutas: string[]
): Promise<Record<string, string>> {
  const limpias = rutas.filter(Boolean);
  if (limpias.length === 0) return {};

  const { data, error } = await supabase.storage
    .from(BUCKET_FOTOS)
    .createSignedUrls(limpias, SEGUNDOS_FIRMA);

  if (error || !data) return {};

  const mapa: Record<string, string> = {};
  for (const item of data) {
    if (item.signedUrl && item.path) mapa[item.path] = item.signedUrl;
  }
  return mapa;
}
