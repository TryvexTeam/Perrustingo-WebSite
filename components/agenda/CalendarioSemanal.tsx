"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  COLORES_CITA,
  DIAS_SEMANA,
  HORA_APERTURA,
  HORA_CIERRE,
  demoComoCitasSemana,
  fechaISO,
  formatearHora,
  lunesDe,
  type CitaSemana,
} from "@/lib/agenda";
import { PanelCita } from "./PanelCita";

/* Calendario semanal estilo Google Calendar.
   - Sin `citas` → demo (CITAS_DEMO anclada a la semana actual).
   - Con `citas` → datos reales; en modoEquipo cada cita abre PanelCita.
   Clic en un hueco libre → /reserva con la fecha preseleccionada. */

interface CalendarioSemanalProps {
  /** Citas reales de sesiones/agenda_ocupada. Si falta, se muestra la demo. */
  citas?: CitaSemana[];
  /** Solicitudes 'pendiente' aún sin hora asignada (solo equipo). */
  pendientesSinHora?: CitaSemana[];
  /** Vista del equipo: citas clicables con panel de gestión. */
  modoEquipo?: boolean;
}

const ALTO_HORA = 56; // px por hora
const TOTAL_HORAS = HORA_CIERRE - HORA_APERTURA;

/* ── Ventana de días visibles ──────────────────────────────────────────────
   Antes el grid tenía `min-w-[640px]` fijo: en un teléfono las columnas
   quedaban cortadas a la mitad y, al deslizar, la columna de horas se iba
   con el scroll — quedaban días sin ninguna referencia horaria.

   Ahora el ancho de columna se deriva del ancho medido, de modo que en
   pantalla entran 1-6 días *completos*, nunca uno partido. La semana entera
   sigue estando, y se llega al resto deslizando: el scroll encaja día a día
   (scroll-snap) y la columna de horas queda congelada a la izquierda
   (position: sticky). Es el patrón de Apple Calendar en móvil. */
const ANCHO_GUTTER = 48; // columna de horas
const ANCHO_MIN_COLUMNA = 80; // mínimo por día para que el título de la cita se lea

function calcularDiasVisibles(anchoTrack: number): number {
  if (anchoTrack <= 0) return DIAS_SEMANA.length;
  const caben = Math.floor((anchoTrack - ANCHO_GUTTER) / ANCHO_MIN_COLUMNA);
  return Math.min(Math.max(caben, 1), DIAS_SEMANA.length);
}

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

