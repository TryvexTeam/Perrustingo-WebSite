"use client";

import { formatCLP, TAMANO_RANGOS, type TamanoKey } from "@/lib/reserva";
import { useTarifas } from "@/lib/tarifas";
import { useTramos } from "@/lib/tramosDatos";
import { precioDesdeEnRango } from "@/lib/tramos";

/* Muestra el precio vigente de un tamaño — si el admin lo cambió desde su
   panel, la landing lo refleja.

   LEE DE LOS TRAMOS, que es lo que de verdad cobra el formulario. Antes salía
   de la tabla vieja por tamaño y los números se separaron: la portada
   prometía "desde $20.000" para un perro de 8 kg y el formulario cobraba
   $25.000. No era por los recargos —esos se suman después y está bien que
   suban— sino porque el piso mismo había quedado desactualizado. Un cliente
   que ve un precio en la portada y se encuentra otro al reservar reclama en
   la puerta, con razón.

   Las cinco categorías de la landing se mantienen: se leen mejor que nueve
   filas. Lo que cambia es de dónde sale su "desde" — del tramo más barato que
   cae en ese rango de pesos.

   Server-render usa el valor de respaldo; el cliente hidrata con el real. */

export function PrecioDinamico({
  tamano,
  className = "",
}: {
  tamano: TamanoKey;
  className?: string;
}) {
  const tramos = useTramos();
  const tarifas = useTarifas();

  const [desde, hasta] = TAMANO_RANGOS[tamano];
  /* Sin tramos configurados cae en la tabla por tamaño, que sigue siendo la
     red del formulario: mostrar el mismo precio que se va a cobrar importa
     más que mostrar uno más bonito. */
  const precio = precioDesdeEnRango(tramos, desde, hasta) ?? tarifas.base[tamano];

  return <span className={className}>desde {formatCLP(precio)}</span>;
}
