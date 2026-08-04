"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

/* Registro de la foto del resultado (PRP-002 F3).

   El archivo lo sube el navegador directo a Storage (necesita el File, que no
   viaja bien por una server action y además así no pasa por el servidor de
   Next). Acá sólo se registra la fila — pero es la fila la que convierte una
   imagen suelta en evidencia: deja escrito quién la subió y cuándo. */

interface Resultado {
  success: boolean;
  error?: string;
}

/* La migración 004 puso un CHECK sobre `tipo`. Inventar un valor nuevo acá
   reventaría en producción con un error críptico. */
const TIPO_DESPUES = "despues";

/* `<uid>/<archivo>`: la ruta que produce lib/fotos.ts y la única forma que
   la policy de storage acepta. Se valida acá porque, aunque la genere
   nuestro propio código, llega por la red — sin esto, cualquiera con sesión
   podría dejar la "evidencia" apuntando a otra carpeta. */
const RUTA_VALIDA = /^[0-9a-f-]{36}\/[A-Za-z0-9._-]+$/;

export async function registrarFotoResultado(
  citaId: string,
  ruta: string
): Promise<Resultado> {
  if (!RUTA_VALIDA.test(ruta)) {
    return { success: false, error: "La foto no quedó guardada correctamente." };
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

  /* `.select()` para saber si la fila entró de verdad. Bajo RLS un INSERT sin
     permiso puede no fallar y no insertar nada; sin este conteo estaríamos
     diciendo "foto guardada" sobre una tabla vacía. */
  const { data, error } = await supabase
    .from("fotos_sesion")
    .insert({
      sesion_id: citaId,
      tipo: TIPO_DESPUES,
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
