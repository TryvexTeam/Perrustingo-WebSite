import { partesEnZona } from "./agenda";
import type { EstadoCita } from "./citas";

/* La jornada del local: las citas del día en orden, con los huecos a la
   vista (PRP-004, extra). Cálculo puro — lo que se muestra en pantalla se
   arma acá, así se puede verificar sin navegador.

   Existe porque el equipo no necesita "todas las citas" ni "la semana":
   necesita saber qué viene ahora, con qué perrito y si hay que tener
   cuidado. */

export interface FilaJornada {
  id: string;
  estado: EstadoCita;
  fecha_cita: string | null;
  servicio: string | null;
  precio_base: number | null;
  precio_final: number | null;
  contacto_nombre: string | null;
  contacto_telefono: string | null;
  detalle_form: Record<string, string> | null;
  notas_equipo?: string | null;
}

export interface CitaJornada {
  id: string;
  /** "09:00" en hora de Chile. */
  hora: string;
  minutos: number;
  estado: EstadoCita;
  perro: string;
  /** "Poodle Toy · 4 kg" — lo que el equipo necesita de un vistazo. */
  detallePerro: string;
  servicio: string;
  precio: number;
  cliente: string;
  telefono: string | null;
  /** Avisos que importan ANTES de tocar al animal. */
  alertas: string[];
  notasEquipo: string | null;
}

export interface Hueco {
  hora: string;
  minutos: number;
}

export type ItemJornada =
  | ({ tipo: "cita" } & CitaJornada)
  | ({ tipo: "hueco" } & Hueco);

export interface Jornada {
  items: ItemJornada[];
  citas: number;
  /** Lo que se espera facturar hoy (sin las canceladas). */
  total: number;
  /** Cuántas siguen sin confirmar: es lo que el equipo debe resolver. */
  pendientes: number;
  completadas: number;
}

function hhmm(minutos: number): string {
  return `${String(Math.floor(minutos / 60)).padStart(2, "0")}:${String(minutos % 60).padStart(2, "0")}`;
}

/* Un perro que no se deja tocar es información de seguridad, no un detalle
   de la ficha: el equipo tiene que saberlo ANTES de agarrarlo, no después
   de un mordisco. Por eso las alertas van arriba y en color. */
function alertasDe(detalle: Record<string, string> | null): string[] {
  if (!detalle) return [];
  const avisos: string[] = [];

  const temperamento = detalle.temperamento?.trim();
  if (temperamento && /no se deja|complicado|bravo/i.test(temperamento)) {
    avisos.push(temperamento);
  }

  const zonas = detalle.noSeDejaCon?.trim();
  if (zonas) avisos.push(`No se deja: ${zonas}`);

  const salud = detalle.salud?.trim();
  if (salud) avisos.push(salud);

  return avisos;
}

function detallePerroDe(detalle: Record<string, string> | null): string {
  if (!detalle) return "";
  return [detalle.raza, detalle.pesoKg ? `${detalle.pesoKg} kg` : "", detalle.tipoPelo]
    .filter((v) => v && v.trim().length > 0)
    .join(" · ");
}

/** Arma la jornada: las citas del día ordenadas, y los bloques del local
    que quedaron sin vender intercalados en su lugar. */
export function construirJornada(
  filas: FilaJornada[],
  bloquesDelLocal: number[]
): Jornada {
  const citas: CitaJornada[] = filas
    .filter((f) => f.fecha_cita)
    .map((f) => {
      const p = partesEnZona(new Date(f.fecha_cita!));
      const minutos = p.hora * 60 + p.minuto;
      const detalle = f.detalle_form;
      return {
        id: f.id,
        hora: hhmm(minutos),
        minutos,
        estado: f.estado,
        perro: detalle?.nombrePerro?.trim() || "Sin nombre",
        detallePerro: detallePerroDe(detalle),
        servicio: f.servicio ?? "",
        precio: f.precio_final ?? f.precio_base ?? 0,
        cliente: f.contacto_nombre ?? "",
        telefono: f.contacto_telefono,
        alertas: alertasDe(detalle),
        notasEquipo: f.notas_equipo ?? null,
      };
    })
    .sort((a, b) => a.minutos - b.minutos);

  const ocupados = new Set(citas.map((c) => c.minutos));
  const huecos: Hueco[] = bloquesDelLocal
    .filter((m) => !ocupados.has(m))
    .map((m) => ({ hora: hhmm(m), minutos: m }));

  const items: ItemJornada[] = [
    ...citas.map((c) => ({ tipo: "cita" as const, ...c })),
    ...huecos.map((h) => ({ tipo: "hueco" as const, ...h })),
  ].sort((a, b) => a.minutos - b.minutos);

  return {
    items,
    citas: citas.length,
    // Las canceladas no se esperan cobrar; mostrarlas en el total del día
    // haría que el equipo cuadre caja contra una cifra que no existe.
    total: citas
      .filter((c) => c.estado !== "cancelada")
      .reduce((acc, c) => acc + c.precio, 0),
    pendientes: citas.filter((c) => c.estado === "pendiente").length,
    completadas: citas.filter((c) => c.estado === "completada").length,
  };
}

/** Mensaje de WhatsApp listo para el cliente de esa cita. */
export function mensajeRecordatorio(cita: CitaJornada, esHoy: boolean): string {
  const cuando = esHoy ? `hoy a las ${cita.hora}` : `a las ${cita.hora}`;
  const nombre = cita.cliente.split(" ")[0] || "";
  return (
    `Hola ${nombre}! 🐾 Le escribimos de Perrustingo para confirmar la cita de ` +
    `${cita.perro} ${cuando}${cita.servicio ? ` (${cita.servicio})` : ""}. ` +
    `¿Nos confirma que viene?`
  );
}

/** Enlace de WhatsApp con el mensaje ya escrito. */
export function enlaceWhatsApp(telefono: string, mensaje: string): string {
  const numero = telefono.replace(/\D/g, "");
  return `https://wa.me/${numero}?text=${encodeURIComponent(mensaje)}`;
}
