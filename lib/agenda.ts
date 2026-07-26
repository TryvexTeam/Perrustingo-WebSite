/* Agenda — tipos del calendario semanal. Con Supabase configurado las citas
   salen de `sesiones` / `agenda_ocupada`; sin configurar se usa CITAS_DEMO. */

import type { EstadoCita, SesionEquipo } from "@/lib/citas";

export interface CitaAgenda {
  id: string;
  titulo: string;
  perro: string;
  servicio: string;
  /** Offset de días respecto al lunes de la semana actual (0 = lunes) */
  diaSemana: number;
  horaInicio: number; // hora decimal, ej 10.5 = 10:30
  duracionHoras: number;
  color: keyof typeof COLORES_CITA;
}

export const COLORES_CITA = {
  bano: { bg: "bg-[#bcdcf6]", border: "border-[#54aede]", text: "text-[#155a86]", dot: "bg-[#54aede]", label: "Baño completo" },
  corte: { bg: "bg-[#f7c6da]", border: "border-[#e0679a]", text: "text-[#8f2f5c]", dot: "bg-[#e0679a]", label: "Baño + corte" },
  spa: { bg: "bg-[#d3c3f0]", border: "border-[#9a76d6]", text: "text-[#553488]", dot: "bg-[#9a76d6]", label: "Spa completo" },
  unas: { bg: "bg-[#fbd3a4]", border: "border-[#e8963c]", text: "text-[#8a5312]", dot: "bg-[#e8963c]", label: "Solo uñas" },
  retiro: { bg: "bg-[#b8e4cd]", border: "border-[#4daf7c]", text: "text-[#1e5c3d]", dot: "bg-[#4daf7c]", label: "Retiro y entrega" },
} as const;

export const HORA_APERTURA = 9;
export const HORA_CIERRE = 19;

/** Días atendidos: lunes (0) a sábado (5) */
export const DIAS_SEMANA = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"] as const;

export const CITAS_DEMO: CitaAgenda[] = [
  { id: "c1", titulo: "Luna", perro: "Poodle Toy", servicio: "Baño + corte de pelo", diaSemana: 0, horaInicio: 10, duracionHoras: 1.5, color: "corte" },
  { id: "c2", titulo: "Rocky", perro: "Labrador", servicio: "Baño completo", diaSemana: 0, horaInicio: 12, duracionHoras: 2, color: "bano" },
  { id: "c3", titulo: "Milo", perro: "Shih Tzu", servicio: "Spa completo", diaSemana: 1, horaInicio: 9.5, duracionHoras: 2, color: "spa" },
  { id: "c4", titulo: "Kira", perro: "Samoyedo", servicio: "Baño + corte de pelo", diaSemana: 1, horaInicio: 14, duracionHoras: 3, color: "corte" },
  { id: "c5", titulo: "Toby", perro: "Beagle", servicio: "Solo uñas", diaSemana: 2, horaInicio: 11, duracionHoras: 0.5, color: "unas" },
  { id: "c6", titulo: "Nala", perro: "Golden Retriever", servicio: "Baño completo", diaSemana: 2, horaInicio: 15, duracionHoras: 2, color: "bano" },
  { id: "c7", titulo: "Simón", perro: "Quiltro", servicio: "Baño + corte de pelo", diaSemana: 3, horaInicio: 10, duracionHoras: 2, color: "corte" },
  { id: "c8", titulo: "Coco", perro: "Bulldog Francés", servicio: "Retiro y entrega", diaSemana: 3, horaInicio: 16, duracionHoras: 1, color: "retiro" },
  { id: "c9", titulo: "Greta", perro: "Dachshund", servicio: "Spa completo", diaSemana: 4, horaInicio: 9, duracionHoras: 1.5, color: "spa" },
  { id: "c10", titulo: "Bruno", perro: "Pastor Alemán", servicio: "Baño completo", diaSemana: 4, horaInicio: 12.5, duracionHoras: 2.5, color: "bano" },
  { id: "c11", titulo: "Pelusa", perro: "Bichón Frisé", servicio: "Baño + corte de pelo", diaSemana: 5, horaInicio: 10, duracionHoras: 1.5, color: "corte" },
  { id: "c12", titulo: "Max", perro: "Terrier Chileno", servicio: "Solo uñas", diaSemana: 5, horaInicio: 13, duracionHoras: 0.5, color: "unas" },
];

