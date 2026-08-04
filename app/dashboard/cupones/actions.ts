"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { validarCupon, type Cupon } from "@/lib/cupones";

interface ResultadoAccion {
  success: boolean;
  /** Un solo mensaje de contexto (permisos, sesión, base). */
  error?: string;
  /** Problemas de validación, uno por línea, para mostrarlos todos juntos. */
  problemas?: string[];
}

/* Escrituras de los cupones. Mismo patrón que app/dashboard/ofertas/actions.ts
   y app/dashboard/usuarios/actions.ts: getUser → leer rol → exigir admin.
   Estas filas deciden cuánto paga un cliente, así que la validación del
   servidor no es una formalidad: el navegador puede mandar cualquier cosa. */

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

/* Traduce un error de Postgres a algo que el dueño pueda entender. Nunca se
   devuelve un rechazo mudo ni el error crudo.

   El 42501 se explica en detalle a propósito: la tabla `cupones` tiene la
   política `admin_maneja_cupones` (migración 004) pero solo
   `GRANT SELECT ... TO anon, authenticated`. Sin INSERT/UPDATE concedidos,
   Postgres rechaza la escritura ANTES de mirar la política. Es la misma
   trampa que ya pegó tres veces en este proyecto (privilegio antes que RLS),
   así que el mensaje dice qué falta en vez de dejar al dueño adivinando. */
function mensajeDeError(codigo: string | undefined, fallback: string): string {
  if (codigo === "42501") {
    return "La base de datos rechazó el cambio por permisos: a la tabla de cupones le falta el GRANT de escritura para el rol admin. Avise al equipo técnico.";
  }
  if (codigo === "23514") {
    return "Algún valor quedó fuera del rango que acepta la base (revise el descuento, el tope de usos y las visitas).";
  }
  if (codigo === "23505") {
    return "Ya existe un cupón con ese código. Elija otro.";
  }
  return fallback;
}

/** Cupón del dominio → fila de la tabla. El código se guarda en mayúsculas:
    el cliente lo escribe a mano y la búsqueda es `ilike`, así que dejarlo
    disparejo solo confunde al dueño cuando lo lee en la lista. */
function aFila(cupon: Cupon) {
  return {
    codigo: cupon.codigo.trim().toUpperCase(),
    descripcion: cupon.descripcion.trim(),
    descuento_pct: cupon.descuentoPct,
    activo: cupon.activo,
    vigente_desde: cupon.vigenteDesde || null,
    vigente_hasta: cupon.vigenteHasta || null,
    max_usos: cupon.maxUsos,
    dias_anticipacion_min: cupon.diasAnticipacionMin,
    desde_visita: cupon.desdeVisita,
    hasta_visita: cupon.hastaVisita,
    solo_con_cuenta: cupon.soloConCuenta,
    servicio_slug: cupon.servicioSlug?.trim() || null,
  };
}

function revalidar(): void {
  revalidatePath("/dashboard/cupones");
  revalidatePath("/reserva");
}

/** Crea un cupón nuevo. El contador de usos nace en 0 y no se toca nunca desde
    el panel: lo mueve el canje real (`registrarUsoCupon`). */
export async function crearCuponAction(cupon: Cupon): Promise<ResultadoAccion> {
  const sesion = await exigirAdmin();
  if ("error" in sesion) return { success: false, error: sesion.error };

  const problemas = validarCupon(cupon);
  if (problemas.length > 0) return { success: false, problemas };

  const { data, error } = await sesion.supabase
    .from("cupones")
    .insert({ ...aFila(cupon), usos: 0 })
    .select("codigo");

  if (error) {
    return { success: false, error: mensajeDeError(error.code, "No se pudo crear el cupón.") };
  }
  // Con RLS activo, un INSERT no autorizado puede no fallar: devuelve éxito
  // sin filas. Verificamos el efecto, no la llamada.
  if (!data || data.length === 0) {
    return { success: false, error: "No se creó el cupón (permisos)." };
  }

  revalidar();
  return { success: true };
}

/** Guarda los cambios de un cupón existente.

    El CÓDIGO no se puede cambiar: es la clave primaria y además es lo que la
    gente ya tiene anotado en el flyer. Renombrarlo dejaría inservible el papel
    que anda circulando, así que para cambiar el código se crea otro cupón y se
    apaga el viejo. */
export async function guardarCuponAction(cupon: Cupon): Promise<ResultadoAccion> {
  const sesion = await exigirAdmin();
  if ("error" in sesion) return { success: false, error: sesion.error };

  const problemas = validarCupon(cupon);
  if (problemas.length > 0) return { success: false, problemas };

  const fila = aFila(cupon);
  const { data, error } = await sesion.supabase
    .from("cupones")
    .update(fila)
    .eq("codigo", fila.codigo)
    .select("codigo");

  if (error) {
    return { success: false, error: mensajeDeError(error.code, "No se pudo guardar el cupón.") };
  }
  if (!data || data.length === 0) {
    return {
      success: false,
      error: "No se guardó ningún cupón: o el código ya no existe, o la base rechazó el cambio por permisos.",
    };
  }

  revalidar();
  return { success: true };
}

/** Prende o apaga un cupón sin tocar el resto de sus condiciones.
    Apagar es la forma segura de retirar un código de circulación: no se borra
    el historial de usos ni se pierde la configuración si hay que reactivarlo. */
export async function alternarCuponAction(
  codigo: string,
  activo: boolean
): Promise<ResultadoAccion> {
  const sesion = await exigirAdmin();
  if ("error" in sesion) return { success: false, error: sesion.error };

  const limpio = codigo.trim();
  if (limpio === "") return { success: false, error: "Falta el código del cupón." };

  const { data, error } = await sesion.supabase
    .from("cupones")
    .update({ activo })
    .eq("codigo", limpio)
    .select("codigo");

  if (error) {
    return { success: false, error: mensajeDeError(error.code, "No se pudo cambiar el estado.") };
  }
  if (!data || data.length === 0) {
    return {
      success: false,
      error: "No se cambió ningún cupón: o el código ya no existe, o la base rechazó el cambio por permisos.",
    };
  }

  revalidar();
  return { success: true };
}
