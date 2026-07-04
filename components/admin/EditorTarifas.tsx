"use client";

import { useEffect, useState } from "react";
import {
  guardarTarifas,
  leerTarifas,
  restaurarTarifas,
  TARIFAS_DEFAULT,
  type Tarifas,
} from "@/lib/tarifas";
import { formatCLP, TAMANO_LABELS, type TamanoKey } from "@/lib/reserva";
import { TAMANO_IMAGEN } from "@/lib/razas";
import { BreedAvatar } from "@/components/ui/BreedAvatar";

/* Editor de tarifas del admin — maqueta FE completa del flujo:
   editar → guardar → los templates públicos (Precios, FormReserva) se
   actualizan en vivo. La persistencia es localStorage hasta que exista la
   tabla `tarifas` en Supabase. */

const ORDEN: TamanoKey[] = ["toy", "pequeno", "mediano", "grande", "gigante"];

const TONO_FILA: Record<TamanoKey, string> = {
  toy: "bg-[#fbdbe7]",
  pequeno: "bg-[#d3e9fb]",
  mediano: "bg-[#e3d9f6]",
  grande: "bg-[#fde4c8]",
  gigante: "bg-[#d5efe2]",
};

export function EditorTarifas() {
  const [tarifas, setTarifas] = useState<Tarifas>(TARIFAS_DEFAULT);
  const [guardado, setGuardado] = useState(false);

  useEffect(() => {
    setTarifas(leerTarifas());
  }, []);

  const updBase = (tamano: TamanoKey, valor: string) => {
    const n = parseInt(valor, 10);
    setTarifas((prev) => ({
      ...prev,
      base: { ...prev.base, [tamano]: isNaN(n) ? 0 : n },
    }));
    setGuardado(false);
  };

  const guardar = () => {
    guardarTarifas(tarifas);
    setGuardado(true);
  };

  const restaurar = () => {
    restaurarTarifas();
    setTarifas(TARIFAS_DEFAULT);
    setGuardado(true);
  };

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_360px]">
      {/* Editor */}
      <div className="rounded-3xl bg-white p-7 shadow-sm">
        <div className="mb-5 flex items-center gap-2 rounded-2xl bg-[#fde4c8] px-4 py-3 text-xs font-semibold text-[#7a4d10]">
          <span aria-hidden="true">🔧</span>
          Modo maqueta — los cambios se guardan en este navegador. Con la base
          de datos conectada, se aplicarán para todos los visitantes.
        </div>

        <h2 className="font-display text-lg font-extrabold text-ink">
          Precio base por tamaño
        </h2>
        <div className="mt-4 space-y-3">
          {ORDEN.map((tamano) => (
            <div
              key={tamano}
              className={`flex flex-wrap items-center gap-x-3 gap-y-2 rounded-2xl ${TONO_FILA[tamano]} px-4 py-3`}
            >
              <BreedAvatar
                src={TAMANO_IMAGEN[tamano]}
                nombre={TAMANO_LABELS[tamano]}
                size="md"
              />
              <label
                htmlFor={`tarifa-${tamano}`}
                className="min-w-0 flex-1 text-sm font-bold leading-tight text-ink"
              >
                {TAMANO_LABELS[tamano]}
              </label>
              <div className="ml-auto flex items-center gap-1.5">
                <span className="text-sm font-bold text-ink-soft">$</span>
                <input
                  id={`tarifa-${tamano}`}
                  type="number"
                  min={0}
                  step={500}
                  value={tarifas.base[tamano]}
                  onChange={(e) => updBase(tamano, e.target.value)}
                  className="w-24 rounded-xl border-2 border-white bg-white/80 px-2.5 py-2 text-right text-sm font-extrabold text-ink focus:border-teal focus:outline-none"
                />
              </div>
            </div>
          ))}
        </div>

        <h2 className="mt-8 font-display text-lg font-extrabold text-ink">
          Extras
        </h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div className="rounded-2xl bg-cream px-4 py-3">
            <label htmlFor="recargo-motas" className="text-sm font-bold text-ink">
              Recargo por motas / nudos severos
            </label>
            <div className="mt-2 flex items-center gap-2">
              <input
                id="recargo-motas"
                type="number"
                min={0}
                max={100}
                value={tarifas.recargoMotas}
                onChange={(e) => {
                  const n = parseInt(e.target.value, 10);
                  setTarifas((prev) => ({ ...prev, recargoMotas: isNaN(n) ? 0 : n }));
                  setGuardado(false);
                }}
                className="w-20 rounded-xl border-2 border-ink/10 bg-white px-3 py-2 text-right text-sm font-extrabold text-ink focus:border-teal focus:outline-none"
              />
              <span className="text-sm font-bold text-ink-soft">%</span>
            </div>
          </div>
          <div className="rounded-2xl bg-cream px-4 py-3">
            <label htmlFor="precio-accesorio" className="text-sm font-bold text-ink">
              Pinches / accesorio (opcional)
            </label>
            <div className="mt-2 flex items-center gap-2">
              <span className="text-sm font-bold text-ink-soft">$</span>
              <input
                id="precio-accesorio"
                type="number"
                min={0}
                step={500}
                value={tarifas.accesorio}
                onChange={(e) => {
                  const n = parseInt(e.target.value, 10);
                  setTarifas((prev) => ({ ...prev, accesorio: isNaN(n) ? 0 : n }));
                  setGuardado(false);
                }}
                className="w-24 rounded-xl border-2 border-ink/10 bg-white px-3 py-2 text-right text-sm font-extrabold text-ink focus:border-teal focus:outline-none"
              />
            </div>
          </div>
        </div>

        <div className="mt-7 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={guardar}
            className="rounded-full bg-teal px-7 py-3 font-display text-sm font-extrabold text-white shadow-[0_3px_0_rgba(6,58,64,.25)] transition-[background-color,transform,box-shadow] duration-150 hover:bg-teal-dark active:translate-y-0.5 active:shadow-[0_1px_0_rgba(6,58,64,.25)]"
          >
            Guardar cambios
          </button>
          <button
            type="button"
            onClick={restaurar}
            className="rounded-full border-2 border-ink/15 px-6 py-3 font-display text-sm font-extrabold text-ink transition-colors hover:border-ink/30"
          >
            Restaurar valores originales
          </button>
          {guardado && (
            <span className="text-sm font-bold text-teal-dark">
              ✓ Guardado — la landing ya muestra los nuevos precios
            </span>
          )}
        </div>
      </div>

      {/* Vista previa del template público */}
      <aside>
        <div className="sticky top-28 rounded-3xl bg-white p-6 shadow-sm">
          <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-teal-dark">
            Vista previa
          </p>
          <h3 className="mt-1 font-display text-base font-extrabold text-ink">
            Así se ve en la landing
          </h3>
          <div className="mt-4 space-y-2.5">
            {ORDEN.map((tamano) => (
              <div
                key={tamano}
                className={`flex items-center justify-between rounded-2xl ${TONO_FILA[tamano]} px-4 py-2.5`}
              >
                <span className="text-xs font-bold text-ink">
                  {TAMANO_LABELS[tamano].split(" (")[0]}
                </span>
                <span className="font-display text-sm font-extrabold text-teal-ink">
                  desde {formatCLP(tarifas.base[tamano])}
                </span>
              </div>
            ))}
          </div>
          <p className="mt-4 text-[11px] leading-relaxed text-ink-soft">
            El formulario de reserva calculará el precio estimado con estos
            valores. Recargo por motas: {tarifas.recargoMotas}% · Accesorio:{" "}
            {formatCLP(tarifas.accesorio)}.
          </p>
        </div>
      </aside>
    </div>
  );
}
