import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Footer } from "@/components/layout/Footer";
import { SiteMenu } from "@/components/layout/SiteMenu";
import { GestorUsuarios } from "@/components/admin/GestorUsuarios";
import type { PerfilAdmin } from "@/lib/usuarios";

export const metadata: Metadata = {
  title: "Usuarios — Panel Perrustingo",
  robots: { index: false, follow: false },
};

/* Control de usuarios (PRP-001 Fase 1). Mismo guard que /dashboard, pero
   estricto: acá solo entra `admin`, no el equipo completo — un trabajador
   que pudiera repartir roles vacía el sentido del trigger anti-escalada. */

function SinSupabase() {
  return (
    <>
      <SiteMenu />
      <main className="min-h-screen bg-cream px-5 pb-16 pt-28">
        <div className="mx-auto max-w-5xl">
          <div className="rounded-2xl bg-[#fde4c8] px-5 py-4 text-sm font-semibold text-[#7a4d10]">
            🔧 Sin base de datos conectada — el control de usuarios necesita
            Supabase configurado para funcionar.
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}

export default async function UsuariosPage() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!supabaseUrl || supabaseUrl.includes("TU_PROYECTO")) {
    return <SinSupabase />;
  }

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: perfilPropio } = await supabase
    .from("perfiles")
    .select("rol")
    .eq("id", user.id)
    .single();

  if (perfilPropio?.rol !== "admin") redirect("/dashboard");

  const { data: perfiles } = await supabase
    .from("perfiles")
    .select("id, rol, nombre, apellido, telefono, comuna, es_peluquero, created_at")
    .order("created_at");

  // Los correos salen de auth.users vía función SECURITY DEFINER que
  // valida el rol adentro (migración 008). Si falla, la página igual
  // sirve: se muestran las cuentas sin correo, no una pantalla en blanco.
  const { data: emailsFilas } = await supabase.rpc("emails_de_perfiles");
  const emails: Record<string, string> = {};
  for (const fila of (emailsFilas as { id: string; email: string }[] | null) ?? []) {
    emails[fila.id] = fila.email;
  }

  return (
    <>
      <SiteMenu />
      <main className="min-h-screen bg-cream px-5 pb-16 pt-28">
        <div className="mx-auto max-w-5xl">
          <p className="text-xs font-extrabold uppercase tracking-[0.22em] text-teal-dark">
            Panel del admin
          </p>
          <h1 className="mt-1 font-display text-3xl font-extrabold tracking-tight text-ink">
            Usuarios y permisos
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink-soft">
            Quién entra al panel, quién atiende citas y con qué permisos.
            Marque como &ldquo;atiende&rdquo; a cada peluquero: de eso depende
            cuántas citas se pueden tomar a la misma hora.
          </p>

          <div className="mt-8">
            <GestorUsuarios
              perfiles={(perfiles as PerfilAdmin[]) ?? []}
              emails={emails}
              adminId={user.id}
            />
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
