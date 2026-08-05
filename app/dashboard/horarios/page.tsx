import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Footer } from "@/components/layout/Footer";
import { SiteMenu } from "@/components/layout/SiteMenu";
import { EditorHorarios, type PeluqueroConHorario } from "@/components/admin/EditorHorarios";

export const metadata: Metadata = {
  title: "Horarios del equipo — Panel Perrustingo",
  robots: { index: false, follow: false },
};

export default async function HorariosPage() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!supabaseUrl || supabaseUrl.includes("TU_PROYECTO")) {
    return (
      <>
        <SiteMenu />
        <main className="min-h-screen bg-cream px-5 pb-16 pt-28">
          <div className="mx-auto max-w-5xl">
            <div className="rounded-2xl bg-[#fde4c8] px-5 py-4 text-sm font-semibold text-[#7a4d10]">
              🔧 Sin base de datos conectada — los horarios se guardan en Supabase.
            </div>
          </div>
        </main>
        <Footer />
      </>
    );
  }

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

  const { data: filasPeluqueros } = await supabase
    .from("perfiles")
    .select("id, nombre, apellido")
    .eq("es_peluquero", true)
    .order("nombre");

  /* Si la 039 todavía no está aplicada, `error` viene con 42P01 y la pantalla
     se muestra con todos "siguiendo el horario del local" —que es la verdad—
     en vez de caerse. Guardar sí avisará que falta la migración. */
  const { data: filasHorarios } = await supabase
    .from("horarios_peluquero")
    .select("id, peluquero_id, dia_semana, hora_inicio, hora_fin, activo")
    .order("dia_semana");

  const porPersona = new Map<string, PeluqueroConHorario["tramos"]>();
  for (const f of filasHorarios ?? []) {
    const lista = porPersona.get(f.peluquero_id as string) ?? [];
    lista.push({
      id: f.id as string,
      diaSemana: f.dia_semana as number,
      horaInicio: f.hora_inicio as string,
      horaFin: f.hora_fin as string,
      activo: (f.activo as boolean) ?? true,
    });
    porPersona.set(f.peluquero_id as string, lista);
  }

  const peluqueros: PeluqueroConHorario[] = (filasPeluqueros ?? []).map((p) => ({
    id: p.id as string,
    nombre: [p.nombre, p.apellido].filter(Boolean).join(" ").trim() || "Sin nombre",
    tramos: porPersona.get(p.id as string) ?? [],
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
            Horarios del equipo
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink-soft">
            Qué días trabaja cada persona y entre qué horas, con su colación. El
            formulario de reserva ofrece cupo según quién esté trabajando a esa
            hora: si a las 10 solo hay una persona, a las 10 cabe una cita.
          </p>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink-soft">
            Para algo puntual —&ldquo;este martes llega más tarde&rdquo;, una hora
            médica, vacaciones— no toque esta pantalla: use los bloqueos en{" "}
            <strong>Disponibilidad</strong>, que van por fecha. Acá se escribe lo
            que se repite todas las semanas.
          </p>

          <div className="mt-8">
            <EditorHorarios peluqueros={peluqueros} />
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
