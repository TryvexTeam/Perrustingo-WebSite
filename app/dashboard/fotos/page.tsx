import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SiteMenu } from "@/components/layout/SiteMenu";
import { Footer } from "@/components/layout/Footer";
import { PanelAlmacenamiento } from "@/components/admin/PanelAlmacenamiento";
import { MESES_RETENCION } from "@/lib/retencion";

export const metadata: Metadata = {
  title: "Fotos guardadas — Perrustingo",
  robots: { index: false, follow: false },
};

/* Espacio y retención de las fotos (PRP-002 F5). */

export default async function FotosPage() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!supabaseUrl || supabaseUrl.includes("TU_PROYECTO")) redirect("/dashboard");

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

  return (
    <>
      <SiteMenu />
      <main className="min-h-screen bg-cream px-5 pb-16 pt-28">
        <div className="mx-auto max-w-2xl">
          <p className="text-xs font-extrabold uppercase tracking-[0.22em] text-teal-dark">
            Almacenamiento
          </p>
          <h1 className="mt-1 font-display text-3xl font-extrabold tracking-tight text-ink">
            Fotos guardadas
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-ink-soft">
            Las fotos del antes y el después se guardan {MESES_RETENCION} meses
            como respaldo del trabajo. Después de ese plazo se pueden borrar
            desde acá.
          </p>

          <div className="mt-6">
            <PanelAlmacenamiento />
          </div>

          <div className="mt-6 rounded-3xl bg-white p-6 shadow-sm">
            <h2 className="font-display text-base font-extrabold text-ink">
              Por qué esto no se borra solo
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-ink-soft">
              Borrar evidencia es una decisión, no una tarea de mantenimiento.
              Un proceso automático a las 3 de la mañana podría eliminar la foto
              de una visita que justo se está discutiendo con un cliente. Por
              eso el sistema avisa cuándo conviene limpiar, y la limpieza la
              hace un administrador cuando decide hacerla.
            </p>
            <p className="mt-3 rounded-2xl bg-cream px-4 py-3 text-xs leading-relaxed text-ink-soft">
              💡 Con la compresión actual (~150 KB por foto), el plan gratuito
              da para unas 7.000 fotos. A 10 citas diarias con dos fotos cada
              una, eso es más de un año sin tener que borrar nada.
            </p>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
