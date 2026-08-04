"use client";

/* Lectura de los tramos de altura desde Supabase, separada del dominio
   (lib/tramosAltura.ts) por el mismo criterio que `tramosDatos` vs `tramos`:
   el cálculo y las validaciones se prueban sin base ni red; aquí solo vive el
   acarreo de filas.

   Ver migración 033. La escritura está en app/dashboard/tarifas/actions.ts
   (server action, rol admin exigido) — este módulo es solo lectura. */

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { TRAMOS_ALTURA_INICIALES, type TramoAltura } from "./tramosAltura";

/** Fila cruda de `tramos_altura`. Se parsea, no se asume. */
interface FilaTramoAltura {
  id: string;
  nombre: string;
  desde_cm: number | string;
  pct: number | string;
}

const EVENTO = "perrustingo:tramos-altura-actualizados";

/** Avisa a los `useTramosAltura()` montados en esta pestaña que hay datos nuevos. */
export function notificarTramosAlturaActualizados(): void {
  window.dispatchEvent(new CustomEvent(EVENTO));
}

/**
 * Lee los tramos de altura activos.
 *
 * `desde_cm` y `pct` llegan como string cuando la columna es `numeric` — el
 * driver de Postgres no las convierte para no perder precisión. Sin el
 * `Number(...)` la comparación `alturaCm >= t.desdeCm` compararía número contra
 * texto y el orden saldría alfabético: "10" antes que "3".
 */
export async function obtenerTramosAltura(
  supabase: ReturnType<typeof createClient>
): Promise<TramoAltura[]> {
  const { data, error } = await supabase
    .from("tramos_altura")
    .select("id, nombre, desde_cm, pct")
    .eq("activo", true)
    .order("desde_cm", { ascending: true });

  /* Ante un fallo se devuelve la franja neutra, no una lista vacía. La
     diferencia con `tramosDatos` importa: allá el fallback SOSTIENE el precio
     base (sin tramos no hay cuánto cobrar), acá el fallback es no ajustar
     nada. Si la tabla no responde, el cliente paga el precio del peso y
     ninguno de los dos se lleva una sorpresa. */
  if (error || !data || data.length === 0) return [...TRAMOS_ALTURA_INICIALES];

  return (data as FilaTramoAltura[]).map((f) => ({
    id: f.id,
    nombre: f.nombre,
    desdeCm: Number(f.desde_cm),
    pct: Number(f.pct),
  }));
}

/** Hook: tramos de altura vigentes, reactivo a guardados del panel. */
export function useTramosAltura(): TramoAltura[] {
  const [tramos, setTramos] = useState<TramoAltura[]>([...TRAMOS_ALTURA_INICIALES]);

  useEffect(() => {
    let cancelado = false;
    const supabase = createClient();

    const cargar = () => {
      void obtenerTramosAltura(supabase).then((t) => {
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
