"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { TARIFAS_DEFAULT, type Tarifas } from "@/lib/tarifas";
import type { FilaAjustePrecioAdmin } from "@/lib/ajustesPrecio";
import { admiteMontoFijo, TAMANOS, type TamanoKey, type TipoAjuste } from "@/lib/reserva";

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

  /* `.select()` en cada UPDATE para saber si tocó una fila de verdad. Bajo
     RLS —o si la fila del tamaño no existe— un UPDATE sin efecto no falla:
     devuelve éxito con 0 filas, y el panel diría "guardado" sobre precios
     que siguen iguales. Es el mismo defecto que ya mordió en citas (30-jul);
     el resto del panel ya verifica así y estas acciones se habían quedado
     atrás — justamente las que deciden cuánto paga un cliente. */
  const actualizacionesBase = tamanos.map((tamano) =>
    supabase
      .from("tarifas")
      .update({ precio: tarifas.base[tamano] })
      .eq("tamano", tamano)
      .select("tamano")
  );
  const actualizacionExtras = supabase
    .from("tarifas_extras")
    .update({
      recargo_motas_pct: tarifas.recargoMotas,
      precio_accesorio: tarifas.accesorio,
      updated_at: new Date().toISOString(),
    })
    .eq("singleton", true)
    .select("singleton");

  const resultados = await Promise.all([...actualizacionesBase, actualizacionExtras]);
  const fallo = resultados.find((r) => r.error);
  if (fallo) return { success: false, error: "No se pudo guardar." };
  if (resultados.some((r) => !r.data || r.data.length === 0)) {
    return { success: false, error: "Algún precio no se guardó (permisos o fila faltante)." };
  }

  revalidatePath("/dashboard/tarifas");
  revalidatePath("/");
  revalidatePath("/reserva");
  return { success: true };
}

/** Restaura los valores de fábrica (los mismos con que arrancó schema.sql). */
export async function restaurarTarifasAction(): Promise<ResultadoAccion> {
  return guardarTarifasAction(TARIFAS_DEFAULT);
}

/** Guarda las excepciones de un tamaño (migración 009). `pct: null` en una
    fila significa "este tamaño vuelve a usar el valor general" → se BORRA
    la excepción, no se guarda un 0: un override en 0 es un recargo
    apagado, heredar es otra cosa. Reemplaza el set completo del tamaño
    para que quitar una excepción sea posible en el mismo guardado. */
export async function guardarAjustesTamanoAction(
  tamano: string,
  filas: { categoria: string; clave: string; pct: number | null; tipo?: TipoAjuste; monto?: number | null }[]
): Promise<ResultadoAccion> {
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
  if (perfil?.rol !== "admin") return { success: false, error: "Sin permisos." };

  if (!(TAMANOS as readonly string[]).includes(tamano)) {
    return { success: false, error: "Tamaño inválido." };
  }

  const conValor = filas.filter((f) => f.pct !== null);
  const rangoOk = conValor.every((f) => {
    if (f.tipo === "monto") {
      // Un monto fijo se valida en pesos, no en porcentaje: los rangos de
      // uno no dicen nada del otro.
      return (
        typeof f.monto === "number" &&
        Number.isInteger(f.monto) &&
        f.monto >= -500000 &&
        f.monto <= 500000
      );
    }
    return typeof f.pct === "number" && !Number.isNaN(f.pct) && f.pct >= -100 && f.pct <= 200;
  });
  if (!rangoOk) return { success: false, error: "Valores fuera de rango." };

  const soloMontoPermitido = conValor.every(
    (f) => f.tipo !== "monto" || admiteMontoFijo(f.categoria)
  );
  if (!soloMontoPermitido) {
    return { success: false, error: "Las zonas sensibles solo admiten porcentaje." };
  }

  const aBorrar = filas.filter((f) => f.pct === null);

  const operaciones = [];
  if (conValor.length > 0) {
    operaciones.push(
      supabase.from("ajustes_precio_tamano").upsert(
        conValor.map((f) => ({
          categoria: f.categoria,
          clave: f.clave,
          tamano,
          // Solo sobrevive el valor del tipo declarado: el otro se limpia
          // (0 / null) para que la tabla no guarde un número que nadie
          // aplica y que el próximo lector interprete como vigente.
          pct: f.tipo === "monto" ? 0 : (f.pct as number),
          tipo: f.tipo ?? "pct",
          monto: f.tipo === "monto" ? (f.monto as number) : null,
          updated_at: new Date().toISOString(),
        })),
        { onConflict: "categoria,clave,tamano" }
      )
    );
  }
  for (const f of aBorrar) {
    operaciones.push(
      supabase
        .from("ajustes_precio_tamano")
        .delete()
        .eq("categoria", f.categoria)
        .eq("clave", f.clave)
        .eq("tamano", tamano)
    );
  }

  const resultados = await Promise.all(operaciones);
  const fallo = resultados.find((r) => r.error);
  if (fallo) {
    // Un rechazo sin explicación es indiagnosticable: 42501 acá significa
    // que la policy de admin no dejó pasar, no "no se pudo".
    const codigo = fallo.error?.code;
    return {
      success: false,
      error:
        codigo === "42501"
          ? "La base de datos rechazó el cambio (permisos)."
          : "No se pudo guardar.",
    };
  }

  revalidatePath("/dashboard/tarifas");
  revalidatePath("/reserva");
  revalidatePath("/");
  return { success: true };
}

