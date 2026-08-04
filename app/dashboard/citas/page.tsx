import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SiteMenu } from "@/components/layout/SiteMenu";
import { Footer } from "@/components/layout/Footer";
import { ListaCitas } from "@/components/admin/ListaCitas";
import {
  filaACitaSemana,
  resolverFiltroAgenda,
  type CitaSemana,
  type SesionEquipoConDueno,
} from "@/lib/agenda";
import { supabaseConfigurado } from "@/lib/citas";

export const metadata: Metadata = {
  title: "Citas — Panel Perrustingo",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

/* En Next 16 los searchParams llegan como Promesa. */
interface CitasPageProps {
  searchParams: Promise<{ cita?: string; ver?: string }>;
}

export default async function CitasPage({ searchParams }: CitasPageProps) {
  /* `?cita=<id>` abre esa ficha directo. Lo usan el enlace "Ver ficha" de la
     jornada y el mensaje de WhatsApp de la reserva (PRP-002 F6).
     `?ver=mias|todo` es el interruptor de agenda del admin — misma forma que
     el rango de /dashboard/analiticas, para que sobreviva a la recarga. */
  const { cita: citaPedida, ver } = await searchParams;
  const filtro = resolverFiltroAgenda(ver);
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

  const esAdmin = perfil.rol === "admin";

  /* Un trabajador recibe solo lo suyo y lo sin asignar porque así lo recorta
     la vista `sesiones_equipo` (migración 038) — no depende de este código.
     Este `.or()` es la preferencia del admin, y va en la consulta: filtrar en
     el render dejaría viajar por la red las citas del colega. */
  let consulta = supabase
    .from("sesiones_equipo")
    .select(
      "id, estado, fecha_cita, fecha_fin, servicio, precio_base, precio_final, contacto_nombre, contacto_email, contacto_telefono, detalle_form, notas_cliente, notas_equipo, perro_id, aviso_listo_en, peluquero_id"
    );

  if (filtro === "mias") {
    consulta = consulta.or(`peluquero_id.eq.${user.id},peluquero_id.is.null`);
  }

  const { data } = await consulta
    .order("created_at", { ascending: false })
    .limit(200);

  const citas = ((data ?? []) as SesionEquipoConDueno[])
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
              {esAdmin && filtro === "todo" ? "Todas las citas" : "Mis citas"}
            </h1>
            {esAdmin ? (
              <div
                className="mt-3 inline-flex items-center gap-1 rounded-full border-2 border-ink/10 p-1"
                role="group"
                aria-label="Qué citas mostrar"
              >
                <Link
                  href="/dashboard/citas"
                  aria-current={filtro === "todo" ? "page" : undefined}
                  className={`rounded-full px-3 py-1 text-sm font-bold transition-colors ${
                    filtro === "todo"
                      ? "bg-teal text-white"
                      : "text-ink-soft hover:bg-ink/5 hover:text-ink"
                  }`}
                >
                  Todo el local
                </Link>
                <Link
                  href="/dashboard/citas?ver=mias"
                  aria-current={filtro === "mias" ? "page" : undefined}
                  className={`rounded-full px-3 py-1 text-sm font-bold transition-colors ${
                    filtro === "mias"
                      ? "bg-teal text-white"
                      : "text-ink-soft hover:bg-ink/5 hover:text-ink"
                  }`}
                >
                  Solo lo mío
                </Link>
              </div>
            ) : (
              <p className="mt-1 text-sm text-ink-soft">
                Tus citas y las que todavía no tienen peluquero asignado.
              </p>
            )}
            <p className="mt-1 text-sm text-ink-soft">
              {pendientes > 0
                ? `${pendientes} solicitud${pendientes === 1 ? "" : "es"} esperando confirmación.`
                : "No hay solicitudes pendientes."}{" "}
              <Link href="/agenda" className="text-teal-dark underline underline-offset-2">
                Ver en calendario →
              </Link>
            </p>
          </div>

          <ListaCitas citas={citas} citaInicial={citaPedida} esAdmin={esAdmin} />
        </div>
      </main>
      <Footer />
    </>
  );
}
