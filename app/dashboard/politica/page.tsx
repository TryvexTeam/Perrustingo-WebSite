import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Footer } from "@/components/layout/Footer";
import { SiteMenu } from "@/components/layout/SiteMenu";
import { EditorPolitica } from "@/components/admin/EditorPolitica";
import { obtenerPolitica } from "@/lib/politica";

export const metadata: Metadata = {
  title: "Política de atrasos — Panel Perrustingo",
  robots: { index: false, follow: false },
};

function SinSupabase() {
  return (
    <>
      <SiteMenu />
      <main className="min-h-screen bg-cream px-5 pb-16 pt-28">
        <div className="mx-auto max-w-5xl">
          <div className="rounded-2xl bg-[#fde4c8] px-5 py-4 text-sm font-semibold text-[#7a4d10]">
            🔧 Sin base de datos conectada — la política se guarda en Supabase.
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}

export default async function PoliticaPage() {
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

  /* Si la lectura falla, `obtenerPolitica` devuelve la de fábrica — apagada.
     Ante duda, no se cobra. */
  const politica = await obtenerPolitica(supabase);

  return (
    <>
      <SiteMenu />
      <main className="min-h-screen bg-cream px-5 pb-16 pt-28">
        <div className="mx-auto max-w-5xl">
          <p className="text-xs font-extrabold uppercase tracking-[0.22em] text-teal-dark">
            Panel del admin
          </p>
          <h1 className="mt-1 font-display text-3xl font-extrabold tracking-tight text-ink">
            Atrasos y cancelaciones
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink-soft">
            Qué pasa cuando alguien llega tarde o cancela a última hora. El
            sistema <strong>propone</strong> el recargo en la ficha de la cita;
            cobrarlo o perdonarlo lo decide usted, cliente por cliente.
          </p>

          <div className="mt-8">
            <EditorPolitica politicaInicial={politica} />
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
