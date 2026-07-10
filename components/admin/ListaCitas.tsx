"use client";

import { useState } from "react";
import type { CitaSemana } from "@/lib/agenda";
import { ESTADO_COLOR, ESTADO_LABEL, type EstadoCita } from "@/lib/citas";
import { formatCLP } from "@/lib/reserva";
import { PanelCita } from "@/components/agenda/PanelCita";

interface ListaCitasProps {
  citas: CitaSemana[];
}

const FILTROS: (EstadoCita | "todas")[] = [
  "todas",
  "pendiente",
  "confirmada",
  "en_proceso",
  "completada",
  "cancelada",
];

/** Lista de citas del equipo con filtro por estado y panel de gestión. */
export function ListaCitas({ citas }: ListaCitasProps) {
  const [filtro, setFiltro] = useState<EstadoCita | "todas">("todas");
  const [citaAbierta, setCitaAbierta] = useState<CitaSemana | null>(null);

  const visibles =
    filtro === "todas" ? citas : citas.filter((c) => c.estado === filtro);

  return (
    <>
      <div className="mb-5 flex flex-wrap gap-2">
        {FILTROS.map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFiltro(f)}
            className={`rounded-full px-4 py-1.5 text-sm font-bold transition-colors ${
              filtro === f
                ? "bg-teal text-white"
                : "border-2 border-ink/10 text-ink-soft hover:border-teal/40"
            }`}
          >
            {f === "todas" ? "Todas" : ESTADO_LABEL[f]}
            {f !== "todas" && (
              <span className="ml-1.5 opacity-70">
                {citas.filter((c) => c.estado === f).length}
              </span>
            )}
          </button>
        ))}
      </div>

      {visibles.length === 0 ? (
        <p className="rounded-3xl bg-white py-10 text-center text-sm text-ink-soft shadow-sm">
          No hay citas {filtro === "todas" ? "registradas" : `en estado ${ESTADO_LABEL[filtro].toLowerCase()}`}.
        </p>
      ) : (
        <div className="space-y-3">
          {visibles.map((cita) => (
            <button
              key={cita.id}
              type="button"
              onClick={() => setCitaAbierta(cita)}
              className="flex w-full flex-wrap items-center gap-3 rounded-2xl bg-white p-4 text-left shadow-sm transition-transform hover:-translate-y-0.5"
            >
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-ink">{cita.titulo}</p>
                <p className="mt-0.5 text-xs text-ink-soft">
                  {cita.subtitulo || "Servicio sin definir"} · {cita.fecha}
                </p>
                {cita.sesion?.contacto_nombre && (
                  <p className="mt-0.5 text-xs text-ink-soft">
                    Contacto: {cita.sesion.contacto_nombre}
                  </p>
                )}
              </div>
              <div className="flex flex-col items-end gap-1">
                <span
                  className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${ESTADO_COLOR[cita.estado]}`}
                >
                  {ESTADO_LABEL[cita.estado]}
                </span>
                {cita.sesion?.precio_base != null && (
                  <span className="text-xs font-semibold text-teal-dark">
                    {formatCLP(cita.sesion.precio_base)}
                  </span>
                )}
              </div>
            </button>
          ))}
        </div>
      )}

      {citaAbierta && (
        <PanelCita cita={citaAbierta} onCerrar={() => setCitaAbierta(null)} />
      )}
    </>
  );
}
