"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { TAG_PROMOS } from "@/lib/promosServer";
import { normalizarUrlPromo, validarPromo, type Promo } from "@/lib/promos";

interface ResultadoAccion {
  success: boolean;
  error?: string;
}

/* Escrituras de los anuncios (PRP-001 Fase 3). Mismo patrón que el resto
   del panel: getUser → leer rol → exigir admin. RLS lo refuerza en la DB. */

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
  if (codigo === "23505") return "Ya existe un anuncio con ese identificador.";
  return fallback;
}

/** Refresca la landing tras un cambio. La home es estática y se sirve del
    caché: sin esto el admin guardaría y seguiría viendo lo anterior, que es
    exactamente la confusión que la Fase 3 vino a eliminar. */
function refrescarLanding(): void {
  // Next 16 exige el segundo argumento (`profile`): la forma de un solo
  // parámetro está deprecada. "max" da semántica stale-while-revalidate.
  revalidateTag(TAG_PROMOS, "max");
  // El tag invalida el fetch de los anuncios; revalidatePath refresca la
  // página en sí. Son cosas distintas y acá hacen falta las dos.
  revalidatePath("/");
  revalidatePath("/dashboard/anuncios");
}

/** Guarda el set completo de anuncios (posición, orden, textos, imagen). */
export async function guardarPromosAction(promos: Promo[]): Promise<ResultadoAccion> {
  const sesion = await exigirAdmin();
  if ("error" in sesion) return { success: false, error: sesion.error };

  for (const promo of promos) {
    const problema = validarPromo(promo);
    if (problema) return { success: false, error: `${promo.nombre || "Anuncio"}: ${problema}` };
  }

  const { data, error } = await sesion.supabase
    .from("promos")
    .upsert(
      promos.map((p) => ({
        id: p.id,
        nombre: p.nombre.trim(),
        img: p.img.trim(),
        alt: p.alt.trim(),
        vertical: p.vertical,
        slot: p.slot,
        orden: p.orden,
        /* Se guarda normalizada, no como la escribió el admin: "instagram.com/x"
           entra sin esquema y saldría como enlace relativo a perrustingo.com.
           `validarPromo` ya rechazó lo que no sea http o https. */
        url: (() => {
          const r = normalizarUrlPromo(p.url);
          return "error" in r ? null : r.url;
        })(),
        updated_at: new Date().toISOString(),
      })),
      { onConflict: "id" }
    )
    .select("id");

  if (error) return { success: false, error: mensajeDeError(error.code, "No se pudo guardar.") };
  // Con RLS, un upsert no autorizado puede volver sin error y sin filas.
  if (!data || data.length === 0) {
    return { success: false, error: "No se guardó ningún anuncio (permisos)." };
  }

  refrescarLanding();
  return { success: true };
}

/** Crea un anuncio nuevo. Antes esto exigía un despliegue: los cuatro
    anuncios estaban escritos en el código. */
export async function crearPromoAction(promo: Promo): Promise<ResultadoAccion> {
  const sesion = await exigirAdmin();
  if ("error" in sesion) return { success: false, error: sesion.error };

  const problema = validarPromo(promo);
  if (problema) return { success: false, error: problema };

  const { data, error } = await sesion.supabase
    .from("promos")
    .insert({
      id: promo.id,
      nombre: promo.nombre.trim(),
      img: promo.img.trim(),
      alt: promo.alt.trim(),
      vertical: promo.vertical,
      slot: promo.slot,
      orden: promo.orden,
    })
    .select("id");

  if (error) return { success: false, error: mensajeDeError(error.code, "No se pudo crear.") };
  if (!data || data.length === 0) {
    return { success: false, error: "No se creó el anuncio (permisos)." };
  }

  refrescarLanding();
  return { success: true };
}

/** Borra un anuncio. La imagen queda en Storage a propósito: borrarla haría
    irrecuperable un borrado por error, y el bucket no es el problema. */
export async function eliminarPromoAction(id: string): Promise<ResultadoAccion> {
  const sesion = await exigirAdmin();
  if ("error" in sesion) return { success: false, error: sesion.error };

  const { data, error } = await sesion.supabase
    .from("promos")
    .delete()
    .eq("id", id)
    .select("id");

  if (error) return { success: false, error: mensajeDeError(error.code, "No se pudo eliminar.") };
  if (!data || data.length === 0) {
    return { success: false, error: "No se eliminó el anuncio (permisos)." };
  }

  refrescarLanding();
  return { success: true };
}