export function CalendarioSemanal({
  citas,
  pendientesSinHora = [],
  modoEquipo = false,
}: CalendarioSemanalProps) {
  const router = useRouter();
  const hoy = useMemo(() => new Date(), []);
  const [semanaOffset, setSemanaOffset] = useState(0);
  const [citaAbierta, setCitaAbierta] = useState<CitaSemana | null>(null);

  const citasVisibles = useMemo(
    () => citas ?? demoComoCitasSemana(hoy),
    [citas, hoy]
  );

  const lunes = useMemo(() => {
    const base = lunesDe(hoy);
    base.setDate(base.getDate() + semanaOffset * 7);
    return base;
  }, [hoy, semanaOffset]);

  /* Ancho real del calendario → ancho de columna. Arranca sin medir (igual
     que el render del servidor: semana completa fluida) y se ajusta al medir. */
  const scrollRef = useRef<HTMLDivElement>(null);
  const [anchoTrack, setAnchoTrack] = useState(0);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const observer = new ResizeObserver(([entrada]) => {
      setAnchoTrack(entrada.contentRect.width);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const diasVisibles = calcularDiasVisibles(anchoTrack);
  const semanaCompleta = anchoTrack === 0 || diasVisibles >= DIAS_SEMANA.length;
  /* Cabe la semana entera → columnas fluidas y sin scroll. No cabe → columnas
     de ancho fijo (día completo, nunca partido) y se desliza para ver el resto. */
  const anchoColumna = semanaCompleta ? null : (anchoTrack - ANCHO_GUTTER) / diasVisibles;
  const plantillaColumnas = `${ANCHO_GUTTER}px repeat(${DIAS_SEMANA.length}, ${
    anchoColumna === null ? "minmax(0, 1fr)" : `${anchoColumna}px`
  })`;

  const dias = useMemo(
    () =>
      DIAS_SEMANA.map((label, i) => {
        const fecha = new Date(lunes);
        fecha.setDate(lunes.getDate() + i);
        return { label, fecha };
      }),
    [lunes]
  );

  /** Índice de un día dentro de la semana laboral (lunes = 0). Domingo no se atiende. */
  const indiceEnSemana = (fecha: Date) => (fecha.getDay() + 6) % 7;

  /** Deja el día `indice` pegado al borde izquierdo del área deslizable. */
  const desplazarADia = (indice: number, comportamiento: ScrollBehavior = "smooth") => {
    const el = scrollRef.current;
    if (!el || anchoColumna === null) return;
    const max = el.scrollWidth - el.clientWidth;
    el.scrollTo({
      left: Math.min(Math.max(indice, 0) * anchoColumna, max),
      behavior: comportamiento,
    });
  };

  /* En un teléfono, abrir mostrando hoy en lugar del lunes. Solo la primera
     vez que se mide: después manda lo que haga el usuario. */
  const yaCentrado = useRef(false);
  useEffect(() => {
    if (yaCentrado.current || anchoColumna === null) return;
    yaCentrado.current = true;
    const idxHoy = indiceEnSemana(hoy);
    if (idxHoy >= DIAS_SEMANA.length) return; // domingo
    desplazarADia(idxHoy - Math.floor(diasVisibles / 2), "auto");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [anchoColumna, hoy]);

  /** Primer día visible ahora mismo, según la posición del deslizamiento. */
  const diaVisibleActual = () => {
    const el = scrollRef.current;
    if (!el || anchoColumna === null) return 0;
    return Math.round(el.scrollLeft / anchoColumna);
  };

  /* Las flechas deslizan un bloque de días; al llegar al borde de la semana
     cruzan a la vecina entrando por su lado cercano — nunca un salto ciego. */
  const retroceder = () => {
    if (!semanaCompleta && diaVisibleActual() > 0) {
      desplazarADia(diaVisibleActual() - diasVisibles);
      return;
    }
    setSemanaOffset((s) => s - 1);
    desplazarADia(DIAS_SEMANA.length, "auto"); // se ancla al final por el clamp
  };

  const avanzar = () => {
    const ultimoInicio = DIAS_SEMANA.length - diasVisibles;
    if (!semanaCompleta && diaVisibleActual() < ultimoInicio) {
      desplazarADia(diaVisibleActual() + diasVisibles);
      return;
    }
    setSemanaOffset((s) => s + 1);
    desplazarADia(0, "auto");
  };

  const irHoy = () => {
    setSemanaOffset(0);
    const idxHoy = Math.min(indiceEnSemana(hoy), DIAS_SEMANA.length - 1);
    desplazarADia(idxHoy - Math.floor(diasVisibles / 2));
  };

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
        {/* Solicitudes pendientes sin hora (solo equipo) */}
        {modoEquipo && pendientesSinHora.length > 0 && (
          <div className="mb-4 rounded-2xl border-2 border-dashed border-yellow-300 bg-yellow-50 p-4">
            <p className="mb-2 text-xs font-extrabold uppercase tracking-wide text-yellow-800">
              Solicitudes por confirmar ({pendientesSinHora.length})
            </p>
            <div className="flex flex-wrap gap-2">
              {pendientesSinHora.map((cita) => (
                <button
                  key={cita.id}
                  type="button"
                  onClick={() => setCitaAbierta(cita)}
                  className="rounded-full bg-white px-4 py-2 text-sm font-bold text-ink shadow-sm transition-transform hover:-translate-y-0.5"
                >
                  {cita.titulo} · {cita.fecha}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Toolbar */}
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={irHoy}
            className="rounded-full border-2 border-ink/15 px-4 py-1.5 text-sm font-bold text-ink transition-colors hover:border-teal/50 hover:text-teal-dark"
          >
            Hoy
          </button>
          <div className="flex items-center gap-1">
            <button
              type="button"
              aria-label={semanaCompleta ? "Semana anterior" : "Días anteriores"}
              onClick={retroceder}
              className="flex h-9 w-9 items-center justify-center rounded-full text-lg font-bold text-ink-soft transition-colors hover:bg-ink/5"
            >
              ‹
            </button>
            <button
              type="button"
              aria-label={semanaCompleta ? "Semana siguiente" : "Días siguientes"}
              onClick={avanzar}
              className="flex h-9 w-9 items-center justify-center rounded-full text-lg font-bold text-ink-soft transition-colors hover:bg-ink/5"
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

        {/* Cabecera y cuerpo comparten UN solo contenedor de scroll: si cada
            uno tuviera el suyo, al deslizar se desincronizarían y aparecería
            un margen vacío al costado. */}
        <div
          ref={scrollRef}
          className="overflow-x-auto overscroll-x-contain rounded-3xl bg-white shadow-sm [scrollbar-width:thin]"
          style={{
            scrollSnapType: semanaCompleta ? undefined : "x mandatory",
            // el encaje se mide desde el borde de los días, no del calendario
            scrollPaddingLeft: ANCHO_GUTTER,
          }}
        >
          <div>
            {/* Cabecera de días */}
            <div
              className="grid border-b border-ink/10"
              style={{ gridTemplateColumns: plantillaColumnas }}
            >
              <div className="sticky left-0 z-20 bg-white" />
              {dias.map(({ label, fecha }) => (
                <div
                  key={label}
                  className="flex flex-col items-center gap-1 py-3"
                  style={{ scrollSnapAlign: semanaCompleta ? undefined : "start" }}
                >
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
              className="relative grid"
              style={{
                gridTemplateColumns: plantillaColumnas,
                height: TOTAL_HORAS * ALTO_HORA,
              }}
            >
              {/* Columna de horas — congelada: al deslizar, ningún día queda
                  sin su referencia horaria. */}
              <div className="sticky left-0 z-20 border-r border-ink/5 bg-white">
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
                  style={{ scrollSnapAlign: semanaCompleta ? undefined : "start" }}
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

                  {/* Citas del día */}
                  {citasVisibles
                    .filter((c) => c.fecha === fechaISO(fecha))
                    .map((cita) => {
                      const c = COLORES_CITA[cita.color];
                      const esPendiente = cita.estado === "pendiente";
                      return (
                        <div
                          key={cita.id}
                          className={`absolute inset-x-1 overflow-hidden rounded-lg border-l-4 ${c.bg} ${c.border} px-2 py-1 shadow-sm transition-transform duration-150 hover:scale-[1.02] ${
                            esPendiente ? "border-dashed opacity-80" : ""
                          } ${modoEquipo ? "cursor-pointer" : ""}`}
                          style={{
                            top: (cita.horaInicio - HORA_APERTURA) * ALTO_HORA + 2,
                            height: cita.duracionHoras * ALTO_HORA - 4,
                          }}
                          onClick={(e) => {
                            e.stopPropagation();
                            if (modoEquipo) setCitaAbierta(cita);
                          }}
                          role={modoEquipo ? "button" : undefined}
                          aria-label={
                            modoEquipo ? `Ver detalle de ${cita.titulo}` : undefined
                          }
                        >
                          <p className={`truncate text-[11px] font-extrabold ${c.text}`}>
                            {cita.titulo}
                            {esPendiente && " · por confirmar"}
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

      {modoEquipo && citaAbierta && (
        <PanelCita cita={citaAbierta} onCerrar={() => setCitaAbierta(null)} />
      )}
    </div>
  );
}
