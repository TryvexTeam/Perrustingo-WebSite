import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Footer } from "@/components/layout/Footer";
import { SiteMenu } from "@/components/layout/SiteMenu";
import { EditorOfertas } from "@/components/admin/EditorOfertas";
import { obtenerOfertas } from "@/lib/ofertasDatos";
import { obtenerDisponibilidad } from "@/lib/disponibilidadDatos";

export const metadata: Metadata = {
  title: "Ofertas — Panel Perrustingo",
  robots: { index: false, follow: false },
};

function SinSupabase() {
  return (
    <>
      <SiteMenu />
      <main className="min-h-screen bg-cream px-5 pb-16 pt-28">
        <div className="mx-auto max-w-4xl">
          <div className="rounded-2xl bg-[#fde4c8] px-5 py-4 text-sm font-semibold text-[#7a4d10]">
            🔧 Sin base de datos conectada — las ofertas se guardan en Supabase.
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}

export default async function OfertasPage() {
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

  const [ofertas, { config }] = await Promise.all([
    obtenerOfertas(supabase),
    obtenerDisponibilidad(supabase),
  ]);

  return (
    <>
      <SiteMenu />
      <main className="min-h-screen bg-cream px-5 pb-16 pt-28">
        <div className="mx-auto max-w-4xl">
          <p className="text-xs font-extrabold uppercase tracking-[0.22em] text-teal-dark">
            Panel del admin
          </p>
          <h1 className="mt-1 font-display text-3xl font-extrabold tracking-tight text-ink">
            Ofertas y beneficios
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink-soft">
            Reservar no exige cuenta, así que la oferta es el motivo para
            crearla. Lo que escriba acá es lo que ve el cliente al reservar
            <strong> y también el descuento que se aplica</strong>: son el
            mismo dato, no se pueden contradecir.
          </p>
          <p className="mt-2 max-w-2xl text-xs leading-relaxed text-ink-soft">
            Si hay varias activas se aplica <strong>solo la que más le
            convenga</strong> al cliente — nunca se suman.
          </p>

          <div className="mt-8">
            <EditorOfertas
              ofertasIniciales={ofertas}
              leadTimeDias={config.leadTimeDias}
            />
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
