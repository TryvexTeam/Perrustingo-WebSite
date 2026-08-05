"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { validarHorario, type TramoPeluquero } from "@/lib/horarios";

/* Guardar el horario de una persona. Solo admin: el horario define cuánta
   capacidad ve el cliente, así que si cada uno editara el suyo cualquiera
   podría cerrarse la agenda —o abrirse horas que nadie acordó— sin que el
   dueño se entere. La policy de la 039 dice lo mismo; acá se comprueba antes
   para poder responder con un mensaje y no con un 42501. */

interface ResultadoAccion {
  success: boolean;
  error?: string;
  problemas?: string[];
}

async function exigirAdmin(): Promise<
  { supabase: Awaited<ReturnType<typeof createClient>> } | { error: string }
> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Sesión expirada." };

  const { data: perfil } = await supabase
    .from("perfiles")
    .select("rol")
    .eq("id", user.id)
    .single();
  if (perfil?.rol !== "admin") {
    return { error: "Solo un administrador puede cambiar los horarios del equipo." };
  }
  return { supabase };
}

/**
 * Reemplaza el horario completo de una persona.
 *
 * Se borra y se vuelve a escribir en vez de ir fila por fila: el panel manda
 * la semana entera, y hacer un diff de tramos —cuál se movió, cuál se partió
 * en dos por una colación nueva— es exactamente donde se cuela el bug que deja
 * un tramo huérfano ocupando capacidad que ya nadie trabaja.
 *
 * El borrado va PRIMERO y el insert después, en la misma llamada. Si el insert
 * falla, la persona queda sin tramos — y sin tramos cuenta como que trabaja
 * todo el horario del local, que es el estado de antes de configurar nada. O
 * sea: el peor caso deja la agenda MÁS abierta, no cerrada. Al revés —fallar
 * dejando a alguien sin horas— haría desaparecer cupos reales sin aviso.
 */
export async function guardarHorarioAction(
  peluqueroId: string,
  tramos: TramoPeluquero[]
): Promise<ResultadoAccion> {
  const sesion = await exigirAdmin();
  if ("error" in sesion) return { success: false, error: sesion.error };

  if (!peluqueroId) return { success: false, error: "Falta indicar de quién es el horario." };

  /* La misma validación que corre el panel. Se repite acá porque el navegador
     no es fuente confiable: una petición armada a mano se saltaría la
     pantalla, y un tramo al revés o pisado desordena la capacidad de todos. */
  const problemas = validarHorario(tramos);
  if (problemas.length > 0) return { success: false, problemas };

  /* Que sea peluquero de verdad. Guardarle horario a quien no atiende citas
     no rompe nada hoy, pero deja filas que la función agregada ignora y que
     nadie entiende de dónde salieron al revisar la tabla. */
  const { data: destino } = await sesion.supabase
    .from("perfiles")
    .select("id, es_peluquero")
    .eq("id", peluqueroId)
    .single();

  if (!destino) return { success: false, error: "No se encontró a esa persona." };
  if (!destino.es_peluquero) {
    return {
      success: false,
      error: "Esa persona no está marcada como que atiende citas. Márquela en Usuarios primero.",
    };
  }

  const { error: errorBorrado } = await sesion.supabase
    .from("horarios_peluquero")
    .delete()
    .eq("peluquero_id", peluqueroId);

  if (errorBorrado) {
    return { success: false, error: explicarFallo(errorBorrado.code, "No se pudo guardar el horario.") };
  }

  if (tramos.length > 0) {
    const { error: errorInsert } = await sesion.supabase.from("horarios_peluquero").insert(
      tramos.map((t) => ({
        peluquero_id: peluqueroId,
        dia_semana: t.diaSemana,
        hora_inicio: t.horaInicio,
        hora_fin: t.horaFin,
        activo: t.activo,
      }))
    );

    if (errorInsert) {
      return {
        success: false,
        error: explicarFallo(errorInsert.code, "No se pudo guardar el horario."),
      };
    }
  }

  /* La agenda pública y el panel leen esta capacidad. Sin revalidar, Rodolfo
     cambia el horario y sigue viendo los cupos viejos, sin saber si guardó. */
  revalidatePath("/dashboard/horarios");
  revalidatePath("/dashboard/disponibilidad");
  revalidatePath("/agenda");
  revalidatePath("/reserva");
  return { success: true };
}

/** Traduce los errores de Postgres que este formulario puede provocar. El
    42501 se nombra con todas sus letras: en este proyecto una policy sobre una
    tabla sin GRANT ya se disfrazó cinco veces de "no se pudo guardar". */
function explicarFallo(code: string | undefined, porDefecto: string): string {
  if (code === "42P01") {
    return "Falta aplicar la migración 039 en la base de datos.";
  }
  if (code === "42501") {
    return "La base de datos rechazó el cambio por permisos (42501): falta el GRANT sobre `horarios_peluquero`. Avise al equipo técnico.";
  }
  if (code === "23514") {
    return "Hay un horario con la salida antes de la entrada. Revise las horas.";
  }
  return porDefecto;
}
