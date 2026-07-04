/* Agenda — datos mock del flujo FE. Cuando exista Supabase, estas citas
   saldrán de la tabla `sesiones`; la UI del calendario no cambia. */

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
