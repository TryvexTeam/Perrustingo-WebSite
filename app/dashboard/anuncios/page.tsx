import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Footer } from "@/components/layout/Footer";
import { SiteMenu } from "@/components/layout/SiteMenu";
import { EditorPromos } from "@/components/admin/EditorPromos";
import { PROMOS_DEFAULT, type Promo } from "@/lib/promos";

export const metadata: Metadata = {
  title: "Anuncios — Panel Perrustingo",
  robots: { index: false, follow: false },
};

function SinSupabase() {
  return (
    <>
      <SiteMenu />
      <main className="min-h-screen bg-cream px-5 pb-16 pt-28">
        <div className="mx-auto max-w-5xl">
          <div className="rounded-2xl bg-[#fde4c8] px-5 py-4 text-sm font-semibold text-[#7a4d10]">
            🔧 Sin base de datos conectada — los anuncios se guardan en
            Supabase, así que esta sección necesita la conexión configurada.
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}

export default async function AnunciosPage() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!supabaseUrl || supabaseUrl.includes("TU_PROYECTO")) {
    return <SinSupabase />;
  }

  const supabase = await createClient();

  // Guard de rol: antes esta página no tenía ninguno. Con los anuncios en
  // localStorage el daño era local; ahora una escritura cambia la landing
  // pública, así que entra solo un admin (la RLS lo refuerza igual).
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

  const { data: filas } = await supabase
    .from("promos")
    .select("id, nombre, img, alt, vertical, slot, orden")
    .order("orden");

  return (
    <>
      <SiteMenu />
      <main className="min-h-screen bg-cream px-5 pb-16 pt-28">
        <div className="mx-auto max-w-5xl">
          <p className="text-xs font-extrabold uppercase tracking-[0.22em] text-teal-dark">
            Panel del admin
          </p>
          <h1 className="mt-1 font-display text-3xl font-extrabold tracking-tight text-ink">
            Anuncios de la landing
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink-soft">
            Distribuya los anuncios en las posiciones intermedias de la página
            principal, cambie su imagen o cree uno nuevo. Si dos quedan en la
            misma posición, las flechas deciden cuál va primero.
          </p>

          <div className="mt-8">
            <EditorPromos promosIniciales={(filas as Promo[]) ?? PROMOS_DEFAULT} />
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
