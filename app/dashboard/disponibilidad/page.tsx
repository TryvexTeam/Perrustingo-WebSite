import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Footer } from "@/components/layout/Footer";
import { SiteMenu } from "@/components/layout/SiteMenu";
import { EditorDisponibilidad } from "@/components/admin/EditorDisponibilidad";
import { EditorExcepciones } from "@/components/admin/EditorExcepciones";
import type { ExcepcionEditable } from "@/app/dashboard/disponibilidad/actions";
import { obtenerDisponibilidad } from "@/lib/disponibilidadDatos";
import { hoyEnSantiago } from "@/lib/disponibilidad";

export const metadata: Metadata = {
  title: "Disponibilidad — Panel Perrustingo",
  robots: { index: false, follow: false },
};

function SinSupabase() {
  return (
    <>
      <SiteMenu />
      <main className="min-h-screen bg-cream px-5 pb-16 pt-28">
        <div className="mx-auto max-w-5xl">
          <div className="rounded-2xl bg-[#fde4c8] px-5 py-4 text-sm font-semibold text-[#7a4d10]">
            🔧 Sin base de datos conectada — la disponibilidad se guarda en Supabase.
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}

export default async function DisponibilidadPage() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!supabaseUrl || supabaseUrl.includes("TU_PROYECTO")) return <SinSupabase />;

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: perfil } = await supabase
    .from("perfiles")
    .select("rol")
    .eq("id", user.id)
    .single();
  if (perfil?.rol !== "admin") redirect("/dashboard");

  const { config, tramos, capacidad } = await obtenerDisponibilidad(supabase);

  // Cuántos hay marcados de verdad — para explicar de dónde sale la
  // capacidad en vez de mostrar un número sin origen.
  const { count } = await supabase
    .from("perfiles")
    .select("id", { count: "exact", head: true })
    .eq("es_peluquero", true);

  /* Fechas bloqueadas. Se lee la TABLA y no la función pública porque esta
     es la pantalla del admin: acá sí corresponde ver la nota interna.
     Solo de hoy en adelante — las pasadas ya no afectan a nadie y llenarían
     la lista con vacaciones del año pasado. Si la migración 026 aún no está
     aplicada, `error` viene con 42P01 y la sección se muestra vacía en vez
     de tumbar toda la página de disponibilidad. */
  const { data: filasExcepciones } = await supabase
    .from("disponibilidad_excepciones")
    .select("fecha, mensaje, nota_interna")
    .gte("fecha", hoyEnSantiago())
    .order("fecha");

  const excepciones: ExcepcionEditable[] = (filasExcepciones ?? []).map((f) => ({
    fecha: (f.fecha as string).slice(0, 10),
    mensaje: (f.mensaje as string | null) ?? "",
    notaInterna: (f.nota_interna as string | null) ?? "",
  }));

  return (
    <>
      <SiteMenu />
      <main className="min-h-screen bg-cream px-5 pb-16 pt-28">
        <div className="mx-auto max-w-5xl">
          <p className="text-xs font-extrabold uppercase tracking-[0.22em] text-teal-dark">
            Panel del admin
          </p>
          <h1 className="mt-1 font-display text-3xl font-extrabold tracking-tight text-ink">
            Disponibilidad y horarios
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink-soft">
            Con cuánta anticipación se pide una cita, qué horas atiende el
            local cada día y cuántos perritos caben a la misma hora. El
            formulario de reserva ofrece exactamente lo que quede acá.
          </p>

          <div className="mt-8 space-y-6">
            <EditorDisponibilidad
              configInicial={config}
              tramosIniciales={tramos}
              peluqueros={count ?? 0}
              capacidad={capacidad}
            />
            <EditorExcepciones
              excepcionesIniciales={excepciones}
              mensajePorDefecto={config.mensajeDiaLleno}
            />
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
