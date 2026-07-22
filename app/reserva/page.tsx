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

/* Registro ya NO es obligatorio para reservar (pedido de señor Adley
   22-jul: el formulario mismo pide nombre/email/telefono al final, no
   tiene sentido pedirlo dos veces). Si hay sesión, se prellena desde el
   perfil — si no, el formulario pide el contacto directamente. El 10%
   de descuento de primera cita sigue siendo el incentivo real para
   crear cuenta (Jarvis, 22-jul). */

interface ContactoPrefill {
  nombre: string;
  email: string;
  telefono: string;
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
      .select("nombre, apellido, telefono")
      .eq("id", user.id)
      .single();

    const nombre = [perfil?.nombre, (perfil as { apellido?: string } | null)?.apellido]
      .filter(Boolean)
      .join(" ");
    return {
      nombre: nombre || "",
      email: user.email ?? "",
      telefono: perfil?.telefono ?? "",
    };
  } catch {
    return null;
  }
}

export default async function ReservaPage({
  searchParams,
}: {
  searchParams: Promise<{ servicio?: string; fecha?: string }>;
}) {
  const { servicio = "", fecha = "" } = await searchParams;
  const contacto = (await obtenerContacto()) ?? { nombre: "", email: "", telefono: "" };
  const conCuenta = contacto.nombre !== "" || contacto.email !== "";

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
          {!conCuenta && (
            <p className="mx-auto mt-4 max-w-md rounded-2xl bg-[#d8f0e3] px-5 py-3 text-sm font-semibold text-teal-ink">
              🎁 <strong>10% de descuento</strong> en la primera cita si{" "}
              <Link href="/registro" className="underline underline-offset-2">
                creas una cuenta
              </Link>{" "}
              — o sigue como invitado, sin problema.
            </p>
          )}
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
