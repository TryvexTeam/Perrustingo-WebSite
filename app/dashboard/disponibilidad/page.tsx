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
  const desdeHoy = hoyEnSantiago();

  const [{ data: filasExcepciones }, { data: filasBloqueos }, { data: filasPeluqueros }] =
    await Promise.all([
      supabase
        .from("disponibilidad_excepciones")
        .select("fecha, mensaje, nota_interna")
        .gte("fecha", desdeHoy)
        .order("fecha"),
      /* Los bloqueos nuevos (034/035), que sí llevan horas y dueño. Se leen
         aparte y se juntan más abajo: la tabla vieja sigue viva para lo que ya
         estaba cargado, y `excepciones_en_rango` lee de las dos. */
      supabase
        .from("bloqueos")
        .select("id, fecha, hora_inicio, hora_fin, peluquero_id, mensaje, nota_interna")
        .gte("fecha", desdeHoy)
        .order("fecha"),
      // Para poder tomarle el día a uno solo.
      supabase
        .from("perfiles")
        .select("id, nombre, apellido")
        .eq("es_peluquero", true)
        .order("nombre"),
    ]);

  const peluqueros = (filasPeluqueros ?? []).map((p) => ({
    id: p.id as string,
    nombre: [p.nombre, p.apellido].filter(Boolean).join(" ").trim() || "Sin nombre",
  }));
  const nombreDe = new Map(peluqueros.map((p) => [p.id, p.nombre]));

  const deBloqueos: ExcepcionEditable[] = (filasBloqueos ?? []).map((f) => ({
    id: f.id as string,
    fecha: (f.fecha as string).slice(0, 10),
    mensaje: (f.mensaje as string | null) ?? "",
    notaInterna: (f.nota_interna as string | null) ?? "",
    horaInicio: (f.hora_inicio as string | null) ?? undefined,
    horaFin: (f.hora_fin as string | null) ?? undefined,
    peluqueroId: (f.peluquero_id as string | null) ?? undefined,
    peluqueroNombre: f.peluquero_id ? nombreDe.get(f.peluquero_id as string) : undefined,
  }));

  /* Las de la tabla vieja que la 034 ya copió aparecerían dos veces. Se dejan
     fuera comparando por fecha: las copiadas son día completo y de todo el
     local, así que si ya hay un bloqueo así ese día, es la misma. */
  const yaEnBloqueos = new Set(
    deBloqueos.filter((b) => !b.horaInicio && !b.peluqueroId).map((b) => b.fecha)
  );

  const deLegado: ExcepcionEditable[] = (filasExcepciones ?? [])
    .map((f) => ({
      fecha: (f.fecha as string).slice(0, 10),
      mensaje: (f.mensaje as string | null) ?? "",
      notaInterna: (f.nota_interna as string | null) ?? "",
    }))
    .filter((e) => !yaEnBloqueos.has(e.fecha));

  const excepciones: ExcepcionEditable[] = [...deBloqueos, ...deLegado].sort(
    (a, b) =>
      a.fecha.localeCompare(b.fecha) ||
      (a.horaInicio ?? "").localeCompare(b.horaInicio ?? "")
  );

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
              /* Los días que de verdad se atienden, para que bloquear un
                 rango de vacaciones no llene la lista con domingos que ya
                 no tenían cupo. */
              diasAtendidos={[
                ...new Set(tramos.filter((t) => t.activo).map((t) => t.diaSemana)),
              ]}
              peluqueros={peluqueros}
            />
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
