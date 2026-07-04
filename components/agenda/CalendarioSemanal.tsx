"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  CITAS_DEMO,
  COLORES_CITA,
  DIAS_SEMANA,
  HORA_APERTURA,
  HORA_CIERRE,
  fechaISO,
  formatearHora,
  lunesDe,
} from "@/lib/agenda";

/* Calendario semanal estilo Google Calendar — vista FE con citas demo.
   Clic en un hueco libre → /reserva con la fecha preseleccionada. */

const ALTO_HORA = 56; // px por hora
const TOTAL_HORAS = HORA_CIERRE - HORA_APERTURA;

const MESES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

function MiniMes({ referencia, hoy }: { referencia: Date; hoy: Date }) {
  const primerDia = new Date(referencia.getFullYear(), referencia.getMonth(), 1);
  const diasEnMes = new Date(referencia.getFullYear(), referencia.getMonth() + 1, 0).getDate();
  // Lunes = 0
  const offset = (primerDia.getDay() + 6) % 7;
  const celdas: (number | null)[] = [
    ...Array.from({ length: offset }, () => null),
    ...Array.from({ length: diasEnMes }, (_, i) => i + 1),
  ];

  const esHoy = (dia: number) =>
    hoy.getDate() === dia &&
    hoy.getMonth() === referencia.getMonth() &&
    hoy.getFullYear() === referencia.getFullYear();

  return (
    <div>
      <p className="mb-2 text-sm font-extrabold text-ink">
        {MESES[referencia.getMonth()]} {referencia.getFullYear()}
      </p>
      <div className="grid grid-cols-7 gap-y-1 text-center text-[11px]">
        {["L", "M", "M", "J", "V", "S", "D"].map((d, i) => (
          <span key={i} className="font-bold text-ink/40">{d}</span>
        ))}
        {celdas.map((dia, i) => (
          <span
            key={i}
            className={`mx-auto flex h-6 w-6 items-center justify-center rounded-full font-semibold ${
              dia !== null && esHoy(dia)
                ? "bg-teal text-white"
                : "text-ink-soft"
            }`}
          >
            {dia ?? ""}
          </span>
        ))}
      </div>
    </div>
  );
}

