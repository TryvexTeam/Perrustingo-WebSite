import { normalizarTelefono } from "./contacto";

/* Detección de ráfagas sospechosas de reservas (PRP-004 F6).

   Por qué existe. Las defensas anteriores frenan lo que se puede frenar sin
   riesgo: el rate limit por IP y por teléfono, y el tope de citas activas por
   teléfono (migración 017). Pero quedó un límite medido y admitido: **diez
   teléfonos falsos distintos siguen creando diez citas**. Ninguna regla
   automática puede distinguir eso de un buen día de promoción, y cancelar
   solo sería peor que el ataque — le cerraríamos la puerta a clientes reales.

   Así que esta capa no bloquea: **mira y avisa**. El equipo decide. Lo que
   aporta es que la decisión llegue con la evidencia agrupada, en vez de que
   alguien tenga que sospechar mirando una lista de 40 citas a mano.

   Cálculo puro: entra un arreglo de filas, sale un arreglo de alertas. Sin
   red, sin base de datos — se puede verificar sin navegador. */

export interface FilaSospecha {
  id: string;
  /** ISO de cuándo se creó la reserva (no cuándo es la cita). */
  created_at: string;
  /** ISO de la cita agendada, si tiene. */
  fecha_cita: string | null;
  estado: string;
  contacto_telefono: string | null;
  contacto_nombre: string | null;
  /** Null = reservó sin cuenta. */
  cliente_id: string | null;
}

export type NivelAlerta = "alta" | "media";

export interface Alerta {
  /** Identificador estable del grupo — sirve de key en React. */
  clave: string;
  nivel: NivelAlerta;
  /** Título corto, en el idioma del salón. */
  titulo: string;
  /** Qué se vio, con números. Nunca una acusación: una observación. */
  detalle: string;
  /** IDs de las citas involucradas, para poder cancelarlas en bloque. */
  citas: string[];
}

/* Umbrales.

   Están altos a propósito. Un falso positivo acá no bloquea a nadie —solo
   muestra un aviso—, pero un panel que grita todos los días deja de leerse, y
   entonces no sirve para el día que sí importa. Prefiero que avise poco y que
   cuando avise, el equipo mire. */
const RAFAGA_MISMO_TELEFONO = { minutos: 30, minimo: 3 } as const;
const RAFAGA_VARIOS_TELEFONOS = { minutos: 15, minimo: 6 } as const;
const DIA_COPADO = { minimo: 5 } as const;

const MS_MINUTO = 60_000;

/** ISO del inicio de la ventana a revisar: `horas` hacia atrás desde ahora.
    Vive acá y no en la página porque leer el reloj dentro del render de un
    componente no es puro, y React 19 lo marca con razón. */
export function inicioVentana(horas: number): string {
  return new Date(Date.now() - horas * 3_600_000).toISOString();
}

/** Solo tiene sentido revisar lo que todavía se puede cancelar. */
function estaViva(estado: string): boolean {
  return estado === "pendiente" || estado === "confirmada";
}

/** yyyy-mm-dd de la cita en hora de Chile. */
function diaDeCita(iso: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Santiago",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(iso));
}

