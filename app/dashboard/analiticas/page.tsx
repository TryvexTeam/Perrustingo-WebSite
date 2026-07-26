import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Footer } from "@/components/layout/Footer";
import { SiteMenu } from "@/components/layout/SiteMenu";
import { DashboardAnaliticas } from "@/components/admin/DashboardAnaliticas";
import { calcularAnaliticas, limitesConsulta, resolverRango, type FilaSesion } from "@/lib/analiticas";

export const metadata: Metadata = {
  title: "Analíticas — Panel Perrustingo",
  robots: { index: false, follow: false },
};

/* Analíticas del negocio (PRP-001 Fase 4). Las consultas corren en el
   servidor y las cifras bajan ya calculadas: son datos de facturación, no
   tienen por qué viajar fila por fila al navegador.

   Entra el equipo completo (admin y trabajador), igual que a /dashboard:
   saber cómo va el mes no es una acción privilegiada. */

interface AnaliticasPageProps {
  searchParams: Promise<{ desde?: string; hasta?: string }>;
}

function SinSupabase() {
  return (
    <>
      <SiteMenu />
      <main className="min-h-screen bg-cream px-5 pb-16 pt-28">
        <div className="mx-auto max-w-5xl">
          <div className="rounded-2xl bg-[#fde4c8] px-5 py-4 text-sm font-semibold text-[#7a4d10]">
            🔧 Sin base de datos conectada — las analíticas se calculan sobre
            las citas registradas en Supabase.
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}

export default async function AnaliticasPage({ searchParams }: AnaliticasPageProps) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!supabaseUrl || supabaseUrl.includes("TU_PROYECTO")) {
    return <SinSupabase />;
  }

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
  if (!perfil || !["admin", "trabajador"].includes(perfil.rol)) redirect("/perfil");

  // En Next 16 searchParams es una promesa; hay que esperarla.
  const { desde, hasta } = await searchParams;
  const rango = resolverRango(desde, hasta);
  const { inicio, fin } = limitesConsulta(rango);

  const { data: filas } = await supabase
    .from("sesiones")
    .select("estado, fecha_cita, servicio, precio_base, precio_final")
    .gte("fecha_cita", inicio)
    .lt("fecha_cita", fin)
    .order("fecha_cita");

  const datos = calcularAnaliticas((filas as FilaSesion[]) ?? []);

  return (
    <>
      <SiteMenu />
      <main className="min-h-screen bg-cream px-5 pb-16 pt-28">
        <div className="mx-auto max-w-5xl">
          <p className="text-xs font-extrabold uppercase tracking-[0.22em] text-teal-dark">
            Panel del equipo
          </p>
          <h1 className="mt-1 font-display text-3xl font-extrabold tracking-tight text-ink">
            Cómo va el negocio
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink-soft">
            Ingresos, servicios más pedidos y estado de las citas del período
            que elija. Los ingresos cuentan solo las citas completadas — lo
            agendado va aparte, porque todavía puede caerse.
          </p>

          <div className="mt-8">
            <DashboardAnaliticas datos={datos} rango={rango} />
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
