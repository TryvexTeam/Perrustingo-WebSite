"use client";

import { useState } from "react";
import { cambiarEstadoCita } from "@/app/dashboard/citas/actions";
import { ESTADO_LABEL, type EstadoCita } from "@/lib/citas";
import { formatCLP } from "@/lib/reserva";
import { enlaceWhatsApp, mensajeRecordatorio, type Jornada } from "@/lib/jornada";

/* La jornada del local, en una sola pantalla.

   El equipo no necesita "todas las citas" ni la semana completa: necesita
   saber qué viene ahora, con qué perrito, si hay que tener cuidado y poder
   avisarle al cliente sin salir de acá. Los huecos se muestran porque una
   hora libre a las 12 es una venta que todavía se puede hacer. */

interface VistaJornadaProps {
  jornada: Jornada;
  /** yyyy-mm-dd del día que se está mirando. */
  fecha: string;
  esHoy: boolean;
}

/* El siguiente paso natural de cada estado, con el verbo que usaría una
   persona. Sin menús: un toque y listo, que es como se trabaja con las
   manos mojadas. */
const SIGUIENTE: Partial<Record<EstadoCita, { estado: EstadoCita; texto: string }>> = {
  pendiente: { estado: "confirmada", texto: "Confirmar" },
  confirmada: { estado: "en_proceso", texto: "Entró" },
  en_proceso: { estado: "completada", texto: "Listo ✓" },
};

const COLOR_BORDE: Record<EstadoCita, string> = {
  pendiente: "border-l-[#e8963c]",
  confirmada: "border-l-[#54aede]",
  en_proceso: "border-l-[#9a76d6]",
  completada: "border-l-[#4daf7c]",
  cancelada: "border-l-zinc-300",
};

export function VistaJornada({ jornada, fecha, esHoy }: VistaJornadaProps) {
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [error, setError] = useState("");

  const avanzar = async (id: string, estado: EstadoCita) => {
    setOcupado(id);
    setError("");
    const resultado = await cambiarEstadoCita(id, estado);
    setOcupado(null);
    if (!resultado.success) setError(resultado.error ?? "No se pudo actualizar.");
  };

  if (jornada.items.length === 0) {
    return (
      <div className="rounded-3xl bg-white p-10 text-center shadow-sm">
        <p className="font-display text-lg font-extrabold text-ink">
          {esHoy ? "Hoy no hay nada agendado" : "Ese día no hay nada agendado"}
        </p>
        <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-ink-soft">
          Tampoco hay horarios configurados para este día. Si el local abre,
          revise los tramos en{" "}
          <a href="/dashboard/disponibilidad" className="font-bold text-teal-dark underline">
            Disponibilidad
          </a>
          .
        </p>
      </div>
    );
  }

  return (
    <div>
      {error && (
        <div
          role="alert"
          className="mb-4 rounded-2xl bg-[#fbdbe7] px-4 py-3 text-xs font-semibold text-[#7a1030]"
        >
          ⚠️ {error}
        </div>
      )}

      <ol className="space-y-2.5">
        {jornada.items.map((item) =>
          item.tipo === "hueco" ? (
            <li
              key={`hueco-${item.minutos}`}
              className="flex items-center gap-4 rounded-2xl border-2 border-dashed border-ink/10 px-5 py-3"
            >
              <span className="font-display text-base font-extrabold text-ink/30">
                {item.hora}
              </span>
              <span className="text-xs font-semibold text-ink/30">hora libre</span>
            </li>
          ) : (
            <li
              key={item.id}
              className={`rounded-2xl border-l-4 bg-white p-5 shadow-sm ${COLOR_BORDE[item.estado]} ${
                item.estado === "cancelada" ? "opacity-50" : ""
              }`}
            >
              <div className="flex flex-wrap items-start gap-x-4 gap-y-2">
                <span className="font-display text-xl font-extrabold text-ink">
                  {item.hora}
                </span>

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-baseline gap-x-2">
                    <span className="font-display text-lg font-extrabold text-ink">
                      {item.perro}
                    </span>
                    {item.detallePerro && (
                      <span className="text-xs text-ink-soft">{item.detallePerro}</span>
                    )}
                  </div>
                  <p className="mt-0.5 text-xs text-ink-soft">
                    {item.servicio}
                    {item.cliente && ` · ${item.cliente}`}
                  </p>
                </div>

                <div className="flex flex-col items-end gap-1">
                  <span className="font-display text-base font-extrabold text-teal-dark">
                    {formatCLP(item.precio)}
                  </span>
                  <span className="text-[11px] font-bold text-ink-soft">
                    {ESTADO_LABEL[item.estado]}
                  </span>
                </div>
              </div>

              {/* Seguridad primero: qué saber ANTES de agarrar al perrito. */}
              {item.alertas.length > 0 && (
                <ul className="mt-3 flex flex-wrap gap-1.5">
                  {item.alertas.map((alerta) => (
                    <li
                      key={alerta}
                      className="rounded-full bg-[#fde4c8] px-3 py-1 text-[11px] font-bold text-[#7a4d10]"
                    >
                      ⚠️ {alerta}
                    </li>
                  ))}
                </ul>
              )}

              {item.notasEquipo && (
                <p className="mt-2 rounded-xl bg-cream px-3 py-2 text-xs leading-relaxed text-ink-soft">
                  📝 {item.notasEquipo}
                </p>
              )}

              <div className="mt-3 flex flex-wrap items-center gap-2">
                {item.telefono && (
                  <a
                    href={enlaceWhatsApp(item.telefono, mensajeRecordatorio(item, esHoy))}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded-full bg-[#d5efe2] px-4 py-2 text-xs font-bold text-teal-dark transition-colors hover:bg-teal hover:text-white"
                  >
                    WhatsApp
                  </a>
                )}

                {SIGUIENTE[item.estado] && (
                  <button
                    type="button"
                    onClick={() => avanzar(item.id, SIGUIENTE[item.estado]!.estado)}
                    disabled={ocupado === item.id}
                    className="rounded-full bg-teal px-5 py-2 text-xs font-extrabold text-white shadow-[0_2px_0_rgba(6,58,64,.25)] transition-[background-color,transform] duration-150 hover:bg-teal-dark active:translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {ocupado === item.id ? "…" : SIGUIENTE[item.estado]!.texto}
                  </button>
                )}

                <a
                  href={`/dashboard/citas?cita=${item.id}`}
                  className="ml-auto text-xs font-bold text-ink-soft underline underline-offset-2 hover:text-ink"
                >
                  Ver ficha
                </a>
              </div>
            </li>
          )
        )}
      </ol>

      <p className="mt-4 text-center text-xs text-ink-soft">
        {fecha}
      </p>
    </div>
  );
}
