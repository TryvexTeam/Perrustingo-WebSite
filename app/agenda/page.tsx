import type { Metadata } from "next";
import Link from "next/link";
import { CalendarioSemanal } from "@/components/agenda/CalendarioSemanal";
import { Footer } from "@/components/Footer";
import { SiteMenu } from "@/components/SiteMenu";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Agenda — Perrustingo",
  description:
    "Revisa la disponibilidad de la semana y reserva la hora perfecta para tu perro.",
};

async function obtenerUsuario() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url || url.includes("TU_PROYECTO")) return null;
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    return user;
  } catch {
    return null;
  }
}

export default async function AgendaPage() {
  const user = await obtenerUsuario();

  return (
    <>
      <SiteMenu />
      <main className="min-h-screen bg-cream px-5 pb-16 pt-28">
        <div className="mx-auto max-w-6xl">
          <div className="mb-6">
            <p className="text-xs font-extrabold uppercase tracking-[0.22em] text-teal-dark">
              Agenda semanal
            </p>
            <h1 className="mt-1 font-display text-3xl font-extrabold tracking-tight text-ink md:text-4xl">
              Encuentra la hora perfecta
            </h1>
          </div>

          {!user && (
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

          <CalendarioSemanal />
        </div>
      </main>
      <Footer />
    </>
  );
}
