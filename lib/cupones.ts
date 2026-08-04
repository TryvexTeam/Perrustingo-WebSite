/* Cupones con condiciones — dominio puro, sin Supabase ni React.
 *
 * POR QUÉ EXISTE (pedido del dueño, 4-ago): la tabla `cupones` solo tenía
 * código, descripción, porcentaje y activo. Un código era o válido para todos
 * y para siempre, o no existía. Lo que él pidió fue lo contrario: premiar una
 * conducta concreta —"que por X tiempo de anticipación de la cita se le agregue
 * un cupón", "que por su 2ª cita tenga un cupón"—, y eso exige que el cupón
 * sepa a quién y cuándo le toca. La migración 035 agregó las columnas; acá vive
 * la regla que las lee.
 *
 * DECISIÓN DE DISEÑO — cada rechazo trae su motivo Y su mensaje al cliente.
 * `evaluarCupon` nunca devuelve un `false` pelado. En este proyecto ya pasó dos
 * veces que un rechazo mudo (un 42501 tapado, un cupón que "no existe") dejara
 * a alguien mirando una pantalla que no explicaba nada, y a nosotros sin poder
 * diagnosticarlo. Si un cupón no aplica, la persona tiene que poder leer qué le
 * falta: puede que le baste con reservar tres días después.
 *
 * CUIDADO CON LAS FECHAS: acá NO se usa `new Date("2026-08-10")`. Ese
 * constructor interpreta la fecha como medianoche UTC, y en Chile (UTC-3/-4)
 * eso cae el día ANTERIOR. Un cupón que vence el 10 dejaría de servir el 9.
 * Las fechas se comparan como texto YYYY-MM-DD —que ordena igual que el
 * calendario— y la resta de días se hace con las partes del string.
 */

export interface Cupon {
  codigo: string;
  descripcion: string;
  descuentoPct: number;
  activo: boolean;
  /** Desde qué día sirve, inclusive. `null` = desde siempre. */
  vigenteDesde: string | null;
  /** Hasta qué día sirve, inclusive. `null` = sin vencimiento. */
  vigenteHasta: string | null;
  /** Tope de canjes. `null` = sin tope. */
  maxUsos: number | null;
  usos: number;
  /** Días mínimos entre hoy y la cita. `null` = sin exigencia. */
  diasAnticipacionMin: number | null;
  /** Visita desde la que aplica (2 = de la segunda en adelante). */
  desdeVisita: number | null;
  /** Última visita en la que aplica. `null` = sin techo. */
  hastaVisita: number | null;
  soloConCuenta: boolean;
  /** Servicio al que se limita. `null` = cualquiera. */
  servicioSlug: string | null;
}

export interface ContextoCanje {
  /** Día de la cita, YYYY-MM-DD. */
  fechaCita: string;
  /** Hoy en el huso del negocio, YYYY-MM-DD. */
  hoy: string;
  /** Qué número de visita es esta. 1 = viene por primera vez. */
  numeroVisita: number;
  tieneCuenta: boolean;
  /** Slug o nombre del servicio elegido. `null` = no se sabe. */
  servicioSlug: string | null;
}

export type MotivoRechazo =
  | "no_existe"
  | "inactivo"
  | "aun_no_vigente"
  | "vencido"
  | "sin_usos"
  | "poca_anticipacion"
  | "visita_no_corresponde"
  | "requiere_cuenta"
  | "otro_servicio";

export type Rechazo = { ok: false; motivo: MotivoRechazo; mensaje: string };
export type Aceptacion = { ok: true; descuentoPct: number };
export type ResultadoCanje = Aceptacion | Rechazo;

/** ¿Es una fecha YYYY-MM-DD que se puede comparar? */
function esFecha(v: string | null | undefined): v is string {
  return typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v);
}

/**
 * Días completos entre dos fechas YYYY-MM-DD (b − a).
 *
 * Se parte el string a mano y se arma con `Date.UTC`: ambas fechas quedan en el
 * mismo huso ficticio, así que la resta cuenta días de calendario sin que el
 * horario de verano chileno —que mueve el reloj una hora dos veces al año— se
 * lleve un día por delante al dividir por 86.400.000.
 */
export function diasEntre(a: string, b: string): number {
  const [aa, am, ad] = a.split("-").map(Number);
  const [ba, bm, bd] = b.split("-").map(Number);
  const ms = Date.UTC(ba, bm - 1, bd) - Date.UTC(aa, am - 1, ad);
  return Math.round(ms / 86_400_000);
}

/** Cómo se escribe una fecha YYYY-MM-DD para una persona: "10-08-2026". */
function fechaLegible(f: string): string {
  const [a, m, d] = f.split("-");
  return `${d}-${m}-${a}`;
}

function plural(n: number, singular: string, plural_: string): string {
  return n === 1 ? `1 ${singular}` : `${n} ${plural_}`;
}

