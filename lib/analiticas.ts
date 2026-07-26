import { offsetNegocio } from "./agenda";
import type { EstadoCita } from "./citas";

/* Analíticas del negocio (PRP-001 Fase 4) — agregación pura sobre las
   sesiones de un rango. Sin React ni Supabase adentro a propósito: así el
   cálculo se puede verificar solo, y la página se limita a traer las filas
   y mostrar el resultado. */

/** Lo mínimo que necesita el cálculo de una sesión. */
export interface FilaSesion {
  estado: EstadoCita;
  fecha_cita: string | null;
  servicio: string | null;
  precio_base: number | null;
  precio_final: number | null;
  /** NULL = reservó sin cuenta (PRP-003). */
  cliente_id?: string | null;
  contacto_comuna?: string | null;
  /** Qué oferta se le aplicó, si alguna. */
  oferta_id?: string | null;
}

export interface ResumenServicio {
  nombre: string;
  cantidad: number;
  monto: number;
}

export interface PuntoDia {
  fecha: string;
  cantidad: number;
  monto: number;
}

/** El embudo: de dónde vienen las reservas y si el incentivo convierte.
    Es lo que permite decidir si vale la pena mantener la oferta, y si la
    apertura a reservas sin cuenta trajo gente nueva o solo movió a los que
    igual se habrían registrado. */
export interface Embudo {
  conCuenta: number;
  sinCuenta: number;
  /** % de las reservas que vinieron con cuenta. */
  pctConCuenta: number;
  /** Cuántas se llevaron alguna oferta. */
  conOferta: number;
  /** Ingresos de cada grupo — una reserva sin cuenta que paga igual vale
      lo mismo para el negocio. */
  ingresoConCuenta: number;
  ingresoSinCuenta: number;
  /** Ticket promedio de cada grupo, para comparar peras con peras. */
  ticketConCuenta: number;
  ticketSinCuenta: number;
}

export interface ResumenComuna {
  nombre: string;
  cantidad: number;
  monto: number;
}

export interface Analiticas {
  total: number;
  porEstado: Record<EstadoCita, number>;
  /** Plata que ya entró: solo citas completadas. */
  ingresosRealizados: number;
  /** Lo que está agendado y todavía puede caerse (confirmada + en proceso). */
  ingresosProyectados: number;
  /** Promedio por cita completada. 0 si no hubo ninguna. */
  ticketPromedio: number;
  /** Canceladas sobre el total, en porcentaje entero. */
  tasaCancelacion: number;
  servicios: ResumenServicio[];
  porDia: PuntoDia[];
  embudo: Embudo;
  comunas: ResumenComuna[];
}

const ESTADOS: EstadoCita[] = [
  "pendiente",
  "confirmada",
  "en_proceso",
  "completada",
  "cancelada",
];

/** Cuánto vale una cita. `precio_final` manda porque es lo que se cobró de
    verdad; `precio_base` es el estimado con el que nació. Sin ninguno de
    los dos vale 0: contarla como ingreso desconocido inflaría el total. */
export function precioDeSesion(fila: FilaSesion): number {
  return fila.precio_final ?? fila.precio_base ?? 0;
}

function estadoCuentaComoIngreso(estado: EstadoCita): boolean {
  return estado === "completada";
}

function estadoCuentaComoProyectado(estado: EstadoCita): boolean {
  return estado === "confirmada" || estado === "en_proceso";
}

/** Fecha local (America/Santiago) en formato YYYY-MM-DD. Agrupar por el día
    UTC correría las citas de la tarde al día siguiente. */
export function diaLocal(iso: string): string {
  return new Date(iso).toLocaleDateString("en-CA", { timeZone: "America/Santiago" });
}

/** División que no revienta con cero. */
function promedio(total: number, cantidad: number): number {
  return cantidad > 0 ? Math.round(total / cantidad) : 0;
}

