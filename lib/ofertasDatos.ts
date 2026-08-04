import type { SupabaseClient } from "@supabase/supabase-js";
import type { Oferta } from "./ofertas";

/* Lectura de ofertas desde Supabase, separada del dominio (lib/ofertas.ts)
   para que las reglas se puedan probar sin base de datos.
   La usan el formulario (cliente), la página de reserva (servidor) y el
   endpoint — por eso no lleva directiva. */

/* eslint-disable @typescript-eslint/no-explicit-any -- el cliente llega
   genérico: navegador y servidor lo construyen con tipos distintos y acá
   solo se usan `.from()` y `.rpc()`. */
type Cliente = SupabaseClient<any, any, any>;

interface FilaOferta {
  id: string;
  titulo: string;
  detalle: string;
  solo_con_cuenta: boolean;
  desde_visita: number;
  hasta_visita: number | null;
  tipo: "pct" | "monto";
  pct: number;
  monto: number | null;
  activa: boolean;
  vigente_desde: string | null;
  vigente_hasta: string | null;
}

export function filaAOferta(f: FilaOferta): Oferta {
  return {
    id: f.id,
    titulo: f.titulo,
    detalle: f.detalle,
    soloConCuenta: f.solo_con_cuenta,
    desdeVisita: f.desde_visita,
    hastaVisita: f.hasta_visita,
    tipo: f.tipo,
    pct: Number(f.pct),
    monto: f.monto,
    activa: f.activa,
    vigenteDesde: f.vigente_desde,
    vigenteHasta: f.vigente_hasta,
  };
}

const CAMPOS =
  "id, titulo, detalle, solo_con_cuenta, desde_visita, hasta_visita, tipo, pct, monto, activa, vigente_desde, vigente_hasta";

/** Todas las ofertas (incluidas las apagadas) — para el panel. */
export async function obtenerOfertas(supabase: Cliente): Promise<Oferta[]> {
  const { data } = await supabase.from("ofertas").select(CAMPOS).order("created_at");
  return ((data as FilaOferta[] | null) ?? []).map(filaAOferta);
}

/** Solo las activas — para la landing y el formulario. La vigencia por
    fecha se evalúa en el dominio (`estaVigente`), no acá: así una sola
    regla decide, y se puede probar sin base de datos. */
export async function obtenerOfertasActivas(supabase: Cliente): Promise<Oferta[]> {
  const { data } = await supabase
    .from("ofertas")
    .select(CAMPOS)
    .eq("activa", true)
    .order("created_at");
  return ((data as FilaOferta[] | null) ?? []).map(filaAOferta);
}

/** Cuántas visitas lleva un teléfono (para saber si le toca la oferta de
    "segunda cita"). La función de la DB devuelve solo un número. */
export async function visitasDeTelefono(supabase: Cliente, telefono: string): Promise<number> {
  if (!telefono.trim()) return 0;
  const { data } = await supabase.rpc("visitas_de_telefono", { telefono });
  return typeof data === "number" ? data : 0;
}