/**
 * ¿Este cupón aplica a este canje, y por cuánto?
 *
 * El porcentaje sale SIEMPRE del cupón, nunca de lo que diga el navegador.
 * El orden de los rechazos va de lo más general a lo más específico para que
 * el mensaje que lee la persona sea el más útil: de nada sirve decirle "le
 * falta anticipación" si además el cupón está vencido.
 */
export function evaluarCupon(cupon: Cupon | null, ctx: ContextoCanje): ResultadoCanje {
  if (!cupon) {
    return {
      ok: false,
      motivo: "no_existe",
      mensaje: "Ese cupón no existe. Revise que esté bien escrito.",
    };
  }

  if (!cupon.activo) {
    return {
      ok: false,
      motivo: "inactivo",
      mensaje: "Ese cupón ya no está disponible.",
    };
  }

  // ── Vigencia ──────────────────────────────────────────────────────────────
  // Se compara contra HOY, no contra el día de la cita: el cupón se canjea al
  // reservar. Uno que vence mañana sirve hoy aunque la cita sea el mes que
  // viene, y eso es lo que la persona entiende al leer "válido hasta el 10".
  if (esFecha(cupon.vigenteDesde) && esFecha(ctx.hoy) && ctx.hoy < cupon.vigenteDesde) {
    return {
      ok: false,
      motivo: "aun_no_vigente",
      mensaje: `Este cupón empieza a servir el ${fechaLegible(cupon.vigenteDesde)}.`,
    };
  }

  if (esFecha(cupon.vigenteHasta) && esFecha(ctx.hoy) && ctx.hoy > cupon.vigenteHasta) {
    return {
      ok: false,
      motivo: "vencido",
      mensaje: `Este cupón venció el ${fechaLegible(cupon.vigenteHasta)}.`,
    };
  }

  // ── Tope de canjes ────────────────────────────────────────────────────────
  // Existe para que un código filtrado no se use sin fin, no para castigar a
  // nadie: por eso el mensaje no acusa, solo dice que se acabó.
  if (cupon.maxUsos !== null && cupon.usos >= cupon.maxUsos) {
    return {
      ok: false,
      motivo: "sin_usos",
      mensaje: "Este cupón ya se usó todas las veces disponibles.",
    };
  }

  // ── Cuenta ────────────────────────────────────────────────────────────────
  if (cupon.soloConCuenta && !ctx.tieneCuenta) {
    return {
      ok: false,
      motivo: "requiere_cuenta",
      mensaje: "Este cupón es para clientes con cuenta. Cree una cuenta y vuelva a intentarlo.",
    };
  }

  // ── Anticipación ──────────────────────────────────────────────────────────
  // El caso que pidió el dueño: premiar a quien reserva con tiempo. Se le dice
  // exactamente cuántos días faltan, porque con ese dato puede simplemente
  // correr la cita y quedarse con el descuento.
  if (cupon.diasAnticipacionMin !== null) {
    if (!esFecha(ctx.fechaCita) || !esFecha(ctx.hoy)) {
      return {
        ok: false,
        motivo: "poca_anticipacion",
        mensaje: "Elija primero el día de la cita para poder aplicar este cupón.",
      };
    }
    const anticipacion = diasEntre(ctx.hoy, ctx.fechaCita);
    if (anticipacion < cupon.diasAnticipacionMin) {
      return {
        ok: false,
        motivo: "poca_anticipacion",
        mensaje: `Este cupón pide reservar con al menos ${plural(
          cupon.diasAnticipacionMin,
          "día",
          "días"
        )} de anticipación. Para esa fecha faltan ${plural(
          Math.max(anticipacion, 0),
          "día",
          "días"
        )}.`,
      };
    }
  }

  // ── Número de visita ──────────────────────────────────────────────────────
  // El otro caso pedido: "que por su 2ª cita tenga un cupón". `numeroVisita`
  // cuenta ESTA visita incluida, así que quien viene por primera vez es 1.
  if (cupon.desdeVisita !== null && ctx.numeroVisita < cupon.desdeVisita) {
    return {
      ok: false,
      motivo: "visita_no_corresponde",
      mensaje:
        cupon.desdeVisita === 2
          ? "Este cupón es para su segunda visita en adelante. En la primera no aplica."
          : `Este cupón aplica desde la visita número ${cupon.desdeVisita}.`,
    };
  }

  if (cupon.hastaVisita !== null && ctx.numeroVisita > cupon.hastaVisita) {
    return {
      ok: false,
      motivo: "visita_no_corresponde",
      mensaje:
        cupon.hastaVisita === 1
          ? "Este cupón es solo para la primera visita."
          : `Este cupón aplica hasta la visita número ${cupon.hastaVisita}.`,
    };
  }

  // ── Servicio ──────────────────────────────────────────────────────────────
  // La comparación tolera slug o nombre —el formulario guarda el NOMBRE del
  // servicio, no el slug— por el mismo motivo que `ajusteDeServicio`: comparar
  // solo por slug dejaría el cupón rechazado siempre y en silencio.
  if (cupon.servicioSlug) {
    const pedido = cupon.servicioSlug.trim().toLowerCase();
    const elegido = (ctx.servicioSlug ?? "").trim().toLowerCase();
    if (elegido !== pedido && normalizarServicio(elegido) !== normalizarServicio(pedido)) {
      return {
        ok: false,
        motivo: "otro_servicio",
        mensaje: `Este cupón sirve solo para "${cupon.servicioSlug}".`,
      };
    }
  }

  return { ok: true, descuentoPct: cupon.descuentoPct };
}

