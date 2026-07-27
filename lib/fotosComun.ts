/* Lo que saben del almacenamiento de fotos TANTO el navegador como el
   servidor.

   Existe por un error concreto y repetido: `lib/fotos.ts` lleva "use client",
   y al importar una constante suya desde una server action el valor llega
   vacío. La primera vez pasó en PRP-003 F2 (`admiteMontoFijo`) y se arregló
   moviéndola a un módulo isomorfo; la segunda fue acá, con `BUCKET_FOTOS`, y
   se manifestó como un "Bucket name invalid" en la limpieza — un error que
   ni tsc ni el build detectan, porque el módulo compila perfecto.

   Regla que sale de eso: si un valor lo van a usar los dos lados, no vive en
   un archivo con directiva. */

export const BUCKET_FOTOS = "reservas";

/* Cuánto vive un enlace firmado. Diez minutos alcanzan de sobra para abrir
   la foto y mirarla; si el enlace se reenvía por ahí, caduca antes de llegar
   a ninguna parte. */
export const SEGUNDOS_FIRMA = 600;

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
