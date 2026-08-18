"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { crearClienteServicio } from "@/lib/supabase/servicio";
import { esFallo, exigirCitaPropia } from "@/lib/citasAcceso";
import { TIPOS_FOTO, type TipoFoto } from "./fotos-tipos";

/* Registro de la foto del resultado (PRP-002 F3).

   El archivo lo sube el navegador directo a Storage (necesita el File, que no
   viaja bien por una server action y además así no pasa por el servidor de
   Next). Acá sólo se registra la fila — pero es la fila la que convierte una
   imagen suelta en evidencia: deja escrito quién la subió y cuándo. */

interface Resultado {
  success: boolean;
  error?: string;
}

/* `<uid>/<archivo>`: la ruta que produce lib/fotos.ts y la única forma que
   la policy de storage acepta. Se valida acá porque, aunque la genere
   nuestro propio código, llega por la red — sin esto, cualquiera con sesión
   podría dejar la "evidencia" apuntando a otra carpeta. */
const RUTA_VALIDA = /^[0-9a-f-]{36}\/[A-Za-z0-9._-]+$/;

/**
 * Registra una foto de la cita.
 *
 * `tipo` era fijo en "despues": el equipo no podía subir una foto del antes,
 * un detalle a mitad de trabajo ni el comprobante de pago. Ahora se elige, y
 * se valida contra la lista que acepta la base — un valor inventado moriría
 * en el CHECK con un error que no dice nada.
 */
export async function registrarFotoResultado(
  citaId: string,
  ruta: string,
  tipo: TipoFoto = "despues"
): Promise<Resultado> {
  if (!RUTA_VALIDA.test(ruta)) {
    return { success: false, error: "La foto no quedó guardada correctamente." };
  }

  if (!TIPOS_FOTO.includes(tipo)) {
    return { success: false, error: "Ese tipo de foto no existe." };
  }

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

  /* Mismo criterio que el resto de las acciones sobre una cita: no se le
     cuelgan fotos —ni menos un comprobante de pago— a la cita de un colega.
     La lectura del dueño va por el cliente de servicio porque desde la 027 el
     trabajador no alcanza `sesiones` con su propia sesión. Ver lib/citasAcceso.ts. */
  const permiso = await exigirCitaPropia(
    crearClienteServicio() ?? supabase,
    citaId,
    perfil.rol,
    user.id
  );
  if (esFallo(permiso)) return { success: false, error: permiso.error };

  /* `.select()` para saber si la fila entró de verdad. Bajo RLS un INSERT sin
     permiso puede no fallar y no insertar nada; sin este conteo estaríamos
     diciendo "foto guardada" sobre una tabla vacía. */
  const { data, error } = await supabase
    .from("fotos_sesion")
    .insert({
      sesion_id: citaId,
      tipo,
      ruta,
      subida_por: user.id,
    })
    .select("id");

  if (error || !data || data.length === 0) {
    return { success: false, error: "No se pudo registrar la foto." };
  }

  revalidatePath("/dashboard/citas");
  revalidatePath("/agenda");
  return { success: true };
}
