"use client";

import type { SupabaseClient } from "@supabase/supabase-js";
import { comprimirImagen, PRESET_EVIDENCIA } from "./imagen";

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

export const BUCKET_FOTOS = "reservas";

/* Cuánto vive un enlace firmado. Diez minutos alcanzan de sobra para abrir
   la foto y mirarla; si el enlace se reenvía por ahí, caduca antes de llegar
   a ninguna parte. */
export const SEGUNDOS_FIRMA = 600;

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

/** Fila de `fotos_sesion` en lo que respecta a dónde está la imagen. */
export interface OrigenFoto {
  ruta: string | null;
  url: string | null;
}

/* Marca de una URL pública del bucket, para poder recuperar la ruta de las
   filas escritas antes de que el bucket se cerrara. */
const MARCA_PUBLICA = `/storage/v1/object/public/${BUCKET_FOTOS}/`;

/** La ruta de la foto, venga como venga la fila.

    Existe por una ventana concreta: entre que la base se cierra y que el
    sitio nuevo se despliega, producción sigue corriendo el código viejo y
    puede escribir filas con `url` pública. Esas fotos existen y son válidas
    — solo que su enlace ya no sirve. Extraer la ruta de la URL las rescata
    en vez de mostrarlas rotas. */
export function rutaDeFoto(foto: OrigenFoto): string | null {
  if (foto.ruta) return foto.ruta;
  if (!foto.url) return null;
  const i = foto.url.indexOf(MARCA_PUBLICA);
  if (i === -1) return null;
  // decodeURIComponent: Storage escapa los caracteres raros en la URL, pero
  // la API de firma espera la ruta tal cual está guardada.
  try {
    return decodeURIComponent(foto.url.slice(i + MARCA_PUBLICA.length));
  } catch {
    return foto.url.slice(i + MARCA_PUBLICA.length);
  }
}

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
