"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { validarOferta, type Oferta } from "@/lib/ofertas";

interface ResultadoAccion {
  success: boolean;
  error?: string;
}

/* Escrituras de las ofertas (PRP-003 F2). Guard admin + RLS, igual que el
   resto del panel. Estas filas deciden cuánto paga un cliente, así que la
   validación del servidor no es una formalidad. */

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

function mensajeDeError(codigo: string | undefined, fallback: string): string {
  if (codigo === "42501") return "La base de datos rechazó el cambio (permisos).";
  if (codigo === "23514") return "Algún valor está fuera de rango.";
  return fallback;
}

function aFila(oferta: Oferta) {
  return {
    titulo: oferta.titulo.trim(),
    detalle: oferta.detalle.trim(),
    solo_con_cuenta: oferta.soloConCuenta,
    desde_visita: oferta.desdeVisita,
    hasta_visita: oferta.hastaVisita,
    tipo: oferta.tipo,
    // Solo sobrevive el valor del tipo declarado; el otro se limpia para no
    // dejar números huérfanos que el próximo lector crea vigentes (mismo
    // criterio que los agregados de precio, PRP-001 F2).
    pct: oferta.tipo === "pct" ? oferta.pct : 0,
    monto: oferta.tipo === "monto" ? oferta.monto : null,
    activa: oferta.activa,
    vigente_desde: oferta.vigenteDesde || null,
    vigente_hasta: oferta.vigenteHasta || null,
    updated_at: new Date().toISOString(),
  };
}

export async function guardarOfertaAction(oferta: Oferta): Promise<ResultadoAccion> {
  const sesion = await exigirAdmin();
  if ("error" in sesion) return { success: false, error: sesion.error };

  const problema = validarOferta(oferta);
  if (problema) return { success: false, error: problema };

  const { data, error } = await sesion.supabase
    .from("ofertas")
    .update(aFila(oferta))
    .eq("id", oferta.id)
    .select("id");

  if (error) return { success: false, error: mensajeDeError(error.code, "No se pudo guardar.") };
  // Con RLS, un UPDATE no autorizado no falla: filtra las filas y devuelve
  // éxito. Sin este chequeo el panel diría "guardado" sin haber cambiado nada.
  if (!data || data.length === 0) {
    return { success: false, error: "No se guardó la oferta (permisos)." };
  }

  revalidatePath("/dashboard/ofertas");
  revalidatePath("/reserva");
  return { success: true };
}

export async function crearOfertaAction(oferta: Oferta): Promise<ResultadoAccion> {
  const sesion = await exigirAdmin();
  if ("error" in sesion) return { success: false, error: sesion.error };

  const problema = validarOferta(oferta);
  if (problema) return { success: false, error: problema };

  const { data, error } = await sesion.supabase
    .from("ofertas")
    .insert(aFila(oferta))
    .select("id");

  if (error) return { success: false, error: mensajeDeError(error.code, "No se pudo crear.") };
  if (!data || data.length === 0) {
    return { success: false, error: "No se creó la oferta (permisos)." };
  }

  revalidatePath("/dashboard/ofertas");
  revalidatePath("/reserva");
  return { success: true };
}

/** Elimina una oferta. Las citas que la usaron conservan su registro:
    `sesiones.oferta_id` queda en NULL por ON DELETE SET NULL, y el precio
    ya cobrado no cambia. */
export async function eliminarOfertaAction(id: string): Promise<ResultadoAccion> {
  const sesion = await exigirAdmin();
  if ("error" in sesion) return { success: false, error: sesion.error };

  const { data, error } = await sesion.supabase
    .from("ofertas")
    .delete()
    .eq("id", id)
    .select("id");

  if (error) return { success: false, error: mensajeDeError(error.code, "No se pudo eliminar.") };
  if (!data || data.length === 0) {
    return { success: false, error: "No se eliminó la oferta (permisos)." };
  }

  revalidatePath("/dashboard/ofertas");
  revalidatePath("/reserva");
  return { success: true };
}
