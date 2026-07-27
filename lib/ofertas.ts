import type { AjustePrecio } from "./reserva";

/* Ofertas del negocio (PRP-003 F2/F3) — reglas puras, sin React ni Supabase.

   Antes el incentivo vivía en dos lugares: el texto en el HTML de /reserva y
   el número en `ajustes_precio`. Cambiar uno sin el otro prometía algo
   distinto de lo que se cobraba. Ahora la oferta es una fila y este módulo
   decide cuál aplica.

   Se prueba sin navegador ni base de datos a propósito: acá vive la regla
   que determina cuánto paga una persona. */

export type TipoOferta = "pct" | "monto";

export interface Oferta {
  id: string;
  titulo: string;
  detalle: string;
  /** El beneficio solo se otorga a quien tiene cuenta — es el incentivo. */
  soloConCuenta: boolean;
  /** Desde qué visita aplica (1 = primera). */
  desdeVisita: number;
  /** Hasta qué visita; null = sin tope. */
  hastaVisita: number | null;
  tipo: TipoOferta;
  /** Siempre positivo; se aplica como descuento. */
  pct: number;
  monto: number | null;
  activa: boolean;
  vigenteDesde: string | null;
  vigenteHasta: string | null;
}

export interface ContextoCliente {
  /** ¿Tiene cuenta y sesión iniciada? */
  conCuenta: boolean;
  /** Visitas anteriores (sin contar la que se está reservando). */
  visitasPrevias: number;
}

/** Fecha de hoy en Chile, como YYYY-MM-DD. Comparar vigencias en UTC
    adelantaría o atrasaría el corte varias horas. */
function hoyLocal(ahora: Date): string {
  return ahora.toLocaleDateString("en-CA", { timeZone: "America/Santiago" });
}

export function estaVigente(oferta: Oferta, ahora: Date = new Date()): boolean {
  if (!oferta.activa) return false;
  const hoy = hoyLocal(ahora);
  if (oferta.vigenteDesde && hoy < oferta.vigenteDesde) return false;
  if (oferta.vigenteHasta && hoy > oferta.vigenteHasta) return false;
  return true;
}

/** ¿Le corresponde esta oferta a esta persona, en esta reserva? */
export function aplica(oferta: Oferta, ctx: ContextoCliente, ahora: Date = new Date()): boolean {
  if (!estaVigente(oferta, ahora)) return false;
  if (oferta.soloConCuenta && !ctx.conCuenta) return false;

  // La visita que se está reservando es la siguiente a las previas: quien
  // nunca vino está haciendo su visita nº 1.
  const visita = ctx.visitasPrevias + 1;
  if (visita < oferta.desdeVisita) return false;
  if (oferta.hastaVisita !== null && visita > oferta.hastaVisita) return false;

  return true;
}

/** Cuánto descuenta la oferta sobre una base, en pesos (valor positivo). */
export function montoDescuento(oferta: Oferta, base: number): number {
  if (oferta.tipo === "monto") return Math.min(oferta.monto ?? 0, base);
  return Math.round((base * oferta.pct) / 100);
}

/** La mejor oferta aplicable, o null.

    Varias ofertas pueden estar activas a la vez (bienvenida, 2ª cita,
    temporada) pero **nunca se acumulan**: dos descuentos sumados pueden
    dejar el precio bajo el costo. Se elige la que más le conviene al
    cliente sobre ESTA base — comparar 15% contra $5.000 sin la base no
    tiene sentido (decisión del señor Ignacio, 26-jul). */
export function mejorOferta(
  ofertas: Oferta[],
  ctx: ContextoCliente,
  base: number,
  ahora: Date = new Date()
): Oferta | null {
  const candidatas = ofertas.filter((o) => aplica(o, ctx, ahora));
  if (candidatas.length === 0) return null;

  return candidatas.reduce((mejor, o) =>
    montoDescuento(o, base) > montoDescuento(mejor, base) ? o : mejor
  );
}

/** Convierte una oferta en el ajuste que entiende el cálculo del precio.
    El signo se pone acá: en la base el valor es positivo (guardar "-10"
    invita a que alguien escriba "10" y termine subiendo el precio). */
export function comoAjuste(oferta: Oferta): AjustePrecio {
  return oferta.tipo === "monto"
    ? { etiqueta: oferta.titulo, pct: 0, monto: -(oferta.monto ?? 0) }
    : { etiqueta: oferta.titulo, pct: -oferta.pct };
}

/** Texto corto del beneficio, para mostrar: "10%" o "$5.000". */
export function textoBeneficio(oferta: Oferta): string {
  if (oferta.tipo === "monto") {
    return `$${(oferta.monto ?? 0).toLocaleString("es-CL")}`;
  }
  return `${oferta.pct}%`;
}

/* ── Validación (compartida por el panel y el server action) ── */

const LARGO_TITULO = 60;
const LARGO_DETALLE = 200;

export function validarOferta(oferta: Oferta): string | null {
  if (oferta.titulo.trim().length === 0) return "La oferta necesita un título.";
  if (oferta.titulo.length > LARGO_TITULO) return "El título es demasiado largo.";
  if (oferta.detalle.trim().length === 0) return "Escriba de qué se trata la oferta.";
  if (oferta.detalle.length > LARGO_DETALLE) return "El detalle es demasiado largo.";

  if (!Number.isInteger(oferta.desdeVisita) || oferta.desdeVisita < 1) {
    return "La visita desde la que aplica debe ser 1 o mayor.";
  }
  if (
    oferta.hastaVisita !== null &&
    (!Number.isInteger(oferta.hastaVisita) || oferta.hastaVisita < oferta.desdeVisita)
  ) {
    return "La última visita no puede ser menor que la primera.";
  }

  if (oferta.tipo === "monto") {
    if (!Number.isInteger(oferta.monto) || (oferta.monto ?? -1) < 0) {
      return "El monto del descuento debe ser un número de pesos.";
    }
  } else if (Number.isNaN(oferta.pct) || oferta.pct < 0 || oferta.pct > 100) {
    return "El porcentaje debe estar entre 0 y 100.";
  }

  if (
    oferta.vigenteDesde &&
    oferta.vigenteHasta &&
    oferta.vigenteHasta < oferta.vigenteDesde
  ) {
    return "La fecha de término no puede ser anterior a la de inicio.";
  }

  return null;
}

/** Avisa si el texto promete un plazo que la anticipación mínima impide.
    No bloquea: el admin puede tener una razón. Pero prometer "reserva para
    hoy" con lead time de 2 días es una promesa que el sistema va a romper
    (advertencia pedida por el señor Ignacio, 26-jul). */
export function chocaConLeadTime(oferta: Oferta, leadTimeDias: number): boolean {
  if (leadTimeDias <= 0) return false;
  const texto = `${oferta.titulo} ${oferta.detalle}`.toLowerCase();
  const promesasInmediatas = ["hoy", "ahora mismo", "al instante", "de inmediato"];
  if (leadTimeDias > 1 && texto.includes("mañana")) return true;
  return promesasInmediatas.some((p) => texto.includes(p));
}
