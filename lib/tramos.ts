/* Tramos de precio por peso — dominio puro, sin Supabase ni React.
 *
 * POR QUÉ EXISTE (pedido del cliente, 27-jul):
 * los cinco tamaños fijos cobraban de menos en los bordes. Probándolo él mismo
 * en la página, un perrito de 8 kg caía en "Pequeño (6–10 kg)" y salía $20.000
 * cuando debería estar entre $25.000 y $30.000. El problema no era el número:
 * era que los cortes vivían en el código, así que ajustar un precio exigía un
 * despliegue. Ahora los tramos se configuran desde el panel.
 *
 * LA DECISIÓN DE DISEÑO QUE IMPORTA — un tramo declara solo DESDE dónde rige.
 * El "hasta" se deriva del tramo siguiente. Con eso, un hueco de cobertura es
 * IMPOSIBLE de configurar: no hay forma de escribir dos números que dejen un
 * peso sin precio, porque el segundo número no existe.
 *
 * No es una preferencia estética. La tabla actual ya tiene ese defecto —
 * `TAMANO_RANGOS` va toy [0,5] y pequeno [6,10], y el medio kilo entre 5 y 6
 * queda en tierra de nadie: `detectarTamanoPorPeso(5.5)` responde "pequeno"
 * mientras `hayConflicto("pequeno", 5.5)` dice que hay conflicto. Un perro real
 * de 5,5 kg dispara una advertencia falsa. Con tramos por borde inferior, esa
 * clase de error deja de poder escribirse.
 */

export interface Tramo {
  /** Identificador estable. Sobrevive a reordenar o renombrar. */
  readonly id: string;
  /** Cómo se le muestra al cliente: "Mini / Toy", "Pequeño"… */
  readonly nombre: string;
  /** Desde cuántos kilos rige, INCLUSIVE. El primero debe ser 0. */
  readonly desdeKg: number;
  /** Precio del servicio base para este tramo, en pesos. */
  readonly precio: number;
}

/**
 * Punto de partida — los cortes que pidió el cliente en el audio del 27-jul.
 *
 * Los PRECIOS son provisionales: se derivaron de la tabla vigente para que nada
 * quede sin valor, y el cliente los ajusta en el panel (dijo que traería los
 * definitivos a la reunión). Van marcados aquí para que nadie los tome por
 * acordados.
 */
export const TRAMOS_INICIALES: readonly Tramo[] = [
  { id: "t1", nombre: "Mini / Toy", desdeKg: 0, precio: 18000 },
  { id: "t2", nombre: "Toy grande", desdeKg: 3, precio: 20000 },
  { id: "t3", nombre: "Pequeño", desdeKg: 5, precio: 22000 },
  { id: "t4", nombre: "Pequeño grande", desdeKg: 8, precio: 25000 },
  { id: "t5", nombre: "Mediano", desdeKg: 10, precio: 28000 },
  { id: "t6", nombre: "Mediano grande", desdeKg: 15, precio: 32000 },
  { id: "t7", nombre: "Grande", desdeKg: 20, precio: 40000 },
  { id: "t8", nombre: "Extra grande", desdeKg: 40, precio: 60000 },
  { id: "t9", nombre: "Gigante", desdeKg: 60, precio: 80000 },
];

/** Ordena por borde inferior. Todo lo demás asume esta invariante. */
export function ordenar(tramos: readonly Tramo[]): Tramo[] {
  return [...tramos].sort((a, b) => a.desdeKg - b.desdeKg);
}

/**
 * El tramo que le corresponde a un peso.
 *
 * Devuelve `null` solo si la lista está vacía o no arranca en 0 — es decir, si
 * de verdad no hay con qué cotizar. Nunca inventa un precio por defecto: cobrar
 * un número que nadie configuró es peor que decir que falta configurarlo.
 */
export function tramoDe(tramos: readonly Tramo[], pesoKg: number): Tramo | null {
  if (!Number.isFinite(pesoKg) || pesoKg < 0) return null;
  const orden = ordenar(tramos);
  let elegido: Tramo | null = null;
  for (const t of orden) {
    if (pesoKg >= t.desdeKg) elegido = t;
    else break;
  }
  return elegido;
}

/** Precio base para un peso, o `null` si no hay tramo que lo cubra. */
export function precioDe(tramos: readonly Tramo[], pesoKg: number): number | null {
  return tramoDe(tramos, pesoKg)?.precio ?? null;
}

/**
 * El precio más barato dentro de un rango de pesos — el "desde" honesto.
 *
 * POR QUÉ EXISTE (4-ago): la landing agrupa los perritos en cinco categorías
 * ("Pequeños 6–10 kg") y muestra un "desde", pero ese número salía de la tabla
 * vieja por tamaño mientras el formulario ya cotizaba por tramos. Quedaron
 * distintos: la portada prometía $20.000 para un perro de 8 kg y el formulario
 * cobraba $25.000. No era por los recargos —esos se suman después y está bien
 * que suban— sino porque el piso mismo estaba desactualizado.
 *
 * Un rango de la landing puede cruzar varios tramos (6–10 kg toca "Pequeño" y
 * "Pequeño grande"), así que el "desde" es el MENOR de los que caen dentro. Se
 * incluye el tramo que cubre el borde inferior aunque arranque antes: un perro
 * de 6 kg paga lo que dice su tramo, empiece este en 5 o en 6.
 *
 * Devuelve `null` si no hay tramos: la landing muestra entonces su valor de
 * respaldo en vez de un precio inventado.
 */
