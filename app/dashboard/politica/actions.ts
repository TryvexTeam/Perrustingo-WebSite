"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { PoliticaCitas } from "@/lib/politica";

interface ResultadoAccion {
  success: boolean;
  error?: string;
}

/* Mismo guard que `app/dashboard/disponibilidad/actions.ts`: la política es
   plata que se le cobra a un cliente, así que la escribe el dueño y nadie
   más. RLS lo refuerza en la base (policy `politica_citas_escritura`). */
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
  if (perfil?.rol !== "admin") return { error: "Sin permisos." };

  return { supabase };
}

/**
 * Guarda la política de atrasos y cancelaciones.
 *
 * Las validaciones repiten a propósito los CHECK de la migración 035: llegar
 * hasta Postgres para que rechace un número negativo devuelve un error que no
 * se puede leer ni accionar desde el panel.
 *
 * Encender la política NO es un campo más. Se exige que el texto que lee el
 * cliente exista: un recargo que el cliente no pudo leer antes de reservar no
 * es defendible en la puerta del local, y esa es la única barrera que este
 * archivo puede poner.
 */
export async function guardarPoliticaAction(
  politica: PoliticaCitas
): Promise<ResultadoAccion> {
  const sesion = await exigirAdmin();
  if ("error" in sesion) return { success: false, error: sesion.error };

  if (
    !Number.isInteger(politica.toleranciaMin) ||
    politica.toleranciaMin < 0 ||
    politica.toleranciaMin > 240
  ) {
    return { success: false, error: "La tolerancia debe estar entre 0 y 240 minutos." };
  }
  if (
    !Number.isInteger(politica.recargoAtrasoHora) ||
    politica.recargoAtrasoHora < 0 ||
    politica.recargoAtrasoHora > 200_000
  ) {
    return { success: false, error: "El recargo por hora debe estar entre $0 y $200.000." };
  }
  if (
    !Number.isInteger(politica.cancelacionHoras) ||
    politica.cancelacionHoras < 0 ||
    politica.cancelacionHoras > 168
  ) {
    return { success: false, error: "Las horas de cancelación deben estar entre 0 y 168." };
  }
  if (
    !Number.isFinite(politica.cancelacionPct) ||
    politica.cancelacionPct < 0 ||
    politica.cancelacionPct > 100
  ) {
    return { success: false, error: "El recargo por cancelar debe estar entre 0 % y 100 %." };
  }

  const textoCliente = politica.textoCliente.trim();
  if (textoCliente.length > 600) {
    return { success: false, error: "El texto para el cliente no puede pasar de 600 caracteres." };
  }
  /* El CHECK de la base no exige texto, pero encender sin él sí es un
     problema: la regla cobraría sin que el cliente haya tenido dónde leerla. */
  if (politica.activa && textoCliente.length < 20) {
    return {
      success: false,
      error:
        "Para encender la política hay que escribir el texto que lee el cliente antes de reservar. " +
        "Sin eso, el cliente se entera del recargo recién en la puerta del local.",
    };
  }

  const { data: filas, error } = await sesion.supabase
    .from("politica_citas")
    .update({
      activa: politica.activa,
      tolerancia_min: politica.toleranciaMin,
      recargo_atraso_hora: politica.recargoAtrasoHora,
      cancelacion_horas: politica.cancelacionHoras,
      cancelacion_pct: politica.cancelacionPct,
      pierde_cupon: politica.pierdeCupon,
      texto_cliente: textoCliente,
      actualizado_en: new Date().toISOString(),
    })
    .eq("singleton", true)
    .select("singleton");

  if (error) {
    if (error.code === "42P01") {
      return { success: false, error: "Falta aplicar la migración 035 en la base de datos." };
    }
    if (error.code === "42501") {
      return { success: false, error: "La base de datos rechazó el cambio (permisos)." };
    }
    return { success: false, error: "No se pudo guardar la política." };
  }
  /* Un UPDATE que no toca filas no falla. Sin esto, la pantalla diría
     "guardado" con la política intacta — el mismo fallo mudo que ya costó
     caro en `cambiarEstadoCita`. */
  if (!filas || filas.length === 0) {
    return {
      success: false,
      error: "No se guardó la política (la fila no existe o los permisos la ocultan).",
    };
  }

  revalidatePath("/dashboard/politica");
  revalidatePath("/reserva");
  return { success: true };
}
