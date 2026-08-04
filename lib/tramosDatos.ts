"use client";

/* Lectura de los tramos de precio desde Supabase, separada del dominio
   (lib/tramos.ts) por el mismo criterio que `ofertasDatos` vs `ofertas`: el
   cálculo y las validaciones se prueban sin base ni red; aquí solo vive el
   acarreo de filas.

   Ver migración 032. La escritura está en app/dashboard/tarifas/actions.ts
   (server action, rol admin exigido) — este módulo es solo lectura. */

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { TRAMOS_INICIALES, type Tramo } from "./tramos";

/** Fila cruda de `tramos_precio`. Se parsea, no se asume. */
interface FilaTramo {
  id: string;
  nombre: string;
  desde_kg: number | string;
  precio: number;
}

const EVENTO = "perrustingo:tramos-actualizados";

/** Avisa a los `useTramos()` montados en esta pestaña que hay datos nuevos. */
export function notificarTramosActualizados(): void {
  window.dispatchEvent(new CustomEvent(EVENTO));
}

/**
 * Lee los tramos activos.
 *
 * `desde_kg` llega como string cuando la columna es `numeric` — el driver de
 * Postgres no la convierte a number para no perder precisión. Sin este
 * `Number(...)` la comparación `pesoKg >= t.desdeKg` compararía número contra
 * texto y el orden saldría alfabético: "10" antes que "3". Se ve bien en las
 * pruebas con un dígito y se rompe justo al pasar de 9 kg.
 */
export async function obtenerTramos(
  supabase: ReturnType<typeof createClient>
): Promise<Tramo[]> {
  const { data, error } = await supabase
    .from("tramos_precio")
    .select("id, nombre, desde_kg, precio")
    .eq("activo", true)
    .order("desde_kg", { ascending: true });

  // Ante un fallo se devuelven los tramos base en vez de una lista vacía: sin
  // tramos el formulario no puede cotizar, y dejar de cobrar por un error de red
  // es peor que cobrar la tabla de referencia. Los valores base son los mismos
  // que sembró la migración.
  if (error || !data || data.length === 0) return [...TRAMOS_INICIALES];

  return (data as FilaTramo[]).map((f) => ({
    id: f.id,
    nombre: f.nombre,
    desdeKg: Number(f.desde_kg),
    precio: Number(f.precio),
  }));
}

/**
 * Hook: los tramos vigentes.
 *
 * El evento refresca solo ESTA pestaña —`CustomEvent` no cruza a otras—, así
 * que sirve para que el panel se vea al día mientras el admin edita. Un
 * cliente con el formulario abierto en su teléfono sigue cotizando con los
 * tramos que cargó al entrar hasta que recargue. Es aceptable (un precio
 * cambia cada varios meses), pero decir lo contrario en un comentario, como
 * decía antes, es lo que hace que alguien dé por hecho una sincronización
 * que no existe.
 */
export function useTramos(): Tramo[] {
  const [tramos, setTramos] = useState<Tramo[]>([...TRAMOS_INICIALES]);

  useEffect(() => {
    let cancelado = false;
    const supabase = createClient();

    const cargar = () => {
      void obtenerTramos(supabase).then((t) => {
        if (!cancelado) setTramos(t);
      });
    };

    cargar();
    window.addEventListener(EVENTO, cargar);
    return () => {
      cancelado = true;
      window.removeEventListener(EVENTO, cargar);
    };
  }, []);

  return tramos;
}
