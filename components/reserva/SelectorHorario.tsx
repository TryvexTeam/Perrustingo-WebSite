"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  bloquesDisponibles,
  CONFIG_DEFAULT,
  type Bloque,
  type DisponibilidadConfig,
  type Tramo,
} from "@/lib/disponibilidad";
import { obtenerDisponibilidad, obtenerOcupacion } from "@/lib/disponibilidadDatos";
import { offsetNegocio } from "@/lib/agenda";

/* Horarios reales de un día (PRP-001 Fase 5).

   Antes el cliente elegía solo el día y la hora "se confirmaba después por
   WhatsApp", así que nadie sabía cuántas citas caían a la misma hora. Acá
   se ofrecen los bloques que el local atiende ese día, descontando los que
   ya están tomados. */

interface SelectorHorarioProps {
  fecha: string;
  valor: string | null;
  onChange: (inicio: string | null) => void;
}

export function SelectorHorario({ fecha, valor, onChange }: SelectorHorarioProps) {
  const [bloques, setBloques] = useState<Bloque[]>([]);
  const [capacidad, setCapacidad] = useState(1);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!fecha) return;
    let cancelado = false;
    setCargando(true);
    setError(false);

    (async () => {
      try {
        const supabase = createClient();
        const [{ config, tramos, capacidad }] = await Promise.all([
          obtenerDisponibilidad(supabase),
        ]);
        // Offset real de esa fecha (DST chileno), no uno fijo.
        const offset = offsetNegocio(fecha);
        const desde = `${fecha}T00:00:00${offset}`;
        const hasta = `${fecha}T23:59:59${offset}`;
        const ocupacion = await obtenerOcupacion(supabase, desde, hasta);
        if (cancelado) return;
        setCapacidad(capacidad);
        setBloques(bloquesDisponibles(fecha, tramos, config as DisponibilidadConfig, capacidad, ocupacion));
      } catch {
        if (!cancelado) setError(true);
      } finally {
        if (!cancelado) setCargando(false);
      }
    })();

    return () => {
      cancelado = true;
    };
  }, [fecha]);

  // Si cambia el día, el horario elegido antes ya no aplica: dejarlo
  // seleccionado mandaría una hora de otro día.
  useEffect(() => {
    if (valor && !valor.startsWith(fecha)) onChange(null);
  }, [fecha, valor, onChange]);

  if (!fecha) return null;

  if (cargando) {
    return (
      <p role="status" className="mt-3 text-xs font-semibold text-ink-soft">
        ⏳ Buscando horarios disponibles…
      </p>
    );
  }

  if (error) {
    // Sin horarios reales no se inventa una lista: se dice que no se pudo.
    return (
      <p role="alert" className="mt-3 text-xs font-semibold text-[#7a1030]">
        No pudimos consultar los horarios. Intente de nuevo en un momento.
      </p>
    );
  }

  if (bloques.length === 0) {
    return (
      <p className="mt-3 rounded-2xl bg-cream px-4 py-3 text-xs font-semibold text-ink-soft">
        Ese día no queda ningún horario libre. Pruebe con otra fecha 🐾
      </p>
    );
  }

  return (
    <div className="mt-3">
      <p className="text-xs font-extrabold uppercase tracking-wider text-ink-soft">
        Elija la hora
      </p>
      <div className="mt-2 flex flex-wrap gap-2">
        {bloques.map((bloque) => {
          const elegido = valor === bloque.inicio;
          return (
            <button
              key={bloque.inicio}
              type="button"
              onClick={() => onChange(bloque.inicio)}
              aria-pressed={elegido}
              className={`rounded-full px-4 py-2 text-sm font-bold transition-[background-color,color,transform] duration-150 active:scale-95 ${
                elegido ? "bg-teal text-white" : "bg-cream text-ink hover:bg-sky/60"
              }`}
            >
              {bloque.etiqueta}
              {/* "último" solo dice algo cuando de verdad quedan menos
                  cupos que la capacidad del día. Si el local atiende de a
                  uno, TODOS los horarios libres tienen un cupo y la
                  etiqueta sería ruido en cada botón. */}
              {capacidad > 1 && bloque.libres === 1 && !elegido && (
                <span className="ml-1.5 text-[10px] font-extrabold text-[#8a5312]">
                  último
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export { CONFIG_DEFAULT };
export type { Tramo };
