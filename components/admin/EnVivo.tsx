"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ESTADO_LABEL, type EstadoCita } from "@/lib/citas";

/* Sección "Datos reales en vivo" del panel — se actualiza sola cuando
   cambia la tabla `sesiones` (Supabase Realtime) con respaldo de sondeo
   cada 60 s. Sin base de datos conectada muestra la maqueta. */

interface Conteos {
  pendientes: number;
  confirmadasHoy: number;
  enProceso: number;
  completadasHoy: number;
}

const CONTEOS_DEMO: Conteos = {
  pendientes: 1,
  confirmadasHoy: 1,
  enProceso: 1,
  completadasHoy: 2,
};

const POLL_MS = 60_000;

function rangoHoy(): { inicio: string; fin: string } {
  const hoy = new Date();
  const inicio = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());
  const fin = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() + 1);
  return { inicio: inicio.toISOString(), fin: fin.toISOString() };
}

export function EnVivo() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const configurado = Boolean(url && !url.includes("TU_PROYECTO"));

  const [conteos, setConteos] = useState<Conteos>(CONTEOS_DEMO);
  const [ultimaActualizacion, setUltimaActualizacion] = useState<Date | null>(null);
  const [ultimoEvento, setUltimoEvento] = useState<string | null>(null);
  const cargandoRef = useRef(false);

  const cargar = useCallback(async () => {
    if (!configurado || cargandoRef.current) return;
    cargandoRef.current = true;
    try {
      const { createClient } = await import("@/lib/supabase/client");
      const supabase = createClient();
      const { inicio, fin } = rangoHoy();

      const [pendientes, confirmadas, enProceso, completadas] = await Promise.all([
        supabase
          .from("sesiones_equipo")
          .select("id", { count: "exact", head: true })
          .eq("estado", "pendiente"),
        supabase
          .from("sesiones_equipo")
          .select("id", { count: "exact", head: true })
          .eq("estado", "confirmada")
          .gte("fecha_cita", inicio)
          .lt("fecha_cita", fin),
        supabase
          .from("sesiones_equipo")
          .select("id", { count: "exact", head: true })
          .eq("estado", "en_proceso"),
        supabase
          .from("sesiones_equipo")
          .select("id", { count: "exact", head: true })
          .eq("estado", "completada")
          .gte("fecha_cita", inicio)
          .lt("fecha_cita", fin),
      ]);

      setConteos({
        pendientes: pendientes.count ?? 0,
        confirmadasHoy: confirmadas.count ?? 0,
        enProceso: enProceso.count ?? 0,
        completadasHoy: completadas.count ?? 0,
      });
      setUltimaActualizacion(new Date());
    } finally {
      cargandoRef.current = false;
    }
  }, [configurado]);

  useEffect(() => {
    if (!configurado) return;

    void cargar();
    const intervalo = setInterval(() => void cargar(), POLL_MS);

    let canal: { unsubscribe: () => void } | null = null;
    void (async () => {
      const { createClient } = await import("@/lib/supabase/client");
      const supabase = createClient();
      canal = supabase
        .channel("sesiones-en-vivo")
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "sesiones" },
          (payload) => {
            const nuevo = payload.new as { estado?: EstadoCita } | null;
            if (nuevo?.estado) {
              setUltimoEvento(`Cita ${ESTADO_LABEL[nuevo.estado].toLowerCase()}`);
            }
            void cargar();
          }
        )
        .subscribe();
    })();

    return () => {
      clearInterval(intervalo);
      canal?.unsubscribe();
    };
  }, [configurado, cargar]);

  const stats = [
    { label: "Pendientes", value: conteos.pendientes, color: "bg-[#fdeaf1]" },
    { label: "Confirmadas hoy", value: conteos.confirmadasHoy, color: "bg-[#e3f1fb]" },
    { label: "En proceso", value: conteos.enProceso, color: "bg-[#ece4f7]" },
    { label: "Completadas hoy", value: conteos.completadasHoy, color: "bg-[#d8f0e3]" },
  ];

  return (
    <section aria-label="Datos reales en vivo" className="mb-8">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <span className="relative flex h-2.5 w-2.5" aria-hidden="true">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-teal opacity-60" />
          <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-teal" />
        </span>
        <h2 className="font-display text-lg font-extrabold text-ink">
          Datos reales en vivo
        </h2>
        <span className="text-xs font-semibold text-ink-soft">
          {configurado
            ? ultimaActualizacion
              ? `Actualizado ${ultimaActualizacion.toLocaleTimeString("es-CL")}`
              : "Conectando…"
            : "Modo demostración — se activa al conectar la base de datos"}
        </span>
        {ultimoEvento && (
          <span className="rounded-full bg-sky/50 px-3 py-1 text-xs font-bold text-teal-ink">
            {ultimoEvento}
          </span>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {stats.map((stat) => (
          <div key={stat.label} className={`${stat.color} rounded-3xl p-5 text-center`}>
            <p className="font-display text-3xl font-extrabold text-ink">{stat.value}</p>
            <p className="mt-1 text-xs font-bold uppercase tracking-wide text-ink-soft">
              {stat.label}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
