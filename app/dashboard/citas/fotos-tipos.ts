/* Constantes de los tipos de foto.

   Viven acá y no en fotos-actions.ts porque ese archivo es "use server": un
   archivo de server actions sólo puede exportar funciones async. Exportar un
   array desde ahí compila sin quejarse y revienta en runtime con
   'A "use server" file can only export async functions, found object',
   tumbando toda la página que lo importe. */

/* Los tipos que acepta el CHECK de la tabla (migración 035). Inventar un valor
   nuevo acá reventaría en producción con un error críptico, así que la lista
   vive en un solo lugar y se valida antes de escribir. */
export const TIPOS_FOTO = [
  "antes",
  "durante",
  "despues",
  "referencia",
  "extra",
  "comprobante",
] as const;

export type TipoFoto = (typeof TIPOS_FOTO)[number];

/* El comprobante NO es una foto del perrito: lleva datos de pago. Se separa
   para que la galería del cliente no lo muestre nunca por descuido. */
export const TIPOS_VISIBLES_CLIENTE: readonly TipoFoto[] = [
  "antes",
  "durante",
  "despues",
  "referencia",
  "extra",
];
