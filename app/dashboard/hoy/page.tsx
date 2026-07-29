import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Footer } from "@/components/layout/Footer";
import { SiteMenu } from "@/components/layout/SiteMenu";
import { VistaJornada } from "@/components/admin/VistaJornada";
import { construirJornada, type FilaJornada } from "@/lib/jornada";
import { bloquesDelDia, hoyEnSantiago, sumarDias } from "@/lib/disponibilidad";
import { obtenerDisponibilidad } from "@/lib/disponibilidadDatos";
import { offsetNegocio } from "@/lib/agenda";
import { formatCLP } from "@/lib/reserva";

export const metadata: Metadata = {
  title: "Hoy en el local — Perrustingo",
  robots: { index: false, follow: false },
};

/* La jornada del local en una pantalla.

   El dashboard ya listaba "las citas de hoy", pero como una lista más entre
   otras. Esto es la pantalla que el equipo deja abierta mientras trabaja:
   qué viene ahora, con qué perrito, con qué cuidado, y el WhatsApp del
   cliente a un toque. Los huecos se muestran porque una hora libre a las 12
   todavía se puede vender. */

interface HoyPageProps {
  searchParams: Promise<{ dia?: string }>;
}

const FORMATO_FECHA = /^\d{4}-\d{2}-\d{2}$/;

function titulo(fecha: string): string {
  const d = new Date(`${fecha}T12:00:00Z`);
  return new Intl.DateTimeFormat("es-CL", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  }).format(d);
}

export default async function HoyPage({ searchParams }: HoyPageProps) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!supabaseUrl || supabaseUrl.includes("TU_PROYECTO")) redirect("/dashboard");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: perfil } = await supabase
    .from("perfiles")
    .select("rol, nombre")
    .eq("id", user.id)
    .single();
  if (!perfil || !["admin", "trabajador"].includes(perfil.rol)) redirect("/perfil");

  const { dia } = await searchParams;
  const hoy = hoyEnSantiago();
  const fecha = dia && FORMATO_FECHA.test(dia) ? dia : hoy;
  const esHoy = fecha === hoy;

  // Los límites del día en hora de Chile, con el offset real de esa fecha.
  const offset = offsetNegocio(fecha);
  const [{ data: filas }, disponibilidad] = await Promise.all([
    supabase
      .from("sesiones_equipo")
      .select(
        "id, estado, fecha_cita, servicio, precio_base, precio_final, contacto_nombre, contacto_telefono, detalle_form, notas_equipo"
      )
      .gte("fecha_cita", `${fecha}T00:00:00${offset}`)
      .lt("fecha_cita", `${sumarDias(fecha, 1)}T00:00:00${offsetNegocio(sumarDias(fecha, 1))}`)
      .order("fecha_cita"),
    obtenerDisponibilidad(supabase),
  ]);

  const jornada = construirJornada(
    (filas as FilaJornada[]) ?? [],
    bloquesDelDia(fecha, disponibilidad.tramos, disponibilidad.config)
  );

  const ayer = sumarDias(fecha, -1);
  const manana = sumarDias(fecha, 1);

  return (
    <>
      <SiteMenu />
      <main className="min-h-screen bg-cream px-5 pb-16 pt-28">
        <div className="mx-auto max-w-2xl">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-xs font-extrabold uppercase tracking-[0.22em] text-teal-dark">
                {esHoy ? "Hoy en el local" : "La jornada"}
              </p>
              <h1 className="mt-1 font-display text-3xl font-extrabold capitalize tracking-tight text-ink">
                {titulo(fecha)}
              </h1>
            </div>

            <div className="flex items-center gap-1">
              <a
                href={`/dashboard/hoy?dia=${ayer}`}
                aria-label="Día anterior"
                className="rounded-full bg-white px-3.5 py-2 text-sm font-bold text-ink-soft shadow-sm transition-colors hover:text-ink"
              >
                ‹
              </a>
              {!esHoy && (
                <a
                  href="/dashboard/hoy"
                  className="rounded-full bg-white px-4 py-2 text-xs font-bold text-teal-dark shadow-sm"
                >
                  Hoy
                </a>
              )}
              <a
                href={`/dashboard/hoy?dia=${manana}`}
                aria-label="Día siguiente"
                className="rounded-full bg-white px-3.5 py-2 text-sm font-bold text-ink-soft shadow-sm transition-colors hover:text-ink"
              >
                ›
              </a>
            </div>
          </div>

          {/* El resumen del día: lo que se espera facturar y lo que falta
              resolver. Dos números, no un tablero. */}
          <div className="mt-5 flex flex-wrap items-center gap-x-6 gap-y-2 rounded-3xl bg-teal px-6 py-5 text-white">
            <div>
              <p className="font-display text-3xl font-extrabold">
                {formatCLP(jornada.total)}
              </p>
              <p className="text-xs text-white/80">
                {jornada.citas} {jornada.citas === 1 ? "cita" : "citas"}
                {jornada.completadas > 0 && ` · ${jornada.completadas} lista${jornada.completadas === 1 ? "" : "s"}`}
              </p>
            </div>

            {jornada.pendientes > 0 && (
              <a
                href="/dashboard/citas"
                className="ml-auto rounded-full bg-white/20 px-4 py-2 text-xs font-bold text-white transition-colors hover:bg-white/30"
              >
                {jornada.pendientes} sin confirmar →
              </a>
            )}
          </div>

          <div className="mt-6">
            <VistaJornada jornada={jornada} fecha={fecha} esHoy={esHoy} />
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