export function calcularAnaliticas(filas: FilaSesion[]): Analiticas {
  const porEstado = Object.fromEntries(ESTADOS.map((e) => [e, 0])) as Record<EstadoCita, number>;

  let ingresosRealizados = 0;
  let ingresosProyectados = 0;
  let completadas = 0;

  const servicios = new Map<string, ResumenServicio>();
  const dias = new Map<string, PuntoDia>();
  const comunas = new Map<string, ResumenComuna>();

  let conCuenta = 0;
  let sinCuenta = 0;
  let conOferta = 0;
  let ingresoConCuenta = 0;
  let ingresoSinCuenta = 0;

  for (const fila of filas) {
    if (porEstado[fila.estado] !== undefined) porEstado[fila.estado] += 1;

    const precio = precioDeSesion(fila);

    if (estadoCuentaComoIngreso(fila.estado)) {
      ingresosRealizados += precio;
      completadas += 1;
    } else if (estadoCuentaComoProyectado(fila.estado)) {
      ingresosProyectados += precio;
    }

    /* El embudo cuenta TODAS las reservas, canceladas incluidas: una
       cancelación también es alguien que llegó por el embudo. Los ingresos
       de cada grupo, en cambio, solo cuentan lo completado, igual que el
       total general — si no, los dos números no serían comparables. */
    if (fila.cliente_id) {
      conCuenta += 1;
      if (estadoCuentaComoIngreso(fila.estado)) ingresoConCuenta += precio;
    } else {
      sinCuenta += 1;
      if (estadoCuentaComoIngreso(fila.estado)) ingresoSinCuenta += precio;
    }
    if (fila.oferta_id) conOferta += 1;

    // El ranking de servicios y la serie diaria ignoran las canceladas: una
    // cita que no ocurrió no dice nada sobre qué se pide ni cuánto entró.
    if (fila.estado === "cancelada") continue;

    const comuna = fila.contacto_comuna?.trim();
    if (comuna) {
      const acc = comunas.get(comuna) ?? { nombre: comuna, cantidad: 0, monto: 0 };
      comunas.set(comuna, {
        nombre: comuna,
        cantidad: acc.cantidad + 1,
        monto: acc.monto + precio,
      });
    }

    const nombre = fila.servicio?.trim() || "Sin servicio";
    const acumulado = servicios.get(nombre) ?? { nombre, cantidad: 0, monto: 0 };
    servicios.set(nombre, {
      nombre,
      cantidad: acumulado.cantidad + 1,
      monto: acumulado.monto + precio,
    });

    if (fila.fecha_cita) {
      const dia = diaLocal(fila.fecha_cita);
      const punto = dias.get(dia) ?? { fecha: dia, cantidad: 0, monto: 0 };
      dias.set(dia, { fecha: dia, cantidad: punto.cantidad + 1, monto: punto.monto + precio });
    }
  }

  return {
    total: filas.length,
    porEstado,
    ingresosRealizados,
    ingresosProyectados,
    ticketPromedio: completadas > 0 ? Math.round(ingresosRealizados / completadas) : 0,
    tasaCancelacion:
      filas.length > 0 ? Math.round((porEstado.cancelada / filas.length) * 100) : 0,
    servicios: [...servicios.values()].sort((a, b) => b.cantidad - a.cantidad),
    porDia: [...dias.values()].sort((a, b) => a.fecha.localeCompare(b.fecha)),
    embudo: {
      conCuenta,
      sinCuenta,
      pctConCuenta:
        filas.length > 0 ? Math.round((conCuenta / filas.length) * 100) : 0,
      conOferta,
      ingresoConCuenta,
      ingresoSinCuenta,
      // Se divide por las COMPLETADAS de cada grupo, no por el total del
      // grupo: si no, un grupo con muchas pendientes parecería más barato.
      ticketConCuenta: promedio(
        ingresoConCuenta,
        filas.filter((f) => f.cliente_id && estadoCuentaComoIngreso(f.estado)).length
      ),
      ticketSinCuenta: promedio(
        ingresoSinCuenta,
        filas.filter((f) => !f.cliente_id && estadoCuentaComoIngreso(f.estado)).length
      ),
    },
    comunas: [...comunas.values()].sort((a, b) => b.cantidad - a.cantidad),
  };
}

/* ── Rango de fechas ──────────────────────────────────────────
   Vive en la URL (?desde=&hasta=) para que un rango se pueda compartir o
   marcar, y para que recargar no pierda el filtro. */

export interface RangoFechas {
  desde: string;
  hasta: string;
}

const DIAS_POR_DEFECTO = 30;

function aISO(fecha: Date): string {
  return fecha.toLocaleDateString("en-CA", { timeZone: "America/Santiago" });
}

const FORMATO_FECHA = /^\d{4}-\d{2}-\d{2}$/;

/** Interpreta el rango pedido, con los últimos 30 días como defecto y una
    corrección silenciosa si vienen dados vuelta (pedir 'del 30 al 1' es un
    error de dedo, no una petición de cero resultados). */
export function resolverRango(desde?: string, hasta?: string): RangoFechas {
  const hoy = new Date();
  const inicioDefecto = new Date(hoy);
  inicioDefecto.setDate(hoy.getDate() - DIAS_POR_DEFECTO);

  const d = desde && FORMATO_FECHA.test(desde) ? desde : aISO(inicioDefecto);
  const h = hasta && FORMATO_FECHA.test(hasta) ? hasta : aISO(hoy);

  return d <= h ? { desde: d, hasta: h } : { desde: h, hasta: d };
}

/** Límites en instantes UTC para consultar `fecha_cita`. El cierre es el
    día siguiente a las 00:00 con `<`, para que el último día entre completo
    (con `<=` se perderían las citas después de medianoche del corte). */
export function limitesConsulta(rango: RangoFechas): { inicio: string; fin: string } {
  // Offset real de cada fecha (Chile cambia de hora dos veces al año); con
  // uno fijo, un rango que cruza el cambio se corre una hora.
  const inicio = new Date(`${rango.desde}T00:00:00${offsetNegocio(rango.desde)}`);
  const finExclusivo = new Date(`${rango.hasta}T00:00:00${offsetNegocio(rango.hasta)}`);
  finExclusivo.setDate(finExclusivo.getDate() + 1);
  return { inicio: inicio.toISOString(), fin: finExclusivo.toISOString() };
}