/** Lunes de la semana que contiene `fecha` */
export function lunesDe(fecha: Date): Date {
  const d = new Date(fecha);
  const dia = d.getDay(); // 0 = domingo
  const diff = dia === 0 ? -6 : 1 - dia;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function formatearHora(h: number): string {
  const horas = Math.floor(h);
  const minutos = Math.round((h - horas) * 60);
  return `${horas}:${minutos.toString().padStart(2, "0")}`;
}

export function fechaISO(d: Date): string {
  return `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, "0")}-${d
    .getDate()
    .toString()
    .padStart(2, "0")}`;
}

/* ── Zona horaria del negocio ─────────────────────────────── */

/* Perrustingo opera en Chile. Las horas de `fecha_cita` deben leerse y
   escribirse SIEMPRE en esta zona: el servidor (Vercel) corre en UTC, así
   que usar Date#getHours() directo desplaza toda la agenda +3/+4 horas y
   hace que los borradores del formulario (medianoche -04:00 = 04:00 UTC)
   parezcan citas con hora asignada. */
export const TZ_NEGOCIO = "America/Santiago";

const FMT_ZONA = new Intl.DateTimeFormat("en-CA", {
  timeZone: TZ_NEGOCIO,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

/** Fecha (yyyy-mm-dd) y hora del instante `d` vistos desde Chile. */
export function partesEnZona(d: Date): { fecha: string; hora: number; minuto: number } {
  const p: Record<string, string> = {};
  for (const parte of FMT_ZONA.formatToParts(d)) p[parte.type] = parte.value;
  return {
    fecha: `${p.year}-${p.month}-${p.day}`,
    hora: Number(p.hour),
    minuto: Number(p.minute),
  };
}

/** Offset UTC vigente en Chile para esa fecha ("-04:00" o "-03:00" según DST).
    Chile cambia de hora dos veces al año: fijar "-04:00" a mano corre las
    citas una hora entre septiembre y abril. */
export function offsetNegocio(fechaYmd: string): string {
  // Referencia a mediodía UTC: lejos del cambio de hora local (siempre madrugada).
  const ref = new Date(`${fechaYmd}T12:00:00Z`);
  const p = partesEnZona(ref);
  const diff = p.hora * 60 + p.minuto - 12 * 60;
  const signo = diff < 0 ? "-" : "+";
  const abs = Math.abs(diff);
  return `${signo}${String(Math.floor(abs / 60)).padStart(2, "0")}:${String(abs % 60).padStart(2, "0")}`;
}

/** "2026-07-16" → "mié 16 jul" (para chips y listas del equipo). */
export function formatearFechaCorta(fechaYmd: string): string {
  const d = new Date(`${fechaYmd}T12:00:00Z`);
  return new Intl.DateTimeFormat("es-CL", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  }).format(d);
}

/* ── Citas reales (Supabase) ──────────────────────────────── */

/** Cita renderizable en el grid semanal, ya resuelta a fecha concreta. */
export interface CitaSemana {
  id: string;
  /** yyyy-mm-dd local */
  fecha: string;
  horaInicio: number;
  duracionHoras: number;
  titulo: string;
  subtitulo: string;
  color: keyof typeof COLORES_CITA;
  estado: EstadoCita;
  /** Solo presente en modo equipo. */
  sesion?: SesionEquipo;
}

export const DURACION_DEFECTO_HORAS = 1.5;

export function colorPorServicio(servicio: string | null): keyof typeof COLORES_CITA {
  const s = (servicio ?? "").toLowerCase();
  if (s.includes("spa")) return "spa";
  if (s.includes("uñas") || s.includes("unas")) return "unas";
  if (s.includes("retiro") || s.includes("entrega")) return "retiro";
  if (s.includes("corte")) return "corte";
  return "bano";
}

/** Una solicitud creada desde el form trae solo fecha (medianoche en Chile) —
    sin hora asignada. Se evalúa en TZ_NEGOCIO, no en la del servidor.
    Nota: desde la Fase 5 el cliente elige un bloque horario, así que las
    reservas nuevas SÍ traen hora; esto sigue cubriendo las antiguas. */
export function tieneHoraAsignada(fechaCita: string): boolean {
  const p = partesEnZona(new Date(fechaCita));
  return p.hora !== 0 || p.minuto !== 0;
}

interface FilaAgendable {
  id: string;
  fecha_cita: string | null;
  fecha_fin: string | null;
  servicio: string | null;
  estado: EstadoCita;
}

/** Convierte filas de `sesiones`/`agenda_ocupada` en citas del grid. */
export function filaACitaSemana(
  fila: FilaAgendable,
  opts: { titulo: string; subtitulo?: string; sesion?: SesionEquipo }
): CitaSemana | null {
  if (!fila.fecha_cita) return null;
  const inicio = new Date(fila.fecha_cita);
  // Hora vista desde Chile: en el servidor (UTC) `getHours()` correría toda
  // la agenda 3 o 4 horas.
  const enZona = partesEnZona(inicio);
  const horaInicio = enZona.hora + enZona.minuto / 60;
  const duracionHoras = fila.fecha_fin
    ? Math.max(0.5, (new Date(fila.fecha_fin).getTime() - inicio.getTime()) / 3_600_000)
    : DURACION_DEFECTO_HORAS;

  return {
    id: fila.id,
    fecha: enZona.fecha,
    horaInicio,
    duracionHoras,
    titulo: opts.titulo,
    subtitulo: opts.subtitulo ?? fila.servicio ?? "",
    color: colorPorServicio(fila.servicio),
    estado: fila.estado,
    sesion: opts.sesion,
  };
}

/** CITAS_DEMO ancladas a la semana actual, como CitaSemana. */
export function demoComoCitasSemana(hoy: Date): CitaSemana[] {
  const lunes = lunesDe(hoy);
  return CITAS_DEMO.map((c) => {
    const fecha = new Date(lunes);
    fecha.setDate(lunes.getDate() + c.diaSemana);
    return {
      id: c.id,
      fecha: fechaISO(fecha),
      horaInicio: c.horaInicio,
      duracionHoras: c.duracionHoras,
      titulo: c.titulo,
      subtitulo: c.servicio,
      color: c.color,
      estado: "confirmada" as EstadoCita,
    };
  });
}
