/* Tramos de ajuste por altura — dominio puro, sin Supabase ni React.
 *
 * POR QUÉ EXISTE (pedido del 4-ago): el formulario ya preguntaba la altura del
 * perrito y no hacía nada con ella. Dos perros de 10 kg no dan el mismo trabajo
 * si uno es alto y delgado y el otro bajo y compacto.
 *
 * MISMO MODELO QUE `lib/tramos.ts`, a propósito: cada tramo declara solo DESDE
 * qué altura rige y el "hasta" se deriva del siguiente, así un hueco de
 * cobertura no se puede ni escribir. La diferencia está en qué aporta la fila:
 * `tramos.ts` fija el precio base, este ajusta ese precio.
 *
 * NEUTRO DE FÁBRICA: la migración siembra un único tramo desde 0 cm con 0%. La
 * altura queda conectada al precio sin moverlo, y el dueño agrega los cortes
 * que quiera. Inventar nosotros un porcentaje sería cobrarle de más a clientes
 * reales sin que nadie lo haya decidido.
 */

export interface TramoAltura {
  /** Identificador estable. Sobrevive a reordenar o renombrar. */
  readonly id: string;
  /** Cómo se le muestra al cliente: "Bajo", "Alto"… */
  readonly nombre: string;
  /** Desde cuántos centímetros rige, INCLUSIVE. El primero debe ser 0. */
  readonly desdeCm: number;
  /** Cuánto ajusta el precio, en porcentaje. Puede ser negativo. */
  readonly pct: number;
}

/** Punto de partida: una sola franja que cubre todo y no cobra nada. */
export const TRAMOS_ALTURA_INICIALES: readonly TramoAltura[] = [
  { id: "a1", nombre: "Todas las alturas", desdeCm: 0, pct: 0 },
];

/** Ordena por borde inferior. Todo lo demás asume esta invariante. */
export function ordenarAltura(tramos: readonly TramoAltura[]): TramoAltura[] {
  return [...tramos].sort((a, b) => a.desdeCm - b.desdeCm);
}

/**
 * El tramo que le corresponde a una altura.
 *
 * Devuelve `null` si la altura no es utilizable o si la lista no arranca en 0.
 * La altura es OPCIONAL en el formulario: que no venga no es un error, solo
 * significa que no hay ajuste que aplicar.
 */
export function tramoAlturaDe(
  tramos: readonly TramoAltura[],
  alturaCm: number
): TramoAltura | null {
  if (!Number.isFinite(alturaCm) || alturaCm <= 0) return null;
  const orden = ordenarAltura(tramos);
  let elegido: TramoAltura | null = null;
  for (const t of orden) {
    if (alturaCm >= t.desdeCm) elegido = t;
    else break;
  }
  return elegido;
}

/**
 * El ajuste que aplica una altura, listo para sumar al desglose.
 *
 * Devuelve `null` cuando no hay nada que cobrar — sin altura, sin tramo, o con
 * el tramo en 0%. Un ajuste de 0% en el desglose es peor que no mostrarlo: le
 * dice al cliente que le cobran algo por su altura cuando no le cobran nada.
 */
export function ajusteDeAltura(
  tramos: readonly TramoAltura[],
  alturaCm: number
): { etiqueta: string; pct: number } | null {
  const tramo = tramoAlturaDe(tramos, alturaCm);
  if (!tramo || tramo.pct === 0) return null;
  return { etiqueta: `Altura: ${tramo.nombre}`, pct: tramo.pct };
}

/**
 * Hasta qué altura rige un tramo, derivado del siguiente. `null` = el último,
 * que es abierto por arriba.
 */
export function hastaCm(tramos: readonly TramoAltura[], id: string): number | null {
  const orden = ordenarAltura(tramos);
  const i = orden.findIndex((t) => t.id === id);
  if (i === -1 || i === orden.length - 1) return null;
  return orden[i + 1].desdeCm;
}

/** Cómo se lee el rango de un tramo: "30 – 50 cm", "más de 50 cm". */
export function rangoLegible(tramos: readonly TramoAltura[], id: string): string {
  const tramo = tramos.find((t) => t.id === id);
  if (!tramo) return "";
  const hasta = hastaCm(tramos, id);
  if (hasta === null) return `más de ${tramo.desdeCm} cm`;
  return `${tramo.desdeCm} – ${hasta} cm`;
}

/**
 * Errores que impiden guardar. Se valida antes de escribir, no después: una
 * tabla de alturas a medio configurar cotiza mal a clientes reales.
 */
export function validarAltura(tramos: readonly TramoAltura[]): string[] {
  const errores: string[] = [];
  if (tramos.length === 0) {
    errores.push("Debe haber al menos un tramo de altura.");
    return errores;
  }
  const orden = ordenarAltura(tramos);
  if (orden[0].desdeCm !== 0) {
    errores.push("El primer tramo debe empezar en 0 cm, o las alturas menores quedan sin ajuste.");
  }
  const vistos = new Set<number>();
  for (const t of orden) {
    if (!t.nombre.trim()) errores.push("Todos los tramos necesitan un nombre.");
    if (!Number.isFinite(t.desdeCm) || t.desdeCm < 0) {
      errores.push(`"${t.nombre || "sin nombre"}": la altura de inicio no es válida.`);
    }
    if (vistos.has(t.desdeCm)) {
      errores.push(`Hay dos tramos que empiezan en ${t.desdeCm} cm: el desempate sería arbitrario.`);
    }
    vistos.add(t.desdeCm);
    if (!Number.isFinite(t.pct)) {
      errores.push(`"${t.nombre || "sin nombre"}": el porcentaje no es válido.`);
    }
  }
  return errores;
}
