import { PROMOS_DEFAULT, type Promo } from "./promos";

/* Lectura de los anuncios en el servidor, para que salgan en el HTML de la
   landing (antes se leían en el cliente desde localStorage y aparecían
   después de la hidratación).

   Se usa `fetch` a PostgREST en vez del cliente de Supabase a propósito: el
   cliente de servidor lee cookies, y eso volvería dinámica toda la home.
   Con fetch + `next.tags` la página sigue siendo estática y el panel la
   refresca al instante con `revalidateTag` al guardar. */

export const TAG_PROMOS = "promos";

/** Ventana máxima de desfase si algo impidiera la revalidación puntual.
    No es el camino normal — el normal es el tag al guardar. */
const REVALIDAR_SEGUNDOS = 300;

export async function obtenerPromosServer(): Promise<Promo[]> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key || url.includes("TU_PROYECTO")) return PROMOS_DEFAULT;

  try {
    const respuesta = await fetch(
      `${url}/rest/v1/promos?select=id,nombre,img,alt,vertical,slot,orden&order=orden`,
      {
        headers: { apikey: key, Authorization: `Bearer ${key}` },
        next: { tags: [TAG_PROMOS], revalidate: REVALIDAR_SEGUNDOS },
      }
    );
    if (!respuesta.ok) return PROMOS_DEFAULT;

    const filas = (await respuesta.json()) as Promo[];
    // Tabla vacía = alguien borró todos los anuncios a propósito; eso es una
    // landing sin banners, no un error que haya que "arreglar" resucitando
    // los de fábrica. El fallback es solo para cuando NO se pudo leer.
    return Array.isArray(filas) ? filas : PROMOS_DEFAULT;
  } catch {
    return PROMOS_DEFAULT;
  }
}
