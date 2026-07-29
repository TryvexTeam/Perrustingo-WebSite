import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SiteMenu } from "@/components/layout/SiteMenu";
import { Footer } from "@/components/layout/Footer";
import { ListaCitas } from "@/components/admin/ListaCitas";
import { filaACitaSemana, type CitaSemana } from "@/lib/agenda";
import { supabaseConfigurado, type SesionEquipo } from "@/lib/citas";

export const metadata: Metadata = {
  title: "Citas — Panel Perrustingo",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

/* En Next 16 los searchParams llegan como Promesa. */
interface CitasPageProps {
  searchParams: Promise<{ cita?: string }>;
}

export default async function CitasPage({ searchParams }: CitasPageProps) {
  /* `?cita=<id>` abre esa ficha directo. Lo usan el enlace "Ver ficha" de la
     jornada y el mensaje de WhatsApp de la reserva (PRP-002 F6). */
  const { cita: citaPedida } = await searchParams;
  if (!supabaseConfigurado()) {
    return (
      <>
        <SiteMenu />
        <main className="min-h-screen bg-cream px-5 pb-16 pt-28">
          <div className="mx-auto max-w-5xl">
            <div className="rounded-2xl bg-[#fde4c8] px-5 py-4 text-sm font-semibold text-[#7a4d10]">
              🔧 Sin base de datos conectada — la gestión de citas se activa al
              configurar Supabase.{" "}
              <Link href="/dashboard" className="underline underline-offset-2">
                Volver al panel
              </Link>
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
  if (!perfil || !["admin", "trabajador"].includes(perfil.rol)) {
    redirect("/perfil");
  }

  const { data } = await supabase
    .from("sesiones_equipo")
    .select(
      "id, estado, fecha_cita, fecha_fin, servicio, precio_base, precio_final, contacto_nombre, contacto_email, contacto_telefono, detalle_form, notas_cliente, notas_equipo, perro_id"
    )
    .order("created_at", { ascending: false })
    .limit(200);

  const citas = ((data ?? []) as SesionEquipo[])
    .map((fila) =>
      filaACitaSemana(
        { ...fila, fecha_cita: fila.fecha_cita ?? new Date().toISOString() },
        {
          titulo: fila.detalle_form?.nombrePerro ?? fila.contacto_nombre ?? "Cita",
          sesion: fila,
        }
      )
    )
    .filter((c): c is CitaSemana => c !== null);

  const pendientes = citas.filter((c) => c.estado === "pendiente").length;

  return (
    <>
      <SiteMenu />
      <main className="min-h-screen bg-cream px-5 pb-16 pt-28">
        <div className="mx-auto max-w-5xl">
          <div className="mb-6">
            <p className="text-xs font-extrabold uppercase tracking-[0.22em] text-teal-dark">
              Panel del equipo
            </p>
            <h1 className="mt-1 font-display text-3xl font-extrabold tracking-tight text-ink">
              Todas las citas
            </h1>
            <p className="mt-1 text-sm text-ink-soft">
              {pendientes > 0
                ? `${pendientes} solicitud${pendientes === 1 ? "" : "es"} esperando confirmación.`
                : "No hay solicitudes pendientes."}{" "}
              <Link href="/agenda" className="text-teal-dark underline underline-offset-2">
                Ver en calendario →
              </Link>
            </p>
          </div>

          <ListaCitas citas={citas} citaInicial={citaPedida} />
        </div>
      </main>
      <Footer />
    </>
  );
}
