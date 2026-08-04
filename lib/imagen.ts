"use client";

/* Compresión de imágenes en el navegador (PRP-002 Fase 1).

   Una foto de celular pesa 3–5 MB. Subirla tal cual llena el almacenamiento
   en semanas y hace lenta cualquier pantalla que la muestre. Comprimida a
   1600 px en WebP baja a ~150 KB: la misma foto, 25 veces más liviana.

   Se comprime ACÁ, en el navegador, no en el servidor: así el archivo
   pesado nunca viaja por la red, que además es el tramo lento cuando el
   cliente está en el celular con datos móviles.

   Un solo módulo para todo el sitio (fotos de citas y anuncios): si cada
   uno tuviera su propio compresor, terminarían con calidades distintas y
   arreglar un defecto exigiría acordarse de los dos. */

export interface OpcionesCompresion {
  /** Lado mayor de la imagen resultante, en píxeles. */
  maxLado?: number;
  /** 0–1. Más alto = mejor calidad y más peso. */
  calidad?: number;
}

export interface ImagenComprimida {
  blob: Blob;
  /** "webp" o "jpg" — el que haya aceptado el navegador. */
  extension: string;
  tipo: string;
  ancho: number;
  alto: number;
}

/* 1600 px conserva el detalle que una evidencia necesita: si el reclamo es
   "le cortaron mal una oreja", una imagen chica y muy comprimida no prueba
   nada. Los anuncios de la landing usan menos porque se ven a menor tamaño. */
export const PRESET_EVIDENCIA: Required<OpcionesCompresion> = { maxLado: 1600, calidad: 0.82 };
export const PRESET_BANNER: Required<OpcionesCompresion> = { maxLado: 900, calidad: 0.85 };

/** Si la imagen no se puede comprimir (formato que el navegador no decodifica,
    como HEIC en algunos equipos), se sube el original solo si es razonable.
    Más que esto se rechaza: subir 5 MB sin comprimir es exactamente lo que
    esta función existe para evitar. */
const MAX_ORIGINAL_SIN_COMPRIMIR = 1.5 * 1024 * 1024;

/** Decodifica el archivo aplicando la orientación EXIF.

    Sin esto, las fotos de celular salen de costado: la cámara guarda la
    imagen en horizontal y anota "va rotada 90°" en los metadatos; al
    dibujarla en un canvas ese dato se pierde. `createImageBitmap` con
    `imageOrientation: "from-image"` la rota antes de entregarla. */
async function decodificar(file: File): Promise<ImageBitmap | HTMLImageElement> {
  if (typeof createImageBitmap === "function") {
    try {
      return await createImageBitmap(file, { imageOrientation: "from-image" });
    } catch {
      // Safari viejo no acepta la opción: se reintenta sin ella y, si acaso,
      // se cae al <img> de abajo.
      try {
        return await createImageBitmap(file);
      } catch {
        /* sigue al fallback */
      }
    }
  }

  return new Promise<HTMLImageElement>((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new window.Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("No se pudo leer la imagen"));
    };
    img.src = url;
  });
}

function dimensiones(fuente: ImageBitmap | HTMLImageElement): { ancho: number; alto: number } {
  return fuente instanceof HTMLImageElement
    ? { ancho: fuente.naturalWidth, alto: fuente.naturalHeight }
    : { ancho: fuente.width, alto: fuente.height };
}

function aBlob(canvas: HTMLCanvasElement, tipo: string, calidad: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, tipo, calidad));
}

/** Comprime una imagen. Devuelve `null` si el navegador no pudo decodificarla
    y el original es demasiado pesado para subirlo tal cual — quien llama
    decide qué mensaje mostrar. */
export async function comprimirImagen(
  file: File,
  opciones: OpcionesCompresion = {}
): Promise<ImagenComprimida | null> {
  const maxLado = opciones.maxLado ?? PRESET_EVIDENCIA.maxLado;
  const calidad = opciones.calidad ?? PRESET_EVIDENCIA.calidad;

  let fuente: ImageBitmap | HTMLImageElement;
  try {
    fuente = await decodificar(file);
  } catch {
    return file.size <= MAX_ORIGINAL_SIN_COMPRIMIR
      ? {
          blob: file,
          extension: file.name.split(".").pop()?.toLowerCase() || "jpg",
          tipo: file.type || "image/jpeg",
          ancho: 0,
          alto: 0,
        }
      : null;
  }

  const { ancho, alto } = dimensiones(fuente);
  // Nunca agrandar: una foto de 800 px se sube tal cual, escalarla a 1600
  // solo agrega peso sin agregar detalle.
  const escala = Math.min(1, maxLado / Math.max(ancho, alto));

  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(ancho * escala));
  canvas.height = Math.max(1, Math.round(alto * escala));

  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.drawImage(fuente, 0, 0, canvas.width, canvas.height);
  if ("close" in fuente) fuente.close(); // libera memoria del bitmap

  // WebP pesa ~30% menos que JPEG con la misma calidad visible. Safari lo
  // soporta desde iOS 14; si el navegador lo rechaza, `toBlob` devuelve un
  // PNG enorme o null, así que se comprueba el tipo antes de aceptarlo.
  const webp = await aBlob(canvas, "image/webp", calidad);
  if (webp && webp.type === "image/webp") {
    return { blob: webp, extension: "webp", tipo: "image/webp", ancho: canvas.width, alto: canvas.height };
  }

  const jpeg = await aBlob(canvas, "image/jpeg", calidad);
  if (jpeg) {
    return { blob: jpeg, extension: "jpg", tipo: "image/jpeg", ancho: canvas.width, alto: canvas.height };
  }

  return null;
}
