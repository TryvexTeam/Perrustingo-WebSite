import type { Metadata } from "next";
import Link from "next/link";
import { CalendarioSemanal } from "@/components/agenda/CalendarioSemanal";
import { Footer } from "@/components/layout/Footer";
import { SiteMenu } from "@/components/layout/SiteMenu";
import { createClient } from "@/lib/supabase/server";
import { filaACitaSemana, tieneHoraAsignada, type CitaSemana } from "@/lib/agenda";
import { supabaseConfigurado, type BloqueOcupado, type SesionEquipo } from "@/lib/citas";

export const metadata: Metadata = {
  title: "Agenda — Perrustingo",
  description:
    "Revisa la disponibilidad de la semana y reserva la hora perfecta para tu perro.",
};

export const dynamic = "force-dynamic";

interface DatosAgenda {
  user: { id: string } | null;
  esEquipo: boolean;
  citas?: CitaSemana[];
  pendientesSinHora?: CitaSemana[];
}

async function cargarAgenda(): Promise<DatosAgenda> {
  if (!supabaseConfigurado()) return { user: null, esEquipo: false };

  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    let esEquipo = false;
    if (user) {
      const { data: perfil } = await supabase
        .from("perfiles")
        .select("rol")
        .eq("id", user.id)
        .single();
      esEquipo = Boolean(perfil && ["admin", "trabajador"].includes(perfil.rol));
    }

    if (esEquipo) {
      const { data } = await supabase
        .from("sesiones")
        .select(
          "id, estado, fecha_cita, fecha_fin, servicio, precio_base, precio_final, contacto_nombre, contacto_email, contacto_telefono, detalle_form, notas_cliente, notas_equipo, perro_id"
        )
        .in("estado", ["pendiente", "confirmada", "en_proceso"])
        .not("fecha_cita", "is", null)
        .order("fecha_cita");

      const filas = (data ?? []) as SesionEquipo[];
      const citas: CitaSemana[] = [];
      const pendientesSinHora: CitaSemana[] = [];

      for (const fila of filas) {
        const cita = filaACitaSemana(fila, {
          titulo: fila.detalle_form?.nombrePerro ?? fila.contacto_nombre ?? "Cita",
          sesion: fila,
        });
        if (!cita) continue;
        if (fila.estado === "pendiente" && !tieneHoraAsignada(fila.fecha_cita!)) {
          pendientesSinHora.push(cita);
        } else {
          citas.push(cita);
        }
      }
      return { user, esEquipo, citas, pendientesSinHora };
    }

    // Vista pública/cliente: solo bloques ocupados, sin datos personales
    const { data } = await supabase
      .from("agenda_ocupada")
      .select("id, fecha_cita, fecha_fin, servicio, estado")
      .order("fecha_cita");

    const citas = ((data ?? []) as BloqueOcupado[])
      .filter((b) => tieneHoraAsignada(b.fecha_cita))
      .map((b) => filaACitaSemana(b, { titulo: "Reservado" }))
      .filter((c): c is CitaSemana => c !== null);

    return { user, esEquipo, citas };
  } catch {
    return { user: null, esEquipo: false };
  }
}

export default async function AgendaPage() {
  const { user, esEquipo, citas, pendientesSinHora } = await cargarAgenda();

  return (
    <>
      <SiteMenu />
      <main className="min-h-screen bg-cream px-5 pb-16 pt-28">
        <div className="mx-auto max-w-6xl">
          <div className="mb-6">
            <p className="text-xs font-extrabold uppercase tracking-[0.22em] text-teal-dark">
              {esEquipo ? "Agenda del equipo" : "Agenda semanal"}
            </p>
            <h1 className="mt-1 font-display text-3xl font-extrabold tracking-tight text-ink md:text-4xl">
              {esEquipo ? "Gestiona las citas de la semana" : "Encuentra la hora perfecta"}
            </h1>
          </div>

          {!user && !citas && (
            <div className="mb-6 flex flex-wrap items-center gap-3 rounded-2xl bg-[#fde4c8] px-5 py-4 text-sm font-semibold text-[#7a4d10]">
              <span aria-hidden="true">👋</span>
              <span>
                Estás viendo la agenda de demostración.{" "}
                <Link href="/login" className="underline underline-offset-2 hover:text-ink">
                  Inicia sesión
                </Link>{" "}
                para ver y gestionar tus citas reales.
              </span>
            </div>
          )}

          <CalendarioSemanal
            citas={citas}
            pendientesSinHora={pendientesSinHora}
            modoEquipo={esEquipo}
          />
        </div>
      </main>
      <Footer />
    </>
  );
}