export function CalendarioSemanal() {
  const router = useRouter();
  const hoy = useMemo(() => new Date(), []);
  const [semanaOffset, setSemanaOffset] = useState(0);

  const lunes = useMemo(() => {
    const base = lunesDe(hoy);
    base.setDate(base.getDate() + semanaOffset * 7);
    return base;
  }, [hoy, semanaOffset]);

  const dias = useMemo(
    () =>
      DIAS_SEMANA.map((label, i) => {
        const fecha = new Date(lunes);
        fecha.setDate(lunes.getDate() + i);
        return { label, fecha };
      }),
    [lunes]
  );

  const esHoyVisible = (fecha: Date) =>
    fecha.getDate() === hoy.getDate() &&
    fecha.getMonth() === hoy.getMonth() &&
    fecha.getFullYear() === hoy.getFullYear();

  const horaAhora = hoy.getHours() + hoy.getMinutes() / 60;
  const lineaAhoraVisible = horaAhora >= HORA_APERTURA && horaAhora <= HORA_CIERRE;

  const irAReserva = (fecha: Date) => {
    router.push(`/reserva?fecha=${fechaISO(fecha)}`);
  };

  return (
    <div className="flex gap-6">
      {/* Sidebar — mini mes + leyenda (desktop) */}
      <aside className="hidden w-56 flex-none lg:block">
        <button
          type="button"
          onClick={() => router.push("/reserva")}
          className="mb-6 flex items-center gap-2 rounded-full bg-orange px-6 py-3 font-display text-sm font-extrabold text-teal-ink shadow-[0_3px_0_rgba(6,58,64,.25)] transition-[background-color,transform,box-shadow] duration-150 hover:bg-[#f7ab52] active:translate-y-0.5 active:shadow-[0_1px_0_rgba(6,58,64,.25)]"
        >
          <span className="text-lg leading-none">+</span> Reservar
        </button>

        <MiniMes referencia={lunes} hoy={hoy} />

        <div className="mt-8">
          <p className="mb-2 text-xs font-extrabold uppercase tracking-wide text-ink-soft">
            Servicios
          </p>
          <ul className="space-y-1.5">
            {Object.entries(COLORES_CITA).map(([key, c]) => (
              <li key={key} className="flex items-center gap-2 text-sm font-semibold text-ink">
                <span className={`h-3 w-3 rounded-[4px] ${c.dot}`} />
                {c.label}
              </li>
            ))}
          </ul>
        </div>
      </aside>

      {/* Calendario */}
      <div className="min-w-0 flex-1">
        {/* Toolbar */}
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => setSemanaOffset(0)}
            className="rounded-full border-2 border-ink/15 px-4 py-1.5 text-sm font-bold text-ink transition-colors hover:border-teal/50 hover:text-teal-dark"
          >
            Hoy
          </button>
          <div className="flex items-center gap-1">
            <button
              type="button"
              aria-label="Semana anterior"
              onClick={() => setSemanaOffset((s) => s - 1)}
              className="flex h-8 w-8 items-center justify-center rounded-full text-lg font-bold text-ink-soft transition-colors hover:bg-ink/5"
            >
              ‹
            </button>
            <button
              type="button"
              aria-label="Semana siguiente"
              onClick={() => setSemanaOffset((s) => s + 1)}
              className="flex h-8 w-8 items-center justify-center rounded-full text-lg font-bold text-ink-soft transition-colors hover:bg-ink/5"
            >
              ›
            </button>
          </div>
          <h2 className="font-display text-xl font-extrabold tracking-tight text-ink md:text-2xl">
            {MESES[lunes.getMonth()]} {lunes.getFullYear()}
          </h2>
          <button
            type="button"
            onClick={() => router.push("/reserva")}
            className="ml-auto rounded-full bg-teal px-5 py-2 font-display text-sm font-extrabold text-white shadow-[0_3px_0_rgba(6,58,64,.25)] transition-[background-color] hover:bg-teal-dark lg:hidden"
          >
            + Reservar
          </button>
        </div>

        <div className="overflow-x-auto rounded-3xl bg-white shadow-sm">
          <div className="min-w-[640px]">
            {/* Cabecera de días */}
            <div className="grid grid-cols-[56px_repeat(6,1fr)] border-b border-ink/10">
              <div />
              {dias.map(({ label, fecha }) => (
                <div key={label} className="flex flex-col items-center gap-1 py-3">
                  <span
                    className={`text-[11px] font-extrabold uppercase tracking-wide ${
                      esHoyVisible(fecha) ? "text-teal-dark" : "text-ink/40"
                    }`}
                  >
                    {label}
                  </span>
                  <span
                    className={`flex h-9 w-9 items-center justify-center rounded-full font-display text-lg font-extrabold ${
                      esHoyVisible(fecha) ? "bg-teal text-white" : "text-ink"
                    }`}
                  >
                    {fecha.getDate()}
                  </span>
                </div>
              ))}
            </div>

            {/* Grid horario */}
            <div
              className="relative grid grid-cols-[56px_repeat(6,1fr)]"
              style={{ height: TOTAL_HORAS * ALTO_HORA }}
            >
              {/* Columna de horas */}
              <div className="relative border-r border-ink/5">
                {Array.from({ length: TOTAL_HORAS }, (_, i) => (
                  <span
                    key={i}
                    className="absolute right-2 -translate-y-1/2 text-[10px] font-bold text-ink/35"
                    style={{ top: (i + 1) * ALTO_HORA }}
                  >
                    {formatearHora(HORA_APERTURA + i + 1)}
                  </span>
                ))}
              </div>

              {/* Columnas de días */}
              {dias.map(({ fecha }, colIdx) => (
                <div
                  key={colIdx}
                  className="relative cursor-pointer border-r border-ink/5 transition-colors hover:bg-sky/10"
                  onClick={() => irAReserva(fecha)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") irAReserva(fecha);
                  }}
                  aria-label={`Reservar el ${fechaISO(fecha)}`}
                >
                  {/* Líneas de hora */}
                  {Array.from({ length: TOTAL_HORAS }, (_, i) => (
                    <div
                      key={i}
                      className="absolute inset-x-0 border-t border-ink/5"
                      style={{ top: (i + 1) * ALTO_HORA }}
                    />
                  ))}

                  {/* Citas demo (solo semana actual) */}
                  {semanaOffset === 0 &&
                    CITAS_DEMO.filter((c) => c.diaSemana === colIdx).map((cita) => {
                      const c = COLORES_CITA[cita.color];
                      return (
                        <div
                          key={cita.id}
                          className={`absolute inset-x-1 overflow-hidden rounded-lg border-l-4 ${c.bg} ${c.border} px-2 py-1 shadow-sm transition-transform duration-150 hover:scale-[1.02]`}
                          style={{
                            top: (cita.horaInicio - HORA_APERTURA) * ALTO_HORA + 2,
                            height: cita.duracionHoras * ALTO_HORA - 4,
                          }}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <p className={`truncate text-[11px] font-extrabold ${c.text}`}>
                            {cita.titulo} · {cita.perro}
                          </p>
                          <p className={`truncate text-[10px] font-semibold ${c.text} opacity-80`}>
                            {formatearHora(cita.horaInicio)} –{" "}
                            {formatearHora(cita.horaInicio + cita.duracionHoras)}
                          </p>
                        </div>
                      );
                    })}

                  {/* Línea de "ahora" */}
                  {esHoyVisible(fecha) && lineaAhoraVisible && (
                    <div
                      className="pointer-events-none absolute inset-x-0 z-10"
                      style={{ top: (horaAhora - HORA_APERTURA) * ALTO_HORA }}
                    >
                      <div className="relative border-t-2 border-[#e0453a]">
                        <span className="absolute -left-1 -top-[5px] h-2 w-2 rounded-full bg-[#e0453a]" />
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        <p className="mt-3 text-center text-xs text-ink-soft">
          Haz clic en un día libre para reservar esa fecha ✨
        </p>
      </div>
    </div>
  );
}
