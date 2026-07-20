import type { SupabaseClient } from "@supabase/supabase-js";

/* Dominio de cupones — tabla `cupones` (migración 005). La validación de
   vigencia/tope de usos vive en la base (policy de SELECT + función
   aplicar_cupon), no solo acá: este módulo es una fachada tipada, no la
   única línea de defensa. */

export type TipoCupon = "registro" | "flyer" | "manual";

export interface Cupon {
  id: string;
  codigo: string;
  tipo: TipoCupon;
  descuento_pct: number;
  usos_max: number | null;
  usos_actuales: number;
  vigente_desde: string | null;
  vigente_hasta: string | null;
  activo: boolean;
}

/**
 * Consulta si un código es válido AHORA MISMO (vigente, activo, con cupo).
 * Sirve para mostrar "cupón válido" en el form antes de enviar — la policy
 * `cupon_publico_vigente` ya filtra lo que no corresponde, así que un
 * resultado vacío significa código inexistente O no aplicable, sin
 * distinguir el motivo (no exponer por qué a un anónimo).
 */
export async function validarCupon(
  supabase: SupabaseClient,
  codigo: string
): Promise<Cupon | null> {
  const { data, error } = await supabase
    .from("cupones")
    .select("*")
    .eq("codigo", codigo.trim().toUpperCase())
    .maybeSingle();

  if (error || !data) return null;
  return data as Cupon;
}

/**
 * Reserva un uso del cupón de forma atómica (RPC `aplicar_cupon`).
 *
 * IMPORTANTE: llamar esto SOLO desde el servidor (route handler / server
 * action), nunca confiar en un `cupon_id` que venga del body del cliente —
 * es el mismo patrón que ya mordió a esta app con `precio_base` manipulable.
 * El id devuelto es el único valor válido para `sesiones.cupon_id`.
 */
export async function aplicarCupon(
  supabase: SupabaseClient,
  codigo: string
): Promise<string | null> {
  const { data, error } = await supabase.rpc("aplicar_cupon", {
    p_codigo: codigo.trim().toUpperCase(),
  });
  if (error) return null;
  return (data as string | null) ?? null;
}

/** Precio final aplicando el % de descuento del cupón, redondeado a la centena. */
export function aplicarDescuento(precioBase: number, cupon: Pick<Cupon, "descuento_pct">): number {
  const conDescuento = precioBase * (1 - cupon.descuento_pct / 100);
  return Math.round(conDescuento / 100) * 100;
}
