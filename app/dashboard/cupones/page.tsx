import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Footer } from "@/components/layout/Footer";
import { SiteMenu } from "@/components/layout/SiteMenu";
import { EditorCupones } from "@/components/admin/EditorCupones";
import { listarCupones } from "@/lib/cuponesDatos";

export const metadata: Metadata = {
  title: "Cupones — Panel Perrustingo",
  robots: { index: false, follow: false },
};

function SinSupabase() {
  return (
    <>
      <SiteMenu />
      <main className="min-h-screen bg-cream px-5 pb-16 pt-28">
        <div className="mx-auto max-w-4xl">
          <div className="rounded-2xl bg-[#fde4c8] px-5 py-4 text-sm font-semibold text-[#7a4d10]">
            🔧 Sin base de datos conectada — los cupones se guardan en Supabase.
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}

export default async function CuponesPage() {
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

  const cupones = await listarCupones(supabase);

  return (
    <>
      <SiteMenu />
      <main className="min-h-screen bg-cream px-5 pb-16 pt-28">
        <div className="mx-auto max-w-4xl">
          <p className="text-xs font-extrabold uppercase tracking-[0.22em] text-teal-dark">
            Panel del admin
          </p>
          <h1 className="mt-1 font-display text-3xl font-extrabold tracking-tight text-ink">
            Cupones
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink-soft">
            Un cupón es un código que el cliente escribe al reservar. Acá usted
            decide <strong>a quién le sirve y cuándo</strong>: puede premiar a
            quien reserva con anticipación, a quien vuelve por segunda vez, o
            dejarlo abierto para todos.
          </p>
          <p className="mt-2 max-w-2xl text-xs leading-relaxed text-ink-soft">
            El cupón y las ofertas <strong>no se suman</strong>: al cliente se
            le aplica solo el descuento que más le convenga.
          </p>

          <div className="mt-8">
            <EditorCupones cuponesIniciales={cupones} />
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