/**
 * "Baño y corte de pelo" y "bano-y-corte" son el mismo servicio escrito de dos
 * formas: una la guarda el formulario, la otra es la clave de la tabla. Se
 * bajan las dos a letras y números sin tildes para poder compararlas.
 */
function normalizarServicio(v: string): string {
  return v
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]/gi, "")
    .toLowerCase();
}

/** Cómo se le explica una condición al dueño en el panel, en palabras simples. */
export function condicionesLegibles(cupon: Cupon): string[] {
  const c: string[] = [];
  if (cupon.vigenteDesde) c.push(`Empieza el ${fechaLegible(cupon.vigenteDesde)}`);
  if (cupon.vigenteHasta) c.push(`Vence el ${fechaLegible(cupon.vigenteHasta)}`);
  if (cupon.maxUsos !== null) c.push(`${cupon.usos} de ${cupon.maxUsos} usados`);
  if (cupon.diasAnticipacionMin !== null) {
    c.push(`Solo reservando con ${plural(cupon.diasAnticipacionMin, "día", "días")} de anticipación`);
  }
  if (cupon.desdeVisita !== null) {
    c.push(cupon.desdeVisita === 2 ? "Solo desde la 2ª visita" : `Solo desde la visita ${cupon.desdeVisita}`);
  }
  if (cupon.hastaVisita !== null) {
    c.push(cupon.hastaVisita === 1 ? "Solo en la 1ª visita" : `Solo hasta la visita ${cupon.hastaVisita}`);
  }
  if (cupon.soloConCuenta) c.push("Solo para clientes con cuenta");
  if (cupon.servicioSlug) c.push(`Solo para "${cupon.servicioSlug}"`);
  if (c.length === 0) c.push("Sin condiciones: sirve siempre y para todos");
  return c;
}

/**
 * Valida un cupón ANTES de guardarlo. Devuelve los problemas con su motivo
 * escrito, no un booleano: el panel tiene que poder decirle al dueño qué campo
 * está mal, no solo que "no se pudo".
 */
export function validarCupon(cupon: Cupon): string[] {
  const p: string[] = [];
  const codigo = cupon.codigo.trim();

  if (codigo.length === 0) p.push("El código no puede estar vacío.");
  if (codigo.length > 40) p.push("El código no puede pasar de 40 caracteres.");
  if (/\s/.test(codigo)) p.push("El código no puede llevar espacios: el cliente lo escribe a mano.");

  // El CHECK de la base es 1–50. Si acá se aceptara 0 o 60, el guardado
  // reventaría con un error de Postgres que no le dice nada a nadie.
  if (!Number.isInteger(cupon.descuentoPct) || cupon.descuentoPct < 1 || cupon.descuentoPct > 50) {
    p.push("El descuento debe ser un número entero entre 1 y 50 por ciento.");
  }

  if (cupon.vigenteDesde && !esFecha(cupon.vigenteDesde)) p.push("La fecha de inicio es inválida.");
  if (cupon.vigenteHasta && !esFecha(cupon.vigenteHasta)) p.push("La fecha de término es inválida.");
  if (
    esFecha(cupon.vigenteDesde) &&
    esFecha(cupon.vigenteHasta) &&
    cupon.vigenteDesde > cupon.vigenteHasta
  ) {
    p.push("La fecha de término es anterior a la de inicio: el cupón no serviría ningún día.");
  }

  if (cupon.maxUsos !== null && (!Number.isInteger(cupon.maxUsos) || cupon.maxUsos < 1)) {
    p.push("El tope de usos debe ser un número entero mayor que cero, o quedar vacío.");
  }
  if (
    cupon.diasAnticipacionMin !== null &&
    (!Number.isInteger(cupon.diasAnticipacionMin) || cupon.diasAnticipacionMin < 0)
  ) {
    p.push("Los días de anticipación deben ser un número entero de 0 o más.");
  }
  if (cupon.desdeVisita !== null && (!Number.isInteger(cupon.desdeVisita) || cupon.desdeVisita < 1)) {
    p.push("La visita desde la que aplica debe ser 1 o más.");
  }
  if (cupon.hastaVisita !== null && (!Number.isInteger(cupon.hastaVisita) || cupon.hastaVisita < 1)) {
    p.push("La visita hasta la que aplica debe ser 1 o más.");
  }
  if (
    cupon.desdeVisita !== null &&
    cupon.hastaVisita !== null &&
    cupon.desdeVisita > cupon.hastaVisita
  ) {
    p.push("El rango de visitas está al revés: no hay ninguna visita que lo cumpla.");
  }

  return p;
}
