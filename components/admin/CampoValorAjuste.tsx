"use client";

import { admiteMontoFijo, type TipoAjuste } from "@/lib/reserva";

/* Campo de valor de un agregado: número + selector de cómo se cobra.

   Un mismo agregado puede cobrarse como porcentaje (escala con el tamaño
   del perro) o como monto fijo en pesos (mismo costo para todos). Vive en
   su propio componente porque lo usan los dos editores — el general y el
   modal por tamaño — y si divergieran, el admin vería reglas distintas
   para la misma decisión. */

interface CampoValorAjusteProps {
  id: string;
  categoria: string;
  tipo: TipoAjuste;
  pct: number;
  monto: number | null;
  disabled?: boolean;
  /** Estilo apagado para valores que solo se heredan (modal por tamaño). */
  atenuado?: boolean;
  onCambiar: (cambios: { tipo: TipoAjuste; pct: number; monto: number | null }) => void;
}

export function CampoValorAjuste({
  id,
  categoria,
  tipo,
  pct,
  monto,
  disabled,
  atenuado,
  onCambiar,
}: CampoValorAjusteProps) {
  const esMonto = tipo === "monto";
  const puedeMonto = admiteMontoFijo(categoria);
  const valor = esMonto ? (monto ?? 0) : pct;

  const cambiarValor = (texto: string) => {
    const n = texto === "" ? 0 : parseFloat(texto);
    const limpio = Number.isNaN(n) ? 0 : n;
    onCambiar(
      esMonto ? { tipo, pct, monto: Math.round(limpio) } : { tipo, pct: limpio, monto }
    );
  };

  const cambiarTipo = (nuevo: TipoAjuste) => {
    // Al cambiar de forma NO se convierte el número: un 25 que pasa a pesos
    // no son $25, y adivinar la equivalencia sería inventar un precio. Se
    // arranca en 0 para que el admin escriba el valor real que quiere.
    if (nuevo === "monto") onCambiar({ tipo: "monto", pct, monto: monto ?? 0 });
    else onCambiar({ tipo: "pct", pct, monto: null });
  };

  return (
    <div className="ml-auto flex items-center gap-1.5">
      {esMonto && <span className="text-sm font-bold text-ink-soft">$</span>}
      <input
        id={id}
        type="number"
        step={esMonto ? 500 : 1}
        value={valor}
        onChange={(e) => cambiarValor(e.target.value)}
        disabled={disabled}
        className={`rounded-xl border-2 px-2.5 py-1.5 text-right text-sm font-extrabold focus:border-teal focus:outline-none disabled:opacity-50 ${
          esMonto ? "w-24" : "w-20"
        } ${
          atenuado
            ? "border-transparent bg-white/60 text-ink-soft"
            : "border-white bg-white text-ink"
        }`}
      />
      {puedeMonto ? (
        <>
          <label htmlFor={`${id}-tipo`} className="sr-only">
            Cobrar como porcentaje o monto fijo
          </label>
          <select
            id={`${id}-tipo`}
            value={tipo}
            onChange={(e) => cambiarTipo(e.target.value as TipoAjuste)}
            disabled={disabled}
            className="rounded-xl border-2 border-white bg-white px-2 py-1.5 text-sm font-bold text-ink focus:border-teal focus:outline-none disabled:opacity-50"
          >
            <option value="pct">%</option>
            <option value="monto">$ fijo</option>
          </select>
        </>
      ) : (
        <span className="text-sm font-bold text-ink-soft">%</span>
      )}
    </div>
  );
}