export function precioDesdeEnRango(
  tramos: readonly Tramo[],
  desdeKg: number,
  hastaKg: number
): number | null {
  if (tramos.length === 0) return null;
  const precios: number[] = [];

  // El tramo que cubre el borde inferior, aunque haya arrancado antes.
  const enBorde = tramoDe(tramos, desdeKg);
  if (enBorde) precios.push(enBorde.precio);

  // Y todos los que empiezan dentro del rango.
  for (const t of ordenar(tramos)) {
    if (t.desdeKg > desdeKg && t.desdeKg <= hastaKg) precios.push(t.precio);
  }

  return precios.length > 0 ? Math.min(...precios) : null;
}

/**
 * Hasta qué peso rige un tramo, derivado del siguiente. `null` = el último,
 * que es abierto por arriba.
 */
export function hastaKg(tramos: readonly Tramo[], id: string): number | null {
  const orden = ordenar(tramos);
  const i = orden.findIndex((t) => t.id === id);
  if (i === -1 || i === orden.length - 1) return null;
  return orden[i + 1].desdeKg;
}

/**
 * Cómo se le enseña el tramo al cliente.
 *
 * El límite superior se escribe como el borde real menos un gramo ("hasta 4,9
 * kg" cuando el siguiente arranca en 5) porque así lo lee una persona. El
 * cálculo sigue usando el borde exacto: lo que cambia es el rótulo, no la regla.
 */
export function rangoLegible(tramos: readonly Tramo[], id: string): string {
  const t = ordenar(tramos).find((x) => x.id === id);
  if (!t) return "";
  const hasta = hastaKg(tramos, id);
  if (hasta === null) return `más de ${kg(t.desdeKg)} kg`;
  if (t.desdeKg === 0) return `hasta ${kg(hasta - 0.1)} kg`;
  return `${kg(t.desdeKg)} – ${kg(hasta - 0.1)} kg`;
}

function kg(n: number): string {
  const r = Math.round(n * 10) / 10;
  return Number.isInteger(r) ? String(r) : r.toFixed(1).replace(".", ",");
}

export interface ProblemaTramos {
  readonly tipo: "sin_tramos" | "no_arranca_en_cero" | "borde_repetido" | "precio_invalido" | "peso_invalido";
  readonly mensaje: string;
  readonly id?: string;
}

/**
 * Valida una configuración ANTES de guardarla.
 *
 * No puede haber huecos —el modelo los hace imposibles— pero sí quedan tres
 * formas de romperlo: no cubrir desde cero, repetir un borde (dos precios para
 * el mismo peso, y el desempate sería arbitrario) o poner un precio absurdo.
 * Las tres se atajan aquí, con el motivo escrito, en vez de descubrirlas
 * cuando un cliente ya está cotizando.
 */
export function validar(tramos: readonly Tramo[]): ProblemaTramos[] {
  const problemas: ProblemaTramos[] = [];
  if (tramos.length === 0) {
    return [{ tipo: "sin_tramos", mensaje: "No hay ningún tramo configurado: no se puede cotizar." }];
  }

  const orden = ordenar(tramos);

  if (orden[0].desdeKg !== 0) {
    problemas.push({
      tipo: "no_arranca_en_cero",
      id: orden[0].id,
      mensaje: `El primer tramo arranca en ${kg(orden[0].desdeKg)} kg, así que los perritos más livianos quedarían sin precio. Debe empezar en 0.`,
    });
  }

  for (let i = 1; i < orden.length; i++) {
    if (orden[i].desdeKg === orden[i - 1].desdeKg) {
      problemas.push({
        tipo: "borde_repetido",
        id: orden[i].id,
        mensaje: `"${orden[i].nombre}" y "${orden[i - 1].nombre}" arrancan en el mismo peso (${kg(orden[i].desdeKg)} kg): un perrito de ese peso tendría dos precios.`,
      });
    }
  }

  for (const t of orden) {
    if (!Number.isFinite(t.desdeKg) || t.desdeKg < 0) {
      problemas.push({ tipo: "peso_invalido", id: t.id, mensaje: `"${t.nombre}" tiene un peso de inicio inválido.` });
    }
    if (!Number.isFinite(t.precio) || t.precio <= 0 || !Number.isInteger(t.precio)) {
      problemas.push({
        tipo: "precio_invalido",
        id: t.id,
        mensaje: `"${t.nombre}" tiene un precio inválido: debe ser un número entero mayor que cero.`,
      });
    }
  }

  return problemas;
}

/** ¿Se puede guardar y cotizar con esto? */
export function esConfiguracionValida(tramos: readonly Tramo[]): boolean {
  return validar(tramos).length === 0;
}
