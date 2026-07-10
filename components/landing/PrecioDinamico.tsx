"use client";

import { formatCLP, type TamanoKey } from "@/lib/reserva";
import { useTarifas } from "@/lib/tarifas";

/* Muestra el precio vigente de un tamaño — si el admin lo cambió desde su
   panel, la landing lo refleja al instante. Server-render usa el default,
   el cliente hidrata con la tarifa dinámica. */

export function PrecioDinamico({
  tamano,
  className = "",
}: {
  tamano: TamanoKey;
  className?: string;
}) {
  const tarifas = useTarifas();
  return <span className={className}>desde {formatCLP(tarifas.base[tamano])}</span>;
}
