"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
/* Desde `fotosComun` y NO desde `lib/fotos`: ese lleva "use client" y la
   constante llegaba vacía, lo que aquí se veía como un "Bucket name invalid"
   al intentar borrar. Ni tsc ni el build lo detectan. */
import { BUCKET_FOTOS } from "@/lib/fotosComun";
import {
  MESES_RETENCION,
  planDeLimpieza,
  estadoEspacio,
  type EstadoEspacio,
  type FotoInventario,
} from "@/lib/retencion";

/* Limpieza de fotos vencidas y estado del almacenamiento (PRP-002 F5).

   Por qué es una acción y no un cron: el plan gratuito de Supabase no corre
   trabajos programados, y montar un servicio aparte para esto sería más
   infraestructura de la que el salón puede mantener. Un botón en el panel,
   con el aviso de cuándo conviene apretarlo, cumple la promesa de los 12
   meses sin agregarle una pieza más al negocio.

   Además es lo honesto con lo que se decidió: borrar evidencia lo hace un
   admin a conciencia, no un proceso invisible a las 3 de la mañana. */

export interface ResumenAlmacenamiento {
  espacio: EstadoEspacio;
  /** Cuántas fotos ya cumplieron los 12 meses y podrían borrarse. */
  vencidas: number;
  total: number;
  /** Vencidas que no se pueden borrar solas porque no tienen ruta. */
  sinRuta: number;
  error?: string;
}

/** Cuánto ocupa el bucket y cuántas fotos están vencidas. Solo lectura. */
export async function revisarAlmacenamiento(): Promise<ResumenAlmacenamiento> {
  const vacio: ResumenAlmacenamiento = {
    espacio: estadoEspacio(0),
    vencidas: 0,
    total: 0,
    sinRuta: 0,
  };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ...vacio, error: "Sesión expirada." };

  const { data: perfil } = await supabase
    .from("perfiles")
    .select("rol")
    .eq("id", user.id)
    .single();
  if (perfil?.rol !== "admin") return { ...vacio, error: "Solo un administrador." };

  const { data: filas } = await supabase
    .from("fotos_sesion")
    .select("id, created_at, ruta, url");

  const fotos = (filas as FotoInventario[]) ?? [];
  const plan = planDeLimpieza(fotos, new Date());

  /* El tamaño se calcula sumando los objetos del bucket. Es una llamada por
     carpeta, así que se acota a lo que el panel necesita mostrar: un número
     aproximado sirve para avisar, y un número exacto no cambiaría nada de lo
     que el equipo haría al respecto. */
  const usado = await tamanoAproximado(supabase);

  return {
    espacio: estadoEspacio(usado),
    vencidas: plan.ids.length,
    total: fotos.length,
    sinRuta: plan.sinRuta,
  };
}

/* eslint-disable @typescript-eslint/no-explicit-any -- el cliente llega
   genérico desde el servidor; acá solo se usa `.storage`. */
type Cliente = any;

async function tamanoAproximado(supabase: Cliente): Promise<number> {
  const { data: carpetas } = await supabase.storage.from(BUCKET_FOTOS).list("", {
    limit: 1000,
  });
  if (!carpetas) return 0;

  let total = 0;
  for (const carpeta of carpetas) {
    const { data: archivos } = await supabase.storage
      .from(BUCKET_FOTOS)
      .list(carpeta.name, { limit: 1000 });
    for (const archivo of archivos ?? []) {
      total += Number(archivo.metadata?.size ?? 0);
    }
  }
  return total;
}

export interface ResultadoLimpieza {
  success: boolean;
  /** Cuántas fotos se borraron de verdad. */
  borradas: number;
  error?: string;
}

/** Borra las fotos que ya cumplieron los 12 meses. Solo admin. */
export async function limpiarFotosVencidas(): Promise<ResultadoLimpieza> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, borradas: 0, error: "Sesión expirada." };

  const { data: perfil } = await supabase
    .from("perfiles")
    .select("rol")
    .eq("id", user.id)
    .single();
  // La policy de storage ya lo exige, pero fallar acá da un mensaje que se
  // entiende en vez de un 403 crudo desde Storage.
  if (perfil?.rol !== "admin") {
    return { success: false, borradas: 0, error: "Solo un administrador puede borrar fotos." };
  }

  const { data: filas, error: errLectura } = await supabase
    .from("fotos_sesion")
    .select("id, created_at, ruta, url");
  if (errLectura) return { success: false, borradas: 0, error: "No se pudo leer el listado." };

  const plan = planDeLimpieza((filas as FotoInventario[]) ?? [], new Date());
  if (plan.rutas.length === 0) {
    return { success: true, borradas: 0 };
  }

  /* Primero el archivo, después la fila. En este orden porque si falla el
     segundo paso queda una fila apuntando a un archivo que ya no está —
     molesto pero visible. Al revés quedaría el archivo ocupando espacio sin
     que nadie sepa que existe, que es exactamente el problema que esta
     limpieza viene a resolver. */
  const { data: borrados, error: errStorage } = await supabase.storage
    .from(BUCKET_FOTOS)
    .remove(plan.rutas);

  if (errStorage) {
    /* El detalle viaja en el mensaje a propósito. Un "no se pudo" a secas
       deja al equipo sin nada que reportar y a quien lo revise sin nada que
       investigar; esto lo ve solo un admin dentro del panel. */
    console.error("[retencion] Storage rechazó el borrado:", errStorage);
    return {
      success: false,
      borradas: 0,
      error: `No se pudieron borrar los archivos: ${errStorage.message}`,
    };
  }

  /* Solo se borran las filas cuyo archivo se fue de verdad. Si Storage
     eliminó 3 de 5, borrar las 5 filas perdería el rastro de 2 archivos que
     siguen ocupando espacio. */
  const rutasBorradas = new Set((borrados ?? []).map((o) => o.name));
  const idsConfirmados = ((filas as FotoInventario[]) ?? [])
    .filter((f) => f.ruta && rutasBorradas.has(f.ruta) && plan.ids.includes(f.id))
    .map((f) => f.id);

  if (idsConfirmados.length === 0) return { success: true, borradas: 0 };

  const { data: eliminadas, error: errFilas } = await supabase
    .from("fotos_sesion")
    .delete()
    .in("id", idsConfirmados)
    .select("id");

  if (errFilas) {
    return {
      success: false,
      borradas: 0,
      error: "Los archivos se borraron pero el registro no. Avise al desarrollador.",
    };
  }

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/fotos");
  return { success: true, borradas: eliminadas?.length ?? 0 };
}

/* Nota para el próximo que edite esto: un archivo "use server" SOLO puede
   exportar funciones async. Acá había un `export { MESES_RETENCION }` y el
   resultado fue un 500 en producción con el mensaje censurado — ni tsc ni
   el build lo detectan, solo aparece al abrir la página. Las constantes se
   importan desde lib/retencion.ts. */
