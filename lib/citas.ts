import { z } from "zod";

/* Dominio de citas — compartido por el form público, la agenda y el dashboard. */

export type EstadoCita =
  | "pendiente"
  | "confirmada"
  | "en_proceso"
  | "completada"
  | "cancelada";

export const ESTADO_LABEL: Record<EstadoCita, string> = {
  pendiente: "Pendiente",
  confirmada: "Confirmada",
  en_proceso: "En proceso",
  completada: "Completada",
  cancelada: "Cancelada",
};

export const ESTADO_COLOR: Record<EstadoCita, string> = {
  pendiente: "bg-yellow-100 text-yellow-800",
  confirmada: "bg-blue-100 text-blue-800",
  en_proceso: "bg-purple-100 text-purple-800",
  completada: "bg-green-100 text-green-800",
  cancelada: "bg-red-100 text-red-800",
};

/** Payload que envía el formulario público de reserva. */
export const solicitudCitaSchema = z.object({
  contacto: z.object({
    nombre: z.string().trim().min(2).max(80),
    email: z.string().trim().email().max(120),
    telefono: z
      .string()
      .trim()
      .regex(/^\+?[\d\s]{8,15}$/, "Teléfono inválido"),
  }),
  fechaDeseada: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  servicio: z.string().trim().min(3).max(80),
  precioEstimado: z.number().int().min(0).max(500000).nullable(),
  /** Snapshot completo del formulario (perro, salud, temperamento). */
  detalle: z.record(z.string(), z.string()),
  /** Honeypot anti-spam: los humanos lo dejan vacío. */
  apellidoPaterno: z.string().max(0).optional(),
});

export type SolicitudCita = z.infer<typeof solicitudCitaSchema>;

/** Fila de sesión tal como la consume la UI del equipo. */
export interface SesionEquipo {
  id: string;
  estado: EstadoCita;
  fecha_cita: string | null;
  fecha_fin: string | null;
  servicio: string | null;
  precio_base: number | null;
  precio_final: number | null;
  contacto_nombre: string | null;
  contacto_email: string | null;
  contacto_telefono: string | null;
  detalle_form: Record<string, string> | null;
  notas_cliente: string | null;
}

/** Bloque anónimo de la agenda pública (vista agenda_ocupada). */
export interface BloqueOcupado {
  id: string;
  fecha_cita: string;
  fecha_fin: string | null;
  servicio: string | null;
  estado: EstadoCita;
}

export function supabaseConfigurado(): boolean {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  return Boolean(url && !url.includes("TU_PROYECTO"));
}
