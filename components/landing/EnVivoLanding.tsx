"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { DIAS_SEMANA, HORA_APERTURA, HORA_CIERRE } from "@/lib/agenda";

/* Etiqueta EN VIVO de la landing — actividad real del local sin datos
   personales (cuenta bloques de la vista pública agenda_ocupada).
   Sin base de datos conectada muestra cifras de demostración. */

const POLL_MS = 60_000;
const HORAS_SEMANA = (HORA_CIERRE - HORA_APERTURA) * DIAS_SEMANA.length;

interface Actividad {
  citasHoy: number;
  citasSemana: number;
}

const DEMO: Actividad = { citasHoy: 3, citasSemana: 12 };

function limitesDeHoy(): { inicio: Date; fin: Date } {
  const hoy = new Date();
  return {
    inicio: new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate()),
    fin: new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() + 1),
  };
}

function limitesDeSemana(): { inicio: Date; fin: Date } {
  const hoy = new Date();
  const dia = hoy.getDay();
  const lunes = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() + (dia === 0 ? -6 : 1 - dia));
  const fin = new Date(lunes);
  fin.setDate(lunes.getDate() + 7);
  return { inicio: lunes, fin };
}

export function EnVivoLanding() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const configurado = Boolean(url && !url.includes("TU_PROYECTO"));
  const [actividad, setActividad] = useState<Actividad>(DEMO);

  useEffect(() => {
    if (!configurado) return;

    let activo = true;
    const cargar = async () => {
      try {
        const { createClient } = await import("@/lib/supabase/client");
        const supabase = createClient();
        const hoy = limitesDeHoy();
        const semana = limitesDeSemana();

        const [resHoy, resSemana] = await Promise.all([
          supabase
            .from("agenda_ocupada")
            .select("id", { count: "exact", head: true })
            .gte("fecha_cita", hoy.inicio.toISOString())
            .lt("fecha_cita", hoy.fin.toISOString()),
          supabase
            .from("agenda_ocupada")
            .select("id", { count: "exact", head: true })
            .gte("fecha_cita", semana.inicio.toISOString())
            .lt("fecha_cita", semana.fin.toISOString()),
        ]);

        if (activo) {
          setActividad({
            citasHoy: resHoy.count ?? 0,
            citasSemana: resSemana.count ?? 0,
          });
        }
      } catch {
        /* red caída → se mantiene el último valor */
      }
    };

    void cargar();
    const intervalo = setInterval(() => void cargar(), POLL_MS);
    return () => {
      activo = false;
      clearInterval(intervalo);
    };
  }, [configurado]);

  const cuposLibres = Math.max(0, HORAS_SEMANA - actividad.citasSemana * 2);
  const hayCupos = cuposLibres > 4;

  return (
    <section aria-label="Actividad en vivo" className="bg-cream px-5 pb-2 pt-8">
      <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-center gap-x-5 gap-y-2 rounded-full bg-white px-6 py-3.5 shadow-sm">
        <span className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-[0.18em] text-[#e0453a]">
          <span className="relative flex h-2.5 w-2.5" aria-hidden="true">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#e0453a] opacity-60" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-[#e0453a]" />
          </span>
          En vivo
        </span>
        <span className="text-sm font-semibold text-ink">
          🐾 {actividad.citasHoy}{" "}
          {actividad.citasHoy === 1 ? "peludito agendado" : "peluditos agendados"} hoy
        </span>
        <span className="hidden text-ink/20 sm:inline" aria-hidden="true">·</span>
        <span className="text-sm font-semibold text-ink">
          {hayCupos ? "✅ Quedan cupos esta semana" : "🔥 Últimos cupos de la semana"}
        </span>
        <Link
          href="/agenda"
          className="-my-1.5 inline-flex items-center py-1.5 text-sm font-extrabold text-teal-dark underline-offset-2 hover:underline"
        >
          Ver agenda →
        </Link>
      </div>
    </section>
  );
}
