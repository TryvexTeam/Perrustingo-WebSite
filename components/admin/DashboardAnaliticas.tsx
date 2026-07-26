import { ESTADO_COLOR, ESTADO_LABEL, type EstadoCita } from "@/lib/citas";
import { formatCLP } from "@/lib/reserva";
import type { Analiticas, RangoFechas } from "@/lib/analiticas";
import { GraficoIngresos } from "./GraficoIngresos";

/* Visión de negocio del rango elegido (PRP-001 Fase 4).

   Server component: son números ya calculados, no hay interacción. El único
   control (el rango) es un formulario que navega por GET, así que el filtro
   queda en la URL y se puede compartir o marcar. */

interface DashboardAnaliticasProps {
  datos: Analiticas;
  rango: RangoFechas;
}

const ORDEN_ESTADOS: EstadoCita[] = [
  "pendiente",
  "confirmada",
  "en_proceso",
  "completada",
  "cancelada",
];

function Tarjeta({
  titulo,
  valor,
  detalle,
  destacada,
}: {
  titulo: string;
  valor: string;
  detalle: string;
  destacada?: boolean;
}) {
  return (
    <div className={`rounded-3xl p-6 shadow-sm ${destacada ? "bg-teal text-white" : "bg-white"}`}>
      <p
        className={`text-xs font-extrabold uppercase tracking-[0.18em] ${
          destacada ? "text-white/80" : "text-teal-dark"
        }`}
      >
        {titulo}
      </p>
      <p
        className={`mt-2 font-display text-3xl font-extrabold ${
          destacada ? "text-white" : "text-ink"
        }`}
      >
        {valor}
      </p>
      <p className={`mt-1 text-xs ${destacada ? "text-white/80" : "text-ink-soft"}`}>{detalle}</p>
    </div>
  );
}

export function DashboardAnaliticas({ datos, rango }: DashboardAnaliticasProps) {
  const sinDatos = datos.total === 0;

  return (
    <div className="space-y-6">
      {/* Filtro de rango — form GET: el estado vive en la URL, no en React */}
      <form method="get" className="flex flex-wrap items-end gap-3 rounded-3xl bg-white p-5 shadow-sm">
        <div>
          <label
            htmlFor="desde"
            className="block text-[11px] font-extrabold uppercase tracking-wider text-ink-soft"
          >
            Desde
          </label>
          <input
            id="desde"
            name="desde"
            type="date"
            defaultValue={rango.desde}
            className="mt-1 rounded-xl border-2 border-transparent bg-cream px-3 py-2 text-sm font-semibold text-ink focus:border-teal focus:outline-none"
          />
        </div>
        <div>
          <label
            htmlFor="hasta"
            className="block text-[11px] font-extrabold uppercase tracking-wider text-ink-soft"
          >
            Hasta
          </label>
          <input
            id="hasta"
            name="hasta"
            type="date"
            defaultValue={rango.hasta}
            className="mt-1 rounded-xl border-2 border-transparent bg-cream px-3 py-2 text-sm font-semibold text-ink focus:border-teal focus:outline-none"
          />
        </div>
        <button
          type="submit"
          className="rounded-full bg-teal px-6 py-2.5 font-display text-sm font-extrabold text-white shadow-[0_3px_0_rgba(6,58,64,.25)] transition-[background-color,transform,box-shadow] duration-150 hover:bg-teal-dark active:translate-y-0.5 active:shadow-[0_1px_0_rgba(6,58,64,.25)]"
        >
          Ver
        </button>
        <p className="ml-auto text-xs text-ink-soft">
          {datos.total} {datos.total === 1 ? "cita" : "citas"} en el rango
        </p>
      </form>

      {sinDatos ? (
        // Un tablero de ceros no dice nada; conviene explicar por qué está
        // vacío para que nadie lo lea como "el negocio no vendió".
        <div className="rounded-3xl bg-white p-10 text-center shadow-sm">
          <p className="font-display text-lg font-extrabold text-ink">
            Todavía no hay citas en este rango
          </p>
          <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-ink-soft">
            Las métricas se calculan sobre las citas registradas. Cuando entren
            reservas por el formulario, o las cargue el equipo, aparecerán acá
            los ingresos, los servicios más pedidos y la tendencia por día.
          </p>
        </div>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Tarjeta
              titulo="Ingresos"
              valor={formatCLP(datos.ingresosRealizados)}
              detalle={`${datos.porEstado.completada} ${
                datos.porEstado.completada === 1 ? "cita completada" : "citas completadas"
              }`}
              destacada
            />
            <Tarjeta
              titulo="Agendado"
              valor={formatCLP(datos.ingresosProyectados)}
              detalle="Confirmadas y en proceso — aún no cobradas"
            />
            <Tarjeta
              titulo="Ticket promedio"
              valor={formatCLP(datos.ticketPromedio)}
              detalle="Por cita completada"
            />
            <Tarjeta
              titulo="Cancelación"
              valor={`${datos.tasaCancelacion}%`}
              detalle={`${datos.porEstado.cancelada} de ${datos.total} citas`}
            />
          </div>

          <div className="rounded-3xl bg-white p-6 shadow-sm">
            <h2 className="font-display text-lg font-extrabold text-ink">Citas por estado</h2>
            <ul className="mt-4 flex flex-wrap gap-2">
              {ORDEN_ESTADOS.map((estado) => (
                <li
                  key={estado}
                  className={`rounded-full px-3.5 py-1.5 text-xs font-bold ${ESTADO_COLOR[estado]}`}
                >
                  {ESTADO_LABEL[estado]}: {datos.porEstado[estado]}
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-3xl bg-white p-6 shadow-sm">
            <h2 className="font-display text-lg font-extrabold text-ink">
              Ingresos por día
            </h2>
            <p className="mt-1 text-xs text-ink-soft">
              Sin las canceladas. Pase el cursor por una barra para ver el detalle.
            </p>
            <GraficoIngresos datos={datos.porDia} />
          </div>

          <div className="rounded-3xl bg-white p-6 shadow-sm">
            <h2 className="font-display text-lg font-extrabold text-ink">
              Servicios más pedidos
            </h2>
            {datos.servicios.length === 0 ? (
              <p className="py-6 text-center text-sm text-ink-soft">
                No hay servicios registrados en este rango.
              </p>
            ) : (
              <ul className="mt-4 space-y-2">
                {datos.servicios.map((servicio) => {
                  const masPedido = datos.servicios[0].cantidad;
                  const ancho = Math.round((servicio.cantidad / masPedido) * 100);
                  return (
                    <li key={servicio.nombre} className="rounded-2xl bg-cream px-4 py-3">
                      <div className="flex flex-wrap items-baseline gap-2">
                        <span className="font-semibold text-ink">{servicio.nombre}</span>
                        <span className="text-xs text-ink-soft">
                          {servicio.cantidad} {servicio.cantidad === 1 ? "cita" : "citas"}
                        </span>
                        <span className="ml-auto font-display text-sm font-extrabold text-teal-dark">
                          {formatCLP(servicio.monto)}
                        </span>
                      </div>
                      <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-white">
                        <div className="h-full rounded-full bg-teal/70" style={{ width: `${ancho}%` }} />
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </>
      )}
    </div>
  );
}
