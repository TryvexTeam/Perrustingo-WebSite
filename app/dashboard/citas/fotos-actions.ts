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

export async function registrarFotoResultado(
  citaId: string,
  url: string
): Promise<Resultado> {
  // La URL la produce el cliente. Aunque venga de nuestro propio código,
  // llega por la red: si no se valida, cualquiera con sesión podría dejar
  // apuntada la "evidencia" a un sitio ajeno.
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!base || !url.startsWith(`${base}/storage/v1/object/public/reservas/`)) {
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
      url,
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