function hora(iso: string): string {
  // hour12:false a propósito: el formato chileno "09:36 p. m." mete puntos que
  // chocan con el punto de la frase ("...09:46 p. m.."). 21:36 se lee mejor y
  // es como se escriben los horarios del local.
  return new Intl.DateTimeFormat("es-CL", {
    timeZone: "America/Santiago",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(iso));
}

/** La ventana más apretada de `filas` que contenga al menos `minimo`
    elementos dentro de `minutos`. Devuelve null si no existe. */
function ventanaDensa(
  filas: FilaSospecha[],
  minutos: number,
  minimo: number
): FilaSospecha[] | null {
  const orden = [...filas].sort(
    (a, b) => Date.parse(a.created_at) - Date.parse(b.created_at)
  );
  const ancho = minutos * MS_MINUTO;

  let mejor: FilaSospecha[] | null = null;
  let inicio = 0;
  for (let fin = 0; fin < orden.length; fin++) {
    while (
      Date.parse(orden[fin].created_at) - Date.parse(orden[inicio].created_at) >
      ancho
    ) {
      inicio++;
    }
    const largo = fin - inicio + 1;
    if (largo >= minimo && (!mejor || largo > mejor.length)) {
      mejor = orden.slice(inicio, fin + 1);
    }
  }
  return mejor;
}

/** Revisa las reservas recientes y devuelve lo que valdría la pena mirar.

    `filas` debería traer las reservas creadas en las últimas 24–48 horas: más
    atrás no es una ráfaga, es historia. */
export function detectarSospechas(filas: FilaSospecha[]): Alerta[] {
  const vivas = filas.filter((f) => estaViva(f.estado) && f.created_at);
  const alertas: Alerta[] = [];

  // ── 1. Un mismo teléfono reservando muchas veces seguidas ──────────
  // El tope de la migración 017 corta a la cuarta, pero el intento igual
  // queda registrado y es lo más parecido a una firma de bot que tenemos.
  const porTelefono = new Map<string, FilaSospecha[]>();
  for (const fila of vivas) {
    const tel = normalizarTelefono(fila.contacto_telefono ?? "");
    if (!tel) continue;
    porTelefono.set(tel, [...(porTelefono.get(tel) ?? []), fila]);
  }

  for (const [telefono, delTelefono] of porTelefono) {
    const grupo = ventanaDensa(
      delTelefono,
      RAFAGA_MISMO_TELEFONO.minutos,
      RAFAGA_MISMO_TELEFONO.minimo
    );
    if (!grupo) continue;

    const nombre = grupo.find((g) => g.contacto_nombre)?.contacto_nombre;
    alertas.push({
      clave: `telefono:${telefono}`,
      nivel: "media",
      titulo: `${grupo.length} reservas seguidas desde un mismo teléfono`,
      detalle:
        `${telefono}${nombre ? ` (${nombre})` : ""} hizo ${grupo.length} reservas ` +
        `entre las ${hora(grupo[0].created_at)} y las ${hora(grupo[grupo.length - 1].created_at)}. ` +
        `Puede ser alguien con varios perros — vale una llamada antes de tocar nada.`,
      citas: grupo.map((g) => g.id),
    });
  }

  // ── 2. Muchas reservas sin cuenta en pocos minutos ─────────────────
  // Este es el ataque que las defensas anteriores NO frenan: teléfonos
  // distintos, uno por cita. Un humano no llena seis formularios en un
  // cuarto de hora; un script sí.
  const sinCuenta = vivas.filter((f) => !f.cliente_id);
  const rafaga = ventanaDensa(
    sinCuenta,
    RAFAGA_VARIOS_TELEFONOS.minutos,
    RAFAGA_VARIOS_TELEFONOS.minimo
  );
  if (rafaga) {
    const telefonos = new Set(
      rafaga.map((r) => normalizarTelefono(r.contacto_telefono ?? "")).filter(Boolean)
    );
    alertas.push({
      clave: "rafaga-sin-cuenta",
      nivel: "alta",
      titulo: `${rafaga.length} reservas sin cuenta en ${RAFAGA_VARIOS_TELEFONOS.minutos} minutos`,
      detalle:
        `Llegaron ${rafaga.length} reservas desde ${telefonos.size} teléfonos distintos ` +
        `entre las ${hora(rafaga[0].created_at)} y las ${hora(rafaga[rafaga.length - 1].created_at)}. ` +
        `Si no salió una promoción hoy, conviene confirmar por WhatsApp antes de reservarles el día.`,
      citas: rafaga.map((r) => r.id),
    });
  }

  // ── 3. Un día que se llenó de golpe con reservas sin cuenta ────────
  // El daño real de este ataque no es la base de datos: es la agenda. Ocho
  // citas falsas dejan un día entero sin poder venderse.
  const porDia = new Map<string, FilaSospecha[]>();
  for (const fila of sinCuenta) {
    if (!fila.fecha_cita) continue;
    const dia = diaDeCita(fila.fecha_cita);
    porDia.set(dia, [...(porDia.get(dia) ?? []), fila]);
  }

  for (const [dia, delDia] of porDia) {
    if (delDia.length < DIA_COPADO.minimo) continue;
    alertas.push({
      clave: `dia:${dia}`,
      nivel: "alta",
      titulo: `${delDia.length} reservas sin cuenta para el ${dia}`,
      detalle:
        `Ese día quedó con ${delDia.length} reservas sin cuenta hechas en las últimas horas. ` +
        `Si son falsas, el día queda bloqueado para clientes reales.`,
      citas: delDia.map((d) => d.id),
    });
  }

  // Lo grave primero, y dentro de cada nivel, lo más numeroso.
  const peso: Record<NivelAlerta, number> = { alta: 0, media: 1 };
  return alertas.sort(
    (a, b) => peso[a.nivel] - peso[b.nivel] || b.citas.length - a.citas.length
  );
}
