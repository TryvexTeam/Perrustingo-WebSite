import { formatCLP } from "@/lib/reserva";
import type { PuntoDia } from "@/lib/analiticas";

/* Serie diaria de citas e ingresos, en barras CSS.

   Sin librería de gráficos a propósito: son 30 barras y una dependencia de
   charting pesa más que todo el panel. Server component — no hay nada
   interactivo que justifique mandar JavaScript al navegador. */

interface GraficoIngresosProps {
  datos: PuntoDia[];
}

function etiquetaDia(fecha: string): string {
  // La fecha viene como YYYY-MM-DD (ya en hora local); se parte a mano para
  // que `new Date` no la interprete como UTC y muestre el día anterior.
  const [, mes, dia] = fecha.split("-");
  return `${dia}/${mes}`;
}

export function GraficoIngresos({ datos }: GraficoIngresosProps) {
  if (datos.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-ink-soft">
        No hay citas con fecha en este rango.
      </p>
    );
  }

  const maximo = Math.max(...datos.map((d) => d.monto), 1);

  return (
    <div className="mt-4 overflow-x-auto">
      <ul className="flex min-w-full items-end gap-1.5" style={{ height: "160px" }}>
        {datos.map((punto) => {
          const alto = Math.max(4, Math.round((punto.monto / maximo) * 140));
          return (
            <li
              key={punto.fecha}
              className="group flex min-w-[26px] flex-1 flex-col items-center justify-end gap-1"
              // El title da el dato exacto en hover; el texto bajo la barra
              // ya lleva la fecha, así que no queda solo en el hover.
              title={`${punto.fecha}: ${punto.cantidad} ${
                punto.cantidad === 1 ? "cita" : "citas"
              } · ${formatCLP(punto.monto)}`}
            >
              <span className="text-[10px] font-bold text-ink-soft opacity-0 transition-opacity group-hover:opacity-100">
                {punto.cantidad}
              </span>
              <div
                className="w-full rounded-t-lg bg-teal/70 transition-colors group-hover:bg-teal"
                style={{ height: `${alto}px` }}
              />
              <span className="text-[10px] font-semibold text-ink-soft">
                {etiquetaDia(punto.fecha)}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
