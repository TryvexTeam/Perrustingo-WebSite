"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { esRol, validarDatos, type DatosEditables, type Rol } from "@/lib/usuarios";

interface ResultadoAccion {
  success: boolean;
  error?: string;
}

/* Escrituras del control de usuarios. Mismo patrón que
   app/dashboard/tarifas/actions.ts: getUser → leer rol → exigir admin.
   RLS + los triggers `protege_rol` y `protege_ultimo_admin` refuerzan lo
   mismo del lado de la DB (migración 008) — un action es solo una de las
   puertas, PostgREST directo es otra. */

/** Devuelve el id del admin autenticado, o un error listo para el cliente. */
async function exigirAdmin(): Promise<
  { supabase: Awaited<ReturnType<typeof createClient>>; adminId: string } | { error: string }
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

  return { supabase, adminId: user.id };
}

/** Traduce un error de Postgres a algo que el admin pueda entender.
    Nunca devolvemos el error crudo ni un fallo mudo: un rechazo sin
    explicación es indiagnosticable para quien lo recibe. */
function mensajeDeError(codigo: string | undefined, fallback: string): string {
  if (codigo === "42501") {
    return "La base de datos rechazó el cambio (permisos o última cuenta admin).";
  }
  return fallback;
}

/** Actualiza los datos de contacto de cualquier perfil. */
export async function actualizarDatosPerfilAction(
  perfilId: string,
  datos: DatosEditables
): Promise<ResultadoAccion> {
  const sesion = await exigirAdmin();
  if ("error" in sesion) return { success: false, error: sesion.error };

  const problema = validarDatos(datos);
  if (problema) return { success: false, error: problema };

  const { data, error } = await sesion.supabase
    .from("perfiles")
    .update({
      nombre: datos.nombre.trim(),
      apellido: datos.apellido.trim() || null,
      telefono: datos.telefono.trim() || null,
      comuna: datos.comuna.trim() || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", perfilId)
    .select("id");

  if (error) {
    return { success: false, error: mensajeDeError(error.code, "No se pudo guardar.") };
  }
  // Con RLS activo, un UPDATE no autorizado no falla: filtra las filas y
  // devuelve éxito con 0 afectadas. Sin este chequeo el panel diría
  // "guardado" y no habría cambiado nada (el modo de fallo que la
  // migración 008 vino a cerrar). Verificamos el efecto, no la llamada.
  if (!data || data.length === 0) {
    return { success: false, error: "No se modificó ningún perfil (permisos)." };
  }

  revalidatePath("/dashboard/usuarios");
  return { success: true };
}

/** Cambia el rol de un perfil. */
export async function cambiarRolAction(perfilId: string, rol: string): Promise<ResultadoAccion> {
  const sesion = await exigirAdmin();
  if ("error" in sesion) return { success: false, error: sesion.error };

  if (!esRol(rol)) return { success: false, error: "Rol inválido." };

  // Un admin que se auto-degrada pierde el panel en el acto y no puede
  // deshacerlo. El trigger `protege_ultimo_admin` cubre el caso extremo
  // (quedarse sin ninguno); esto cubre el pie en el propio zapato.
  if (perfilId === sesion.adminId && rol !== "admin") {
    return {
      success: false,
      error: "No puede quitarse a sí mismo el rol admin. Pídaselo a otro admin.",
    };
  }

  const { data, error } = await sesion.supabase
    .from("perfiles")
    .update({ rol: rol as Rol, updated_at: new Date().toISOString() })
    .eq("id", perfilId)
    .select("id, rol");

  if (error) {
    return { success: false, error: mensajeDeError(error.code, "No se pudo cambiar el rol.") };
  }
  if (!data || data.length === 0) {
    return { success: false, error: "No se modificó ningún perfil (permisos)." };
  }

  revalidatePath("/dashboard/usuarios");
  revalidatePath("/dashboard");
  return { success: true };
}

/** Marca o desmarca a alguien como peluquero que atiende.
    La Fase 5 cuenta esta columna para la capacidad paralela de la agenda:
    dejarla mal no rompe permisos, pero sí la disponibilidad publicada. */
export async function marcarPeluqueroAction(
  perfilId: string,
  esPeluquero: boolean
): Promise<ResultadoAccion> {
  const sesion = await exigirAdmin();
  if ("error" in sesion) return { success: false, error: sesion.error };

  const { data, error } = await sesion.supabase
    .from("perfiles")
    .update({ es_peluquero: esPeluquero, updated_at: new Date().toISOString() })
    .eq("id", perfilId)
    .select("id");

  if (error) {
    return { success: false, error: mensajeDeError(error.code, "No se pudo guardar.") };
  }
  if (!data || data.length === 0) {
    return { success: false, error: "No se modificó ningún perfil (permisos)." };
  }

  revalidatePath("/dashboard/usuarios");
  return { success: true };
}
