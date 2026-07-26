import type { Metadata } from "next";
import Link from "next/link";
import { Footer } from "@/components/layout/Footer";
import { FormReserva } from "@/components/reserva/FormReserva";
import { SiteMenu } from "@/components/layout/SiteMenu";
import { createClient } from "@/lib/supabase/server";
import { supabaseConfigurado } from "@/lib/citas";

export const metadata: Metadata = {
  title: "Reserva tu cita — Perrustingo",
  description:
    "Completa el formulario con los datos de tu perro y recibe tu reserva lista para enviar por WhatsApp. Precio estimado en tiempo real.",
};

/* Reservar NO exige cuenta (PRP-003 F1, 26-jul). Antes sí, y cada visitante
   que no quería registrarse era una reserva perdida. Ahora la pantalla de
   registro es una invitación que se puede saltar: quien crea cuenta se lleva
   el beneficio y no vuelve a escribir sus datos; quien no, reserva igual
   completando el contacto en el formulario. */

interface ContactoPrefill {
  nombre: string;
  email: string;
  telefono: string;
  comuna: string;
}

async function obtenerContacto(): Promise<ContactoPrefill | null> {
  if (!supabaseConfigurado()) return null;
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return null;

    const { data: perfil } = await supabase
      .from("perfiles")
      .select("nombre, apellido, telefono, comuna")
      .eq("id", user.id)
      .single();

    const p = perfil as { nombre?: string; apellido?: string; telefono?: string; comuna?: string } | null;
    const nombre = [p?.nombre, p?.apellido].filter(Boolean).join(" ");
    return {
      nombre: nombre || "",
      email: user.email ?? "",
      telefono: p?.telefono ?? "",
      comuna: p?.comuna ?? "",
    };
  } catch {
    return null;
  }
}

export default async function ReservaPage({
  searchParams,
}: {
  searchParams: Promise<{ servicio?: string; fecha?: string; invitacion?: string }>;
}) {
  const { servicio = "", fecha = "", invitacion } = await searchParams;
  const contacto = await obtenerContacto();

  /* Sin sesión se muestra UNA vez la invitación a registrarse; con
     `?invitacion=no` se salta y va directo al formulario. No se recuerda la
     elección a propósito: guardarla exigiría una cookie de seguimiento para
     ahorrar un clic. */
  if (!contacto && invitacion !== "no") {
    const next = "/reserva" +
      (servicio || fecha
        ? `?${new URLSearchParams({ ...(servicio && { servicio }), ...(fecha && { fecha }) })}`
        : "");
    return (
      <>
        <SiteMenu />
        <main className="flex min-h-screen flex-col items-center justify-center bg-cream px-5 py-20">
          <div className="w-full max-w-md text-center">
            <p className="text-xs font-extrabold uppercase tracking-[0.22em] text-teal-dark">
              Reserva inteligente
            </p>
            <h1 className="mt-2 font-display text-3xl font-extrabold tracking-tight text-ink md:text-4xl">
              ¿Creamos tu cuenta?
            </h1>
            <p className="mx-auto mt-4 max-w-sm text-[15px] leading-relaxed text-ink-soft">
              Con cuenta guardamos la ficha de tu perrito, ves tu historial de
              visitas y no vuelves a escribir tus datos. Pero si prefieres,
              puedes reservar sin crear nada.
            </p>
            <div className="mx-auto mt-6 max-w-sm rounded-3xl bg-[#d8f0e3] px-6 py-5 text-left">
              <p className="font-display text-base font-extrabold text-teal-ink">
                🎁 Beneficio de bienvenida
              </p>
              <p className="mt-1 text-sm leading-relaxed text-teal-ink">
                <strong>10% de descuento</strong> en la primera cita de tu
                perrito por registrarte.
              </p>
            </div>
            <div className="mt-8 flex flex-col gap-3">
              <Link
                href={`/registro?next=${encodeURIComponent(next)}`}
                className="rounded-full bg-orange px-8 py-4 font-display text-base font-extrabold text-teal-ink shadow-[0_3px_0_rgba(6,58,64,.25)] transition-[background-color,transform,box-shadow] duration-150 hover:bg-[#f7ab52] active:translate-y-0.5"
              >
                Crear cuenta gratis
              </Link>
              <Link
                href={`/login?next=${encodeURIComponent(next)}`}
                className="rounded-full border-2 border-ink/15 px-8 py-4 font-display text-base font-extrabold text-ink transition-colors hover:border-ink/30"
              >
                Ya tengo cuenta
              </Link>
              <Link
                href={`/reserva?${new URLSearchParams({
                  ...(servicio && { servicio }),
                  ...(fecha && { fecha }),
                  invitacion: "no",
                })}`}
                className="text-sm font-bold text-ink-soft underline underline-offset-4 hover:text-ink"
              >
                Reservar sin cuenta →
              </Link>
            </div>
          </div>
        </main>
        <Footer />
      </>
    );
  }

  return (
    <>
      <SiteMenu />
      <main className="flex-1 bg-cream px-5 pb-16 pt-28">
        <div className="mx-auto max-w-xl text-center">
          <p className="text-xs font-extrabold uppercase tracking-[0.22em] text-teal-dark">
            Reserva inteligente
          </p>
          <h1 className="mt-2 font-display text-3xl font-extrabold tracking-tight text-ink md:text-4xl">
            Cuéntanos sobre tu perro
          </h1>
          <p className="mx-auto mt-4 max-w-md text-[15px] leading-relaxed text-ink-soft">
            Llena el formulario y te generamos el mensaje listo para WhatsApp —
            con precio estimado incluido y sin necesidad de llamar.
          </p>
        </div>

        <div className="mt-10">
          <FormReserva
            initialServicio={servicio}
            initialFecha={fecha}
            contacto={contacto}
          />
        </div>
      </main>
      <Footer />
    </>
  );
}
