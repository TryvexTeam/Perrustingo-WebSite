"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { crearClienteServicio } from "@/lib/supabase/servicio";
import { offsetNegocio } from "@/lib/agenda";
import { eliminarEventoCita, upsertEventoCita } from "@/lib/google/calendar";
import { BUCKET_FOTOS, rutaDeFoto } from "@/lib/fotosComun";
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
  const escritor = servicio ?? supabase;

  const { data: cita, error: errorLectura } = await lector
    .from("sesiones")
    .select("estado, fecha_cita, fecha_fin, servicio, contacto_nombre, contacto_telefono, contacto_email, detalle_form")
    .eq("id", citaId)
    .single();

  if (!cita) {
    /* El fallo era mudo: se descartaba el error de Postgres y se decía "no
       encontrada", que tapa causas muy distintas — id inexistente, permiso
       denegado o credencial de servidor ausente. Se registra para poder
       distinguirlas; fue lo que destapó que a `service_role` le faltaba el
       GRANT sobre `sesiones` (migración 028). */
    console.error("[cambiarEstadoCita] no se pudo leer la cita", {
      citaId,
      rol: perfil.rol,
      conClienteDeServicio: Boolean(servicio),
      codigo: errorLectura?.code ?? null,
      /* El `code` solo viene en errores de PostgREST. Una credencial inválida
         la rechaza el gateway antes, con un cuerpo que no trae `code` — y sin
         el mensaje el fallo se veía idéntico a "la fila no existe". */
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

  /* La escritura va por el mismo camino que la lectura, y por la misma
     razón (migración 029): para MODIFICAR una fila Postgres primero tiene
     que ENCONTRARLA, y esa búsqueda usa las políticas de lectura. Como el
     peluquero ya no puede leer `sesiones`, su UPDATE no encontraba nada y
     se ejecutaba sin error sobre cero filas — el panel decía "listo" y la
     cita quedaba igual.

     El control no se pierde: arriba se verificó el rol del equipo y que la
     transición de estado sea válida. */
  const { data: tocadas, error } = await escritor
    .from("sesiones")
    .update(cambios)
    .eq("id", citaId)
    /* `.select()` para saber si la fila se tocó de verdad. Un UPDATE que no
       afecta nada no falla, y sin esto volveríamos a prometer un cambio que
       no ocurrió — que fue justamente el síntoma reportado. */
    .select("id");

  if (error) return { success: false, error: "No se pudo actualizar." };

  if (!tocadas || tocadas.length === 0) {
    console.error("[cambiarEstadoCita] el UPDATE no toco ninguna fila", {
      citaId,
      rol: perfil.rol,
      estadoPrevio: cita.estado,
      estadoPedido: nuevoEstado,
      conClienteDeServicio: Boolean(servicio),
    });
    return {
      success: false,
      error: "La base de datos rechazó el cambio. Avise al equipo técnico.",
    };
  }

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

  /* Mismo caso que `cambiarEstadoCita`: sin lectura sobre `sesiones`, el
     UPDATE del peluquero no encuentra la fila y se pierde en silencio.
     La nota se guardaría "con éxito" y no quedaría escrita. */
  const { data: tocadas, error } = await (crearClienteServicio() ?? supabase)
    .from("sesiones")
    .update({ notas_equipo: notas.trim() || null, updated_at: new Date().toISOString() })
    .eq("id", citaId)
    .select("id");

  if (error) return { success: false, error: "No se pudo guardar la nota." };
  if (!tocadas || tocadas.length === 0) {
    return { success: false, error: "La base de datos rechazó el cambio. Avise al equipo técnico." };
  }

  revalidatePath("/dashboard/citas");
  return { success: true };
}

/* ── Borrado de citas (pedido del señor Adley, 30-jul) ──────────

   Hasta hoy las citas nunca se borraban — solo cambiaban de estado. Eso
   protege el historial, pero dejó las citas de prueba del equipo mezcladas
   con las reales, sin forma de limpiarlas desde el panel. */

interface ResultadoBorrado {
  success: boolean;
  /** Cuántas se borraron de verdad (no cuántas se pidieron). */
  eliminadas: number;
  error?: string;
}

const MAXIMO_BORRADO_POR_TANDA = 50;

/** Borra citas definitivamente. Solo admin, y SOLO canceladas o completadas:
    una pendiente o confirmada es una promesa activa con un cliente — para
    borrarla primero hay que cancelarla, mirándola, una por una. Ese paso
    extra es el candado contra borrar una solicitud real por accidente. */
export async function eliminarCitasEnBloque(citaIds: string[]): Promise<ResultadoBorrado> {
  if (citaIds.length === 0) {
    return { success: false, eliminadas: 0, error: "No seleccionó ninguna cita." };
  }
  if (citaIds.length > MAXIMO_BORRADO_POR_TANDA) {
    return {
      success: false,
      eliminadas: 0,
      error: `Son demasiadas de una vez (máximo ${MAXIMO_BORRADO_POR_TANDA}). Hágalo por tandas.`,
    };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, eliminadas: 0, error: "Sesión expirada." };

  /* Solo admin, ni siquiera trabajador: borrar es un grado más que cancelar,
     y la política `admin_maneja_sesiones` (FOR ALL) es la que respalda este
     DELETE en la base. */
  const { data: perfil } = await supabase
    .from("perfiles")
    .select("rol")
    .eq("id", user.id)
    .single();
  if (perfil?.rol !== "admin") {
    return { success: false, eliminadas: 0, error: "Solo un administrador puede borrar citas." };
  }

  /* Las rutas de las fotos se leen ANTES de borrar: el CASCADE va a
     llevarse las filas de `fotos_sesion`, y sin esta lectura previa los
     archivos quedarían huérfanos en Storage para siempre. Se usa el cliente
     de servicio porque es quien puede tocar el bucket privado. */
  const servicio = crearClienteServicio();
  let fotosPorCita: { sesion_id: string; ruta: string | null; url: string | null }[] = [];
  if (servicio) {
    const { data } = await servicio
      .from("fotos_sesion")
      .select("sesion_id, ruta, url")
      .in("sesion_id", citaIds);
    fotosPorCita = data ?? [];
  }

  const { data: borradas, error } = await supabase
    .from("sesiones")
    .delete()
    .in("id", citaIds)
    .in("estado", ["cancelada", "completada"])
    .select("id");

  if (error) {
    return { success: false, eliminadas: 0, error: "No se pudo borrar." };
  }

  const eliminadas = borradas?.length ?? 0;
  const idsBorrados = new Set((borradas ?? []).map((f) => f.id));

  /* Limpieza que NUNCA bloquea: las filas ya no existen, así que un fallo
     acá se registra y se sigue — igual que el espejo del calendario. */
  if (servicio) {
    const rutas = fotosPorCita
      .filter((f) => idsBorrados.has(f.sesion_id))
      .map((f) => rutaDeFoto(f))
      .filter((r): r is string => Boolean(r));
    if (rutas.length > 0) {
      const { error: errorStorage } = await servicio.storage.from(BUCKET_FOTOS).remove(rutas);
      if (errorStorage) {
        console.warn("[eliminarCitas] fotos sin borrar en Storage:", errorStorage.message);
      }
    }
  }
  for (const fila of borradas ?? []) {
    try {
      await eliminarEventoCita(fila.id);
    } catch (e) {
      console.warn("[google-calendar] no se pudo borrar el evento:", e);
    }
  }

  revalidatePath("/dashboard/citas");
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/hoy");
  revalidatePath("/agenda");

  if (eliminadas < citaIds.length) {
    return {
      success: true,
      eliminadas,
      error: `Se borraron ${eliminadas} de ${citaIds.length}. Las otras siguen activas (pendiente o confirmada): cancélelas primero.`,
    };
  }
  return { success: true, eliminadas };
}
