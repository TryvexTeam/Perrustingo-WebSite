"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { eliminarEventoCita } from "@/lib/google/calendar";

/* Cancelar varias citas de una vez (PRP-004 F6).

   Contrapeso necesario de la detección: si el panel avisa "llegaron 8 reservas
   falsas", el equipo no puede quedarse cancelando de a una mientras la agenda
   sigue bloqueada. Pero el gatillo lo aprieta una persona, nunca el sistema —
   cancelar solo sería peor que el ataque. */

interface ResultadoMasivo {
  success: boolean;
  /** Cuántas se cancelaron de verdad (no cuántas se pidieron). */
  canceladas: number;
  error?: string;
}

/* Un tope por si algo llama a esto con una lista enorme: cancelar 500 citas de
   un click no es una operación que el salón deba poder hacer sin pensarlo. */
const MAXIMO_POR_TANDA = 50;

export async function cancelarCitasEnBloque(
  citaIds: string[]
): Promise<ResultadoMasivo> {
  if (citaIds.length === 0) {
    return { success: false, canceladas: 0, error: "No seleccionó ninguna cita." };
  }
  if (citaIds.length > MAXIMO_POR_TANDA) {
    return {
      success: false,
      canceladas: 0,
      error: `Son demasiadas de una vez (máximo ${MAXIMO_POR_TANDA}). Hágalo por tandas.`,
    };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, canceladas: 0, error: "Sesión expirada." };

  /* Solo admin. Cancelar en bloque es irreversible desde el panel: un
     trabajador puede cancelar cita por cita (donde ve a quién le cancela),
     pero borrar la agenda de un día es decisión del dueño. */
  const { data: perfil } = await supabase
    .from("perfiles")
    .select("rol")
    .eq("id", user.id)
    .single();
  if (perfil?.rol !== "admin") {
    return { success: false, canceladas: 0, error: "Solo un administrador puede cancelar en bloque." };
  }

  /* `.select()` para saber CUÁNTAS filas cambiaron de verdad.
     Bajo RLS, un UPDATE sin permiso no falla: afecta 0 filas y devuelve
     éxito. Sin este conteo estaríamos reportando un número inventado.

     El filtro por estado evita revivir canceladas o pisar completadas: si una
     de las seleccionadas ya se atendió, se queda como está. */
  const { data, error } = await supabase
    .from("sesiones")
    .update({ estado: "cancelada", updated_at: new Date().toISOString() })
    .in("id", citaIds)
    .in("estado", ["pendiente", "confirmada"])
    .select("id");

  if (error) {
    return { success: false, canceladas: 0, error: "No se pudo cancelar." };
  }

  const canceladas = data?.length ?? 0;

  // Limpiar el calendario. Nunca bloquea: la cancelación ya quedó en la base.
  for (const fila of data ?? []) {
    try {
      await eliminarEventoCita(fila.id);
    } catch (e) {
      console.warn("[google-calendar] no se pudo borrar el evento:", e);
    }
  }

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/citas");
  revalidatePath("/dashboard/hoy");
  revalidatePath("/dashboard/seguridad");
  revalidatePath("/agenda");

  /* Si se pidieron 8 y se cancelaron 5, eso no es un error pero tampoco un
     éxito limpio: probablemente tres ya estaban atendidas. Decirlo. */
  if (canceladas < citaIds.length) {
    return {
      success: true,
      canceladas,
      error: `Se cancelaron ${canceladas} de ${citaIds.length}. Las otras ya estaban completadas o canceladas.`,
    };
  }

  return { success: true, canceladas };
}
