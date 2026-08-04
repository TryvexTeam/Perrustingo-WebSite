/* Lectura de cupones desde Supabase, separada del dominio (lib/cupones.ts) por
   el mismo criterio que `tramosDatos` vs `tramos`: la regla se prueba sin base
   ni red, acá solo vive el acarreo de filas.

   Sin directiva de cliente: lo usan tanto la ruta pública de reservas (servidor)
   como el panel. La escritura vive en app/dashboard/cupones/actions.ts, con rol
   admin exigido. Ver migración 035. */

import type { SupabaseClient } from "@supabase/supabase-js";
import { normalizarTelefono } from "./contacto";
import type { Cupon } from "./cupones";

/* Un cliente cualquiera de Supabase: la ruta pública trae el suyo de
   `lib/supabase/server`, el panel el de `client`, y ninguno de los dos tiene
   tipos generados. Con `any` en los genéricos el módulo sirve a los dos sin
   arrastrar la forma de uno al otro. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Cliente = SupabaseClient<any, any, any>;

/** Fila cruda de `cupones`. Se parsea, no se asume. */
interface FilaCupon {
  codigo: string;
  descripcion: string | null;
  descuento_pct: number | string;
  activo: boolean | null;
  vigente_desde: string | null;
  vigente_hasta: string | null;
  max_usos: number | string | null;
  usos: number | string | null;
  dias_anticipacion_min: number | string | null;
  desde_visita: number | string | null;
  hasta_visita: number | string | null;
  solo_con_cuenta: boolean | null;
  servicio_slug: string | null;
}

const COLUMNAS =
  "codigo, descripcion, descuento_pct, activo, vigente_desde, vigente_hasta, max_usos, usos, dias_anticipacion_min, desde_visita, hasta_visita, solo_con_cuenta, servicio_slug";

/**
 * Convierte a número o a `null`.
 *
 * Los `numeric` de Postgres llegan como STRING —el driver no los convierte para
 * no perder precisión— y `descuento_pct` viene de una columna que en algunas
 * bases quedó como numeric. Sin esto, `"10" >= 5` compara texto y las
 * condiciones salen mal sin que nada falle a la vista.
 */
function num(v: number | string | null | undefined): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/** Fila cruda → cupón del dominio. */
export function aCupon(f: FilaCupon): Cupon {
  return {
    codigo: f.codigo,
    descripcion: f.descripcion ?? "",
    descuentoPct: num(f.descuento_pct) ?? 0,
    activo: f.activo !== false,
    vigenteDesde: f.vigente_desde,
    vigenteHasta: f.vigente_hasta,
    maxUsos: num(f.max_usos),
    usos: num(f.usos) ?? 0,
    diasAnticipacionMin: num(f.dias_anticipacion_min),
    desdeVisita: num(f.desde_visita),
    hastaVisita: num(f.hasta_visita),
    soloConCuenta: f.solo_con_cuenta === true,
    servicioSlug: f.servicio_slug,
  };
}

/**
 * Busca un cupón por código, sin distinguir mayúsculas.
 *
 * El cliente escribe "lanzamiento" y la tabla guarda "LANZAMIENTO": comparar
 * con `.eq()` a secas rechazaría un cupón perfectamente válido. Se usa
 * `.ilike()` con el código escapado —los `%` y `_` de un código escrito a mano
 * son comodines para Postgres, y sin escaparlos "A%" traería cualquier cupón
 * que empiece con A.
 *
 * Devuelve `null` si no existe. La RLS pública solo muestra los activos, así
 * que un cupón desactivado también llega como `null`: el dominio responde
 * "no existe", que es lo correcto de decirle a un cliente.
 */
export async function obtenerCupon(supabase: Cliente, codigo: string): Promise<Cupon | null> {
  const limpio = codigo.trim();
  if (limpio === "") return null;

  const patron = limpio.replace(/([%_\\])/g, "\\$1");
  const { data, error } = await supabase
    .from("cupones")
    .select(COLUMNAS)
    .ilike("codigo", patron)
    .limit(1)
    .maybeSingle();

  if (error || !data) return null;
  return aCupon(data as unknown as FilaCupon);
}

/** Todos los cupones, para el panel. Ordenados por código para que la lista no
    salte de lugar entre guardados. */
export async function listarCupones(supabase: Cliente): Promise<Cupon[]> {
  const { data, error } = await supabase.from("cupones").select(COLUMNAS).order("codigo");
  if (error || !data) return [];
  return (data as unknown as FilaCupon[]).map(aCupon);
}

/**
 * Cuántas citas COMPLETADAS lleva ya este cliente.
 *
 * El match es por email + teléfono, no por `cliente_id`: la mitad de las
 * reservas entran sin cuenta y ahí no hay id que mirar. Es el mismo criterio
 * que usa `penalizacion_pendiente` en la migración 035.
 *
 * EL TELÉFONO SE NORMALIZA A DÍGITOS antes de comparar. "+56 9 1234 5678" y
 * "912345678" son la misma persona, y compararlos como texto plano falla
 * SIEMPRE — el cupón de la segunda visita no se activaría nunca y nadie sabría
 * por qué. Postgres no puede normalizar del lado del servidor sin una función,
 * así que se traen los candidatos por email (que sí se compara bien en la base)
 * y se filtra el teléfono acá.
 */
export async function contarVisitasPrevias(
  supabase: Cliente,
  email: string,
  telefono: string
): Promise<number> {
  const correo = email.trim().toLowerCase();
  const tel = normalizarTelefono(telefono);
  if (correo === "" || tel === "") return 0;

  const { data, error } = await supabase
    .from("sesiones")
    .select("contacto_telefono")
    .ilike("contacto_email", correo.replace(/([%_\\])/g, "\\$1"))
    .eq("estado", "completada");

  /* Ante un error de lectura se devuelve 0, es decir "es su primera visita".
     Es la respuesta conservadora: un cupón de segunda visita no se aplica por
     un fallo de red, en vez de regalarse. Al revés —asumir muchas visitas—
     estaría descontando plata por una falla nuestra. */
  if (error || !data) return 0;

  return (data as { contacto_telefono: string | null }[]).filter(
    (s) => normalizarTelefono(s.contacto_telefono ?? "") === tel
  ).length;
}

/**
 * Marca un canje consumido. Devuelve si el contador de verdad subió.
 *
 * POR QUÉ DEVUELVE UN BOOLEANO Y NO NADA: `cupones` solo tiene
 * `GRANT SELECT` para anon/authenticated (runbook del 20-jul; la migración 035
 * agregó columnas pero no privilegios). Un UPDATE desde el cliente público no
 * falla con error: pasa por RLS, toca cero filas y devuelve éxito. Si esta
 * función no verificara el efecto, el tope de usos sería decorativo y nadie lo
 * notaría hasta que un código filtrado se canjeara mil veces.
 *
 * Por eso el llamador debe pasar un cliente con permiso de escritura
 * (`crearClienteServicio`) y mirar el resultado.
 */
export async function registrarUsoCupon(supabase: Cliente, cupon: Cupon): Promise<boolean> {
  const { data, error } = await supabase
    .from("cupones")
    .update({ usos: cupon.usos + 1 })
    .eq("codigo", cupon.codigo)
    // El contador solo avanza si nadie más lo movió mientras tanto: dos
    // reservas simultáneas con el último uso disponible no pueden sumar las dos
    // al mismo número y dejarlo en +1 en vez de +2.
    .eq("usos", cupon.usos)
    .select("codigo");

  return !error && Array.isArray(data) && data.length === 1;
}
