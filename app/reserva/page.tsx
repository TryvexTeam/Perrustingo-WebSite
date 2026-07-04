import type { Metadata } from "next";
import { Footer } from "@/components/Footer";
import { FormReserva } from "@/components/FormReserva";
import { SiteMenu } from "@/components/SiteMenu";

export const metadata: Metadata = {
  title: "Reserva tu cita — Perrustingo",
  description:
    "Completa el formulario con los datos de tu perro y recibe tu reserva lista para enviar por WhatsApp. Precio estimado en tiempo real.",
};

export default async function ReservaPage({
  searchParams,
}: {
  searchParams: Promise<{ servicio?: string; fecha?: string }>;
}) {
  const { servicio = "", fecha = "" } = await searchParams;

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
            Llena el formulario en 4 pasos y te generamos el mensaje listo para
            WhatsApp — con precio estimado incluido y sin necesidad de llamar.
          </p>
        </div>

        <div className="mt-10">
          <FormReserva initialServicio={servicio} initialFecha={fecha} />
        </div>
      </main>
      <Footer />
    </>
  );
}
