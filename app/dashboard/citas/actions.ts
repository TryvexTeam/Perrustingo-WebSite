"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { crearClienteServicio } from "@/lib/supabase/servicio";
import { offsetNegocio } from "@/lib/agenda";
import { eliminarEventoCita, upsertEventoCita } from "@/lib/google/calendar";
import type { EstadoCita } from "@/lib/citas";

const TRANSICIONES_EQUIPO: Record<string, EstadoCita[]> = {
  pendiente: ["confirmada", "cancelada"],
  confirmada: ["en_proceso", "cancelada"],
  en_proceso: ["completada", "cancelada"],
};

interface ResultadoAccion {
  success: boolean;
  error?: string;
}

interface OpcionesHorario {
  /** yyyy-mm-ddThh:mm:ss en hora de Chile — al confirmar, fija la hora real de la cita. */
  fechaCita?: string;
  duracionHoras?: number;
}

/** Cambia el estado de una cita. Solo equipo (admin/trabajador); RLS refuerza. */
export async function cambiarEstadoCita(
  citaId: string,
  nuevoEstado: EstadoCita,
  horario?: OpcionesHorario
): Promise<ResultadoAccion> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Sesión expirada." };

  const { data: perfil } = await supabase
    .from("perfiles")
    .select("rol")
    .eq("id", user.id)
    .single();
  if (!perfil || !["admin", "trabajador"].includes(perfil.rol)) {
    return { success: false, error: "Sin permisos." };
  }

  /* Esta lectura va por el cliente de servicio, no por la sesión de quien
     aprieta el botón.

     Desde la migración 027 el rol 'trabajador' ya no puede leer `sesiones`:
     con su sesión, esta consulta vuelve vacía y el panel respondía "Cita no
     encontrada" al confirmar. Y la vista `sesiones_equipo` tampoco sirve
     acá, porque le entrega el contacto en NULL y estos datos alimentan el
     evento de Google Calendar, que es del negocio y sí los lleva.

     No hay filtración: lo leído se usa para validar la transición y para
     armar el evento del calendario. Nada de esto vuelve al navegador — la
     acción solo devuelve `success` o un mensaje de error.

     El permiso ya se comprobó arriba: sin rol de equipo no se llega hasta
     acá. */
  const servicio = crearClienteServicio();
  const lector = servicio ?? supabase;

  const { data: cita, error: errorLectura } = await lector
    .from("sesiones")
    .select("estado, fecha_cita, fecha_fin, servicio, contacto_nombre, contacto_telefono, contacto_email, detalle_form")
    .eq("id", citaId)
    .single();

  if (!cita) {
    /* Este fallo era mudo: se descartaba el error de Postgres y solo se
       decía "no encontrada", que puede ser cualquier cosa — id inexistente,
       permiso denegado o credencial de servidor ausente. Se registra el
       diagnóstico para poder distinguirlos desde los logs. */
    console.error("[cambiarEstadoCita] no se pudo leer la cita", {
      citaId,
      rol: perfil.rol,
      conClienteDeServicio: Boolean(servicio),
      codigo: errorLectura?.code ?? null,
      mensaje: errorLectura?.message ?? null,
    });
    return { success: false, error: "Cita no encontrada." };
  }

  const permitidas = TRANSICIONES_EQUIPO[cita.estado] ?? [];
  if (!permitidas.includes(nuevoEstado)) {
    return { success: false, error: `No se puede pasar de ${cita.estado} a ${nuevoEstado}.` };
  }

  const cambios: Record<string, unknown> = {
    estado: nuevoEstado,
    updated_at: new Date().toISOString(),
  };
  if (horario?.fechaCita) {
    // El panel envía hora de Chile sin offset; se ancla a la zona del negocio
    // para que el instante guardado sea correcto aunque el servidor corra en
    // UTC — y con el offset real de esa fecha (Chile cambia de hora dos veces
    // al año, así que "-04:00" fijo correría las citas del verano).
    const inicio = new Date(`${horario.fechaCita}${offsetNegocio(horario.fechaCita.slice(0, 10))}`);
    if (isNaN(inicio.getTime())) return { success: false, error: "Horario inválido." };
    cambios.fecha_cita = inicio.toISOString();
    const duracion = horario.duracionHoras ?? 1.5;
    cambios.fecha_fin = new Date(inicio.getTime() + duracion * 3_600_000).toISOString();
  }

  const { error } = await supabase
    .from("sesiones")
    .update(cambios)
    .eq("id", citaId);

  if (error) return { success: false, error: "No se pudo actualizar." };

  /* Espejo en Google Calendar. El respaldo NUNCA bloquea al panel: la cita ya
     quedó guardada en la base, así que un fallo de Google se registra y se
     sigue. Si faltan las envs, las funciones son no-op silencioso.

     Desde la Fase 5 la cita ya nace con hora (el cliente elige un bloque), así
     que al confirmar sin pasar `horario` se usa la que ya tenía — antes, sin
     `cambios.fecha_cita`, no se espejaba nada. */
  try {
    if (nuevoEstado === "cancelada") {
      await eliminarEventoCita(citaId);
    } else if (nuevoEstado === "confirmada") {
      const inicioISO = (cambios.fecha_cita as string | undefined) ?? cita.fecha_cita ?? null;
      const finISO =
        (cambios.fecha_fin as string | undefined) ??
        cita.fecha_fin ??
        (inicioISO ? new Date(new Date(inicioISO).getTime() + 1.5 * 3_600_000).toISOString() : null);

      if (inicioISO && finISO) {
        const detalle = cita.detalle_form as Record<string, string> | null;
        const perro = detalle?.nombrePerro ?? detalle?.Nombre ?? cita.contacto_nombre ?? "Cita";
        await upsertEventoCita({
          citaId,
          titulo: `🐾 ${perro} — ${cita.servicio ?? "Perrustingo"}`,
          descripcion: [
            cita.contacto_nombre && `Contacto: ${cita.contacto_nombre}`,
            cita.contacto_telefono && `Teléfono: ${cita.contacto_telefono}`,
            cita.contacto_email && `Email: ${cita.contacto_email}`,
            "Origen: plataforma Perrustingo",
          ]
            .filter(Boolean)
            .join("\n"),
          inicioISO,
          finISO,
        });
      }
    }
  } catch (e) {
    console.warn("[google-calendar] respaldo falló:", e);
  }

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/citas");
  revalidatePath("/agenda");
  return { success: true };
}

/** Notas del peluquero sobre la cita (pedido de Rodolfo 19-jul): detalles
    del servicio y tips entre colegas — se ven en la próxima visita. */
export async function guardarNotasEquipo(
  citaId: string,
  notas: string
): Promise<ResultadoAccion> {
  if (notas.length > 2000) return { success: false, error: "Nota demasiado larga." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Sesión expirada." };

  const { data: perfil } = await supabase
    .from("perfiles")
    .select("rol")
    .eq("id", user.id)
    .single();
  if (!perfil || !["admin", "trabajador"].includes(perfil.rol)) {
    return { success: false, error: "Sin permisos." };
  }

  const { error } = await supabase
    .from("sesiones")
    .update({ notas_equipo: notas.trim() || null, updated_at: new Date().toISOString() })
    .eq("id", citaId);

  if (error) return { success: false, error: "No se pudo guardar la nota." };

  revalidatePath("/dashboard/citas");
  return { success: true };
}
