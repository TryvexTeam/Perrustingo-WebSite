import type { Metadata } from "next";
import Link from "next/link";
import { CalendarioSemanal } from "@/components/agenda/CalendarioSemanal";
import { Footer } from "@/components/layout/Footer";
import { SiteMenu } from "@/components/layout/SiteMenu";
import { createClient } from "@/lib/supabase/server";
import {
  filaACitaSemana,
  resolverFiltroAgenda,
  tieneHoraAsignada,
  type CitaSemana,
  type FiltroAgenda,
  type SesionEquipoConDueno,
} from "@/lib/agenda";
import { supabaseConfigurado, type BloqueOcupado } from "@/lib/citas";

export const metadata: Metadata = {
  title: "Agenda — Perrustingo",
  description:
    "Revisa la disponibilidad de la semana y reserva la hora perfecta para tu perro o perra.",
};

export const dynamic = "force-dynamic";

interface DatosAgenda {
  user: { id: string } | null;
  esEquipo: boolean;
  esAdmin: boolean;
  citas?: CitaSemana[];
  pendientesSinHora?: CitaSemana[];
}

async function cargarAgenda(filtro: FiltroAgenda): Promise<DatosAgenda> {
  if (!supabaseConfigurado()) return { user: null, esEquipo: false, esAdmin: false };

  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    let esEquipo = false;
    let esAdmin = false;
    if (user) {
      const { data: perfil } = await supabase
        .from("perfiles")
        .select("rol")
        .eq("id", user.id)
        .single();
      esEquipo = Boolean(perfil && ["admin", "trabajador"].includes(perfil.rol));
      esAdmin = perfil?.rol === "admin";
    }

    if (esEquipo && user) {
      /* El recorte por persona lo hace la vista (migración 038): un trabajador
         solo recibe sus citas y las sin asignar, aunque llame a PostgREST
         directo. Este filtro de acá es la preferencia del admin —el único que
         recibe todo— para mirar solo lo suyo. Va en la CONSULTA y no en el
         render: filtrar al pintar significa que los datos del colega igual
         viajaron por la red. */
      let consulta = supabase
        .from("sesiones_equipo")
        .select(
          "id, estado, fecha_cita, fecha_fin, servicio, precio_base, precio_final, contacto_nombre, contacto_email, contacto_telefono, detalle_form, notas_cliente, notas_equipo, perro_id, aviso_listo_en, peluquero_id"
        )
        .in("estado", ["pendiente", "confirmada", "en_proceso"])
        .not("fecha_cita", "is", null);

      if (filtro === "mias") {
        // Las sin asignar entran siempre: ver `esMiCita` en lib/agenda.ts.
        consulta = consulta.or(`peluquero_id.eq.${user.id},peluquero_id.is.null`);
      }

      const { data } = await consulta.order("fecha_cita");

      const filas = (data ?? []) as SesionEquipoConDueno[];
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
      return { user, esEquipo, esAdmin, citas, pendientesSinHora };
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

    return { user, esEquipo, esAdmin, citas };
  } catch {
    return { user: null, esEquipo: false, esAdmin: false };
  }
}

/* En Next 16 los searchParams llegan como Promesa. */
interface AgendaPageProps {
  searchParams: Promise<{ ver?: string }>;
}

export default async function AgendaPage({ searchParams }: AgendaPageProps) {
  const { ver } = await searchParams;
  const filtro = resolverFiltroAgenda(ver);
  const { user, esEquipo, esAdmin, citas, pendientesSinHora } = await cargarAgenda(filtro);

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
            {esEquipo && !esAdmin && (
              <p className="mt-1 text-sm text-ink-soft">
                Estás viendo tu agenda: tus citas y las que todavía no tienen
                peluquero asignado.
              </p>
            )}
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
            filtro={filtro}
            puedeVerTodo={esAdmin}
          />
        </div>
      </main>
      <Footer />
    </>
  );
}
