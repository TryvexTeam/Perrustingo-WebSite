import { createClient } from "@/lib/supabase/server";
import { crearClienteServicio } from "@/lib/supabase/servicio";

/* Quién puede tocar QUÉ cita.
 *
 * POR QUÉ EXISTE: la migración 038 hizo que cada trabajador vea solo sus citas
 * recortando la vista `sesiones_equipo`. Pero las server actions no leen por
 * esa vista: leen y escriben la tabla `sesiones` con el cliente de servicio,
 * que se salta RLS por diseño —lo necesitan, porque desde la 027 el trabajador
 * ya no alcanza el contacto del cliente y ese dato alimenta el correo y el
 * evento de calendario—. Todas comprobaban únicamente que quien apretaba el
 * botón fuera del equipo. Ninguna comprobaba que la cita fuera SUYA.
 *
 * Con eso, un trabajador con el id de una cita ajena podía cambiarle el estado,
 * marcarle un recargo, registrar el cobro y hasta dispararle el correo "su
 * perrito está listo" al cliente de un colega, leyendo un `contacto_email` que
 * la vista le niega por delante. Recortar la vitrina no es cerrar la puerta de
 * atrás: mientras el camino de la clave de servicio siguiera sin filtro, la
 * segregación de la 038 era aparente.
 *
 * Acá vive ese filtro, una sola vez y compartido, para que agregar una acción
 * nueva no signifique volver a acordarse de esta regla. */

/** Sesión de alguien del equipo. El `userId` es lo que faltaba: sin él no hay
    forma de preguntar si una cita es suya. */
export interface SesionEquipo {
  supabase: Awaited<ReturnType<typeof createClient>>;
  rol: string;
  userId: string;
}

export type ResultadoEquipo = SesionEquipo | { error: string };

export function esFallo<T extends object>(r: T | { error: string }): r is { error: string } {
  return "error" in r;
}

/**
 * ¿Quien llama es del equipo? Devuelve su sesión, su rol y su id.
 *
 * El rol se lee con la sesión del propio usuario y no con la clave de servicio:
 * la policy de `perfiles` ya limita lo que puede ver de sí mismo, y el trigger
 * `protege_rol` impide que nadie se ascienda. Pedirlo por la puerta de servicio
 * solo agrandaría la superficie sin ganar nada.
 */
export async function exigirEquipo(): Promise<ResultadoEquipo> {
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
  if (!perfil || !["admin", "trabajador"].includes(perfil.rol)) {
    return { error: "Sin permisos." };
  }
  return { supabase, rol: perfil.rol as string, userId: user.id };
}

/** Lector de `sesiones`: el cliente de servicio (que se salta RLS) o, si no
    está configurado, la sesión de quien llama. Es el mismo par de tipos que ya
    usa `leerCierre` en las actions; describirlo a mano con una forma
    estructural hacía estallar la inferencia de Supabase (TS2589). */
export type LectorCitas =
  | NonNullable<ReturnType<typeof crearClienteServicio>>
  | Awaited<ReturnType<typeof createClient>>;

export type PermisoCita = { ok: true; peluqueroId: string | null } | { error: string };

/**
 * ¿Esta cita es de quien la está tocando?
 *
 * - El admin pasa siempre: es quien reparte el trabajo y responde por el local.
 * - Una cita SIN asignar pasa para cualquiera del equipo. Es el mismo criterio
 *   que ya usan la vista de la 038 y los bloqueos de la 034: mientras nadie la
 *   tenga a cargo, es trabajo de todos. Y hoy, con `peluquero_id` recién
 *   nacido en la 035, casi todas están así — bloquearlas dejaría al equipo sin
 *   poder trabajar desde el día uno.
 * - Una cita de otro se rechaza, sin decir de quién es: nombrar al colega sería
 *   filtrar por el mensaje de error lo mismo que la vista oculta.
 *
 * La cita se lee con el `lector` que ya usa cada acción, así el chequeo ve
 * exactamente la misma fila que se va a modificar.
 */
export async function exigirCitaPropia(
  lector: LectorCitas,
  citaId: string,
  rol: string,
  userId: string
): Promise<PermisoCita> {
  const { data: cita, error } = await lector
    .from("sesiones")
    .select("peluquero_id")
    .eq("id", citaId)
    .maybeSingle();

  /* Un fallo de lectura NO se trata como permiso concedido. Si no se puede
     saber de quién es la cita, no se opera: en este proyecto un rechazo mudo
     ya costó horas dos veces, y un permiso mudo costaría más. */
  if (error) return { error: "No se pudo comprobar a quién pertenece esta cita." };
  if (!cita) return { error: "Cita no encontrada." };

  if (rol === "admin") return { ok: true, peluqueroId: cita.peluquero_id };
  if (cita.peluquero_id === null) return { ok: true, peluqueroId: null };
  if (cita.peluquero_id === userId) return { ok: true, peluqueroId: cita.peluquero_id };

  return { error: "Esta cita está a cargo de otra persona del equipo." };
}
