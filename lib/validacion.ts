/* Utilidades de validación/sanitización de input compartidas por los
   formularios públicos (reserva, registro). Capa de UX + primera línea de
   defensa — la autoridad real es SIEMPRE la validación server-side (zod
   en app/api/reservas/route.ts, lib/citas.ts), nunca confiar solo en esto:
   cualquiera puede saltarse el navegador con curl/devtools. */

/** Letras (con acentos/ñ), espacios, apóstrofes, puntos y guiones — nombres
    propios, razas "Otro", descripciones cortas. Nada de dígitos ni símbolos
    de código (rechaza intentos de inyección tan bien como de typos). */
export const PATRON_SOLO_LETRAS = "^[A-Za-zÀ-ÿ\\s'.-]+$";
const REGEX_SOLO_LETRAS = new RegExp(PATRON_SOLO_LETRAS);

/** Mismo patrón que ya usa RegistroForm/lib/citas.ts para teléfono. */
export const PATRON_TELEFONO = "^\\+?[\\d\\s]{8,15}$";

export function esSoloLetras(valor: string): boolean {
  return valor.trim().length > 0 && REGEX_SOLO_LETRAS.test(valor.trim());
}

/** Título — "juan pérez" → "Juan Pérez". Preserva conectores comunes en
    minúscula ("de", "la", "del") salvo que sean la primera palabra. */
const CONECTORES = new Set(["de", "del", "la", "las", "los", "y"]);

export function capitalizarNombre(valor: string): string {
  return valor
    .trim()
    .replace(/\s+/g, " ")
    .split(" ")
    .map((palabra, i) => {
      if (!palabra) return palabra;
      const minuscula = palabra.toLocaleLowerCase("es");
      if (i > 0 && CONECTORES.has(minuscula)) return minuscula;
      return minuscula.charAt(0).toLocaleUpperCase("es") + minuscula.slice(1);
    })
    .join(" ");
}
