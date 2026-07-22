"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { TARIFAS_DEFAULT, type Tarifas } from "@/lib/tarifas";
import type { TamanoKey } from "@/lib/reserva";

interface ResultadoAccion {
  success: boolean;
  error?: string;
}

/** Guarda el editor completo (precio base por tamaño + extras). Solo admin;
    RLS en `tarifas`/`tarifas_extras` refuerza lo mismo del lado de la DB. */
export async function guardarTarifasAction(tarifas: Tarifas): Promise<ResultadoAccion> {
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
  if (perfil?.rol !== "admin") {
    return { success: false, error: "Sin permisos." };
  }

  const tamanos = Object.keys(TARIFAS_DEFAULT.base) as TamanoKey[];
  const preciosValidos = tamanos.every((t) => {
    const v = tarifas.base[t];
    return Number.isInteger(v) && v >= 0;
  });
  if (
    !preciosValidos ||
    !Number.isInteger(tarifas.recargoMotas) ||
    tarifas.recargoMotas < 0 ||
    tarifas.recargoMotas > 100 ||
    !Number.isInteger(tarifas.accesorio) ||
    tarifas.accesorio < 0
  ) {
    return { success: false, error: "Valores fuera de rango." };
  }

  const actualizacionesBase = tamanos.map((tamano) =>
    supabase.from("tarifas").update({ precio: tarifas.base[tamano] }).eq("tamano", tamano)
  );
  const actualizacionExtras = supabase
    .from("tarifas_extras")
    .update({
      recargo_motas_pct: tarifas.recargoMotas,
      precio_accesorio: tarifas.accesorio,
      updated_at: new Date().toISOString(),
    })
    .eq("singleton", true);

  const resultados = await Promise.all([...actualizacionesBase, actualizacionExtras]);
  const fallo = resultados.find((r) => r.error);
  if (fallo) return { success: false, error: "No se pudo guardar." };

  revalidatePath("/dashboard/tarifas");
  revalidatePath("/");
  revalidatePath("/reserva");
  return { success: true };
}

/** Restaura los valores de fábrica (los mismos con que arrancó schema.sql). */
export async function restaurarTarifasAction(): Promise<ResultadoAccion> {
  return guardarTarifasAction(TARIFAS_DEFAULT);
}
