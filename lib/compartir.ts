/* Compartir la foto con la hoja del sistema (PRP-002 F6, vía B).

   El enlace `wa.me?text=` solo lleva texto: la imagen no viaja. La única
   forma de que la foto llegue de verdad al chat desde una web es
   `navigator.share` con archivos — la hoja para compartir del teléfono, esa
   donde el cliente elige WhatsApp. Eso sí entrega la imagen como imagen.

   No sustituye al enlace del mensaje: es un segundo toque, opcional, y solo
   existe en móvil. Si el navegador no lo soporta, el botón no aparece y no
   se rompe nada — el enlace a la ficha ya cubre el caso. */

export interface ResultadoCompartir {
  ok: boolean;
  /** Solo cuando falla por algo que el cliente deba saber. */
  error?: string;
}

/** ¿Este navegador puede compartir estos archivos?

    Se pregunta por los archivos concretos y no solo por `navigator.share`:
    hay navegadores que comparten texto pero rechazan imágenes, y ofrecer un
    botón que después falla es peor que no ofrecerlo. */
export function puedeCompartirFotos(archivos: File[]): boolean {
  if (typeof navigator === "undefined") return false;
  if (archivos.length === 0) return false;
  const nav = navigator as Navigator & {
    canShare?: (datos: { files?: File[] }) => boolean;
  };
  if (typeof nav.share !== "function" || typeof nav.canShare !== "function") return false;
  try {
    return nav.canShare({ files: archivos });
  } catch {
    return false;
  }
}

/** Abre la hoja de compartir con las fotos.

    Tiene que llamarse DENTRO del gesto del usuario (el click), no dentro de
    un `then` lejano: los navegadores lo exigen y si no, lo rechazan sin
    explicación. */
export async function compartirFotos(
  archivos: File[],
  texto: string
): Promise<ResultadoCompartir> {
  if (!puedeCompartirFotos(archivos)) {
    return { ok: false, error: "Este navegador no permite compartir imágenes." };
  }

  try {
    await navigator.share({ files: archivos, text: texto });
    return { ok: true };
  } catch (e) {
    /* Cancelar la hoja de compartir lanza AbortError. No es un error: es el
       cliente diciendo "mejor no". Mostrarle un mensaje rojo por arrepentirse
       sería tratarlo como si se hubiera equivocado. */
    if (e instanceof DOMException && e.name === "AbortError") {
      return { ok: false };
    }
    return { ok: false, error: "No se pudo compartir la foto." };
  }
}