/** Guarda los ajustes de precio (recargos por pelo/temperamento/zonas,
    descuentos). Solo `pct`/`etiqueta`/`activo` — el GRANT de columna en
    la migración 007 ya impide tocar `categoria`/`clave` aunque este
    código tuviera un bug, pero igual no los mandamos en el UPDATE. */
export async function guardarAjustesPrecioAction(
  filas: FilaAjustePrecioAdmin[]
): Promise<ResultadoAccion> {
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

  const valido = filas.every((f) => {
    const etiquetaOk = f.etiqueta.trim().length > 0 && f.etiqueta.length <= 60;
    if (!etiquetaOk) return false;
    if (f.tipo === "monto") {
      if (!admiteMontoFijo(f.categoria)) return false;
      return (
        typeof f.monto === "number" &&
        Number.isInteger(f.monto) &&
        f.monto >= -500000 &&
        f.monto <= 500000
      );
    }
    return typeof f.pct === "number" && !Number.isNaN(f.pct) && f.pct >= -100 && f.pct <= 200;
  });
  if (!valido) return { success: false, error: "Valores fuera de rango." };

  /* Mismo criterio que `guardarTarifasAction`: verificar el efecto, no la
     llamada. Una clave que no existe en la tabla haría un UPDATE de 0 filas
     que "termina bien" — y el recargo que el admin cree vigente no existiría. */
  const actualizaciones = filas.map((f) =>
    supabase
      .from("ajustes_precio")
      .update({
        pct: f.tipo === "monto" ? 0 : f.pct,
        etiqueta: f.etiqueta.trim(),
        activo: f.activo,
        tipo: f.tipo ?? "pct",
        monto: f.tipo === "monto" ? f.monto : null,
        updated_at: new Date().toISOString(),
      })
      .eq("categoria", f.categoria)
      .eq("clave", f.clave)
      .select("clave")
  );

  const resultados = await Promise.all(actualizaciones);
  const fallo = resultados.find((r) => r.error);
  if (fallo) return { success: false, error: "No se pudo guardar." };
  const sinEfecto = resultados.findIndex((r) => !r.data || r.data.length === 0);
  if (sinEfecto >= 0) {
    return {
      success: false,
      error: `No se guardó "${filas[sinEfecto].etiqueta.trim()}" (fila faltante o permisos).`,
    };
  }

  revalidatePath("/dashboard/tarifas");
  revalidatePath("/reserva");
  return { success: true };
}
