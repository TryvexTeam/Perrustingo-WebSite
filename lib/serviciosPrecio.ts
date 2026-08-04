"use client";

/* Ajuste de precio por servicio.
 *
 * POR QUÉ EXISTE (4-ago): el precio salía del peso y sus ajustes, y
 * `calcularEstimado` no leía `data.servicio` en ningún momento. Un "Spa
 * completo" y un "Solo uñas" del mismo perro costaban exactamente lo mismo.
 *
 * NEUTRO DE FÁBRICA: la migración 035 siembra todos los servicios en 0, así que
 * la capacidad queda instalada y ningún precio se mueve hasta que el dueño
 * ponga sus valores en el panel. Ver migración 035. */

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { AjustePrecio } from "./reserva";

export interface AjusteServicio {
  slug: string;
  nombre: string;
  pct: number;
  monto: number;
}

const EVENTO = "perrustingo:servicios-precio-actualizados";

export function notificarServiciosPrecioActualizados(): void {
  window.dispatchEvent(new CustomEvent(EVENTO));
}

interface FilaServicio {
  slug: string;
  nombre: string;
  pct: number | string;
  monto: number | string;
}

/**
 * Lee los ajustes por servicio.
 *
 * `pct` llega como string cuando la columna es `numeric` — el driver de
 * Postgres no la convierte para no perder precisión. Sin el `Number(...)` un
 * "5" se sumaría como texto y el total saldría cualquier cosa.
 */
export async function obtenerServiciosPrecio(
  supabase: ReturnType<typeof createClient>
): Promise<AjusteServicio[]> {
  const { data, error } = await supabase
    .from("servicios_precio")
    .select("slug, nombre, pct, monto")
    .eq("activo", true);

  // Sin datos no se ajusta nada: el cliente paga el precio del peso, que es lo
  // que ya pagaba. Inventar un recargo por un error de red sería cobrarle de
  // más a alguien por una falla nuestra.
  if (error || !data) return [];

  return (data as FilaServicio[]).map((f) => ({
    slug: f.slug,
    nombre: f.nombre,
    pct: Number(f.pct),
    monto: Number(f.monto),
  }));
}

/**
 * El ajuste que aplica un servicio, listo para sumar al desglose.
 *
 * Devuelve `null` cuando no hay nada que cobrar — sin servicio elegido, sin
 * fila configurada, o con todo en 0. Un "+0%" en el desglose le dice al
 * cliente que le cobran algo por su servicio cuando no le cobran nada.
 */
export function ajusteDeServicio(
  servicios: readonly AjusteServicio[],
  slugONombre: string
): AjustePrecio | null {
  if (!slugONombre) return null;

  /* El formulario guarda el NOMBRE del servicio ("Baño completo"), no el slug,
     así que se busca por los dos. Comparar solo por slug dejaría el ajuste sin
     aplicarse nunca, en silencio. */
  const buscado = slugONombre.trim().toLowerCase();
  const s = servicios.find(
    (x) => x.slug.toLowerCase() === buscado || x.nombre.trim().toLowerCase() === buscado
  );

  if (!s) return null;
  if (s.pct === 0 && s.monto === 0) return null;

  return s.monto !== 0
    ? { etiqueta: s.nombre, pct: s.pct, monto: s.monto }
    : { etiqueta: s.nombre, pct: s.pct };
}

/** Hook: ajustes vigentes, reactivo a guardados del panel. */
export function useServiciosPrecio(): AjusteServicio[] {
  const [servicios, setServicios] = useState<AjusteServicio[]>([]);

  useEffect(() => {
    let cancelado = false;
    const supabase = createClient();

    const cargar = () => {
      void obtenerServiciosPrecio(supabase).then((s) => {
        if (!cancelado) setServicios(s);
      });
    };

    cargar();
    window.addEventListener(EVENTO, cargar);
    return () => {
      cancelado = true;
      window.removeEventListener(EVENTO, cargar);
    };
  }, []);

  return servicios;
}
