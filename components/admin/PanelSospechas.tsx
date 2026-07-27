"use client";

import { useState } from "react";
import { cancelarCitasEnBloque } from "@/app/dashboard/seguridad/actions";
import type { Alerta } from "@/lib/sospechas";

/* Las alertas de reservas raras, con el botón para cancelar en bloque.

   La pieza delicada acá no es el listado: es que cancelar seis citas de un
   click es irreversible desde el panel. Por eso el botón pide confirmación
   explícita en el mismo lugar (sin `confirm()` del navegador, que en móvil se
   ve como un error del sistema) y dice el número exacto que va a cancelar. */

interface PanelSospechasProps {
  alertas: Alerta[];
}

const ESTILO_NIVEL = {
  alta: {
    borde: "border-l-[#d64550]",
    chip: "bg-[#fbdbe7] text-[#7a1030]",
    etiqueta: "Revisar hoy",
  },
  media: {
    borde: "border-l-[#e8963c]",
    chip: "bg-[#fde4c8] text-[#7a4d10]",
    etiqueta: "Mirar sin apuro",
  },
} as const;

export function PanelSospechas({ alertas }: PanelSospechasProps) {
  const [confirmando, setConfirmando] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [aviso, setAviso] = useState("");
  const [resueltas, setResueltas] = useState<string[]>([]);

  const cancelar = async (alerta: Alerta) => {
    setOcupado(alerta.clave);
    setAviso("");
    const r = await cancelarCitasEnBloque(alerta.citas);
    setOcupado(null);
    setConfirmando(null);

    if (!r.success) {
      setAviso(r.error ?? "No se pudo cancelar.");
      return;
    }
    // `canceladas` viene del conteo real de filas afectadas, no de cuántas se
    // pidieron: si tres ya estaban atendidas, el número lo dice.
    setResueltas((previas) => [...previas, alerta.clave]);
    setAviso(
      r.error ??
        `Listo: ${r.canceladas} ${r.canceladas === 1 ? "cita cancelada" : "citas canceladas"}.`
    );
  };

  const pendientes = alertas.filter((a) => !resueltas.includes(a.clave));

  return (
    <div>
      {aviso && (
        <div
          role="status"
          className="mb-4 rounded-2xl bg-[#d5efe2] px-4 py-3 text-sm font-semibold text-teal-dark"
        >
          {aviso}
        </div>
      )}

      {pendientes.length === 0 ? (
        <div className="rounded-3xl bg-white p-10 text-center shadow-sm">
          <p className="font-display text-lg font-extrabold text-ink">
            {resueltas.length > 0 ? "Todo resuelto" : "Nada raro por acá"}
          </p>
          <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-ink-soft">
            Las reservas de estas horas se ven normales. Esta pantalla se
            actualiza sola cada vez que la abre.
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {pendientes.map((alerta) => {
            const estilo = ESTILO_NIVEL[alerta.nivel];
            const enDuda = confirmando === alerta.clave;

            return (
              <li
                key={alerta.clave}
                className={`rounded-2xl border-l-4 bg-white p-5 shadow-sm ${estilo.borde}`}
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <h3 className="font-display text-base font-extrabold text-ink">
                    {alerta.titulo}
                  </h3>
                  <span
                    className={`rounded-full px-3 py-1 text-[11px] font-bold ${estilo.chip}`}
                  >
                    {estilo.etiqueta}
                  </span>
                </div>

                <p className="mt-2 text-sm leading-relaxed text-ink-soft">
                  {alerta.detalle}
                </p>

                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <a
                    href="/dashboard/citas"
                    className="rounded-full bg-[#d5efe2] px-4 py-2 text-xs font-bold text-teal-dark transition-colors hover:bg-teal hover:text-white"
                  >
                    Ver las citas
                  </a>

                  {enDuda ? (
                    <>
                      <button
                        type="button"
                        onClick={() => cancelar(alerta)}
                        disabled={ocupado === alerta.clave}
                        className="rounded-full bg-[#d64550] px-5 py-2 text-xs font-extrabold text-white shadow-[0_2px_0_rgba(120,10,30,.3)] transition-[background-color,transform] duration-150 hover:bg-[#b83743] active:translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {ocupado === alerta.clave
                          ? "Cancelando…"
                          : `Sí, cancelar ${alerta.citas.length}`}
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmando(null)}
                        className="text-xs font-bold text-ink-soft underline underline-offset-2 hover:text-ink"
                      >
                        Mejor no
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setConfirmando(alerta.clave)}
                      className="rounded-full border-2 border-[#d64550] px-4 py-2 text-xs font-bold text-[#d64550] transition-colors hover:bg-[#fbdbe7]"
                    >
                      Cancelar las {alerta.citas.length}
                    </button>
                  )}
                </div>

                {enDuda && (
                  <p className="mt-3 rounded-xl bg-[#fbdbe7] px-3 py-2 text-xs leading-relaxed text-[#7a1030]">
                    Se cancelarán <strong>{alerta.citas.length} citas</strong> y se
                    borrarán del calendario. Esto no se puede deshacer desde el
                    panel. Si alguna es de un cliente real, se queda sin hora.
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
