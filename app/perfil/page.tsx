import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { supabaseConfigurado } from "@/lib/citas";
import { SiteMenu } from "@/components/layout/SiteMenu";
import { Footer } from "@/components/layout/Footer";
import { LogoutButton } from "@/components/auth/LogoutButton";

export const metadata: Metadata = {
  title: "Mi perfil — Perrustingo",
  robots: { index: false, follow: false },
};

export default async function PerfilPage() {
  if (!supabaseConfigurado()) {
    return (
      <>
        <SiteMenu />
        <main className="min-h-screen bg-cream px-5 pb-16 pt-28">
          <div className="mx-auto max-w-3xl">
            <div className="rounded-2xl bg-[#fde4c8] px-5 py-4 text-sm font-semibold text-[#7a4d10]">
              🔧 Las cuentas de usuario se activan al conectar la base de datos.
              Mientras tanto puedes{" "}
              <Link href="/reserva" className="underline underline-offset-2">
                reservar por el formulario
              </Link>{" "}
              sin necesidad de cuenta.
            </div>
          </div>
        </main>
        <Footer />
      </>
    );
  }

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: perfil } = await supabase
    .from("perfiles")
    .select("nombre, telefono, rol")
    .eq("id", user.id)
    .single();

  const { data: perros } = await supabase
    .from("perros")
    .select("id, nombre, raza, peso_kg")
    .eq("cliente_id", user.id)
    .order("created_at");

  const { data: sesiones } = await supabase
    .from("sesiones")
    .select("id, estado, fecha_cita, servicio, precio_final, perros(nombre)")
    .eq("cliente_id", user.id)
    .order("fecha_cita", { ascending: false })
    .limit(5);

  return (
    <>
      <SiteMenu />
      <main className="min-h-screen bg-cream px-5 pb-16 pt-28">
        <div className="mx-auto max-w-2xl">
          {/* Cabecera */}
          <div className="mb-8 flex items-start justify-between">
            <div>
              <p className="text-xs font-extrabold uppercase tracking-[0.22em] text-teal-dark">
                Mi cuenta
              </p>
              <h1 className="mt-1 font-display text-3xl font-extrabold tracking-tight text-ink">
                Hola, {perfil?.nombre ?? user.email?.split("@")[0]} 🐾
              </h1>
            </div>
            <LogoutButton />
          </div>

          {/* Mis perros */}
          <div className="mb-6 rounded-3xl bg-white p-6 shadow-sm">
            <h2 className="mb-4 font-display text-lg font-extrabold text-ink">
              Mis perros
            </h2>
            {!perros || perros.length === 0 ? (
              <p className="text-sm text-ink-soft">
                Aún no tienes perros guardados.{" "}
                <a href="/reserva" className="font-semibold text-teal-dark underline underline-offset-2">
                  Agenda tu primera cita →
                </a>
              </p>
            ) : (
              <div className="space-y-2">
                {perros.map((p) => (
                  <div
                    key={p.id}
                    className="flex items-center gap-3 rounded-2xl border border-zinc-100 px-4 py-3"
                  >
                    <span className="text-2xl">🐶</span>
                    <div>
                      <p className="font-semibold text-ink">{p.nombre}</p>
                      <p className="text-xs text-ink-soft">
                        {p.raza} · {p.peso_kg} kg
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Historial */}
          <div className="rounded-3xl bg-white p-6 shadow-sm">
            <h2 className="mb-4 font-display text-lg font-extrabold text-ink">
              Últimas citas
            </h2>
            {!sesiones || sesiones.length === 0 ? (
              <p className="text-sm text-ink-soft">
                Aún no tienes citas registradas.
              </p>
            ) : (
              <div className="space-y-2">
                {sesiones.map((s) => {
                  type PerroRow = { nombre: string };
                  const perrosRaw = s.perros as unknown;
                  const perro: PerroRow | null = Array.isArray(perrosRaw)
                    ? (perrosRaw[0] as PerroRow) ?? null
                    : (perrosRaw as PerroRow | null);
                  return (
                    <div
                      key={s.id}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-zinc-100 px-4 py-3"
                    >
                      <div>
                        <p className="font-semibold text-ink">{perro?.nombre}</p>
                        <p className="text-xs text-ink-soft">
                          {s.servicio} ·{" "}
                          {s.fecha_cita
                            ? new Date(s.fecha_cita).toLocaleDateString("es-CL")
                            : "fecha por confirmar"}
                        </p>
                      </div>
                      <div className="text-right">
                        <span className="rounded-full bg-[#d8f0e3] px-2.5 py-1 text-[11px] font-bold text-teal-dark">
                          {s.estado}
                        </span>
                        {s.precio_final && (
                          <p className="mt-0.5 text-xs font-semibold text-ink-soft">
                            $
                            {s.precio_final
                              .toString()
                              .replace(/\B(?=(\d{3})+(?!\d))/g, ".")}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {perfil?.rol === "admin" && (
            <div className="mt-6 text-center">
              <a
                href="/dashboard"
                className="inline-block rounded-full bg-teal-dark px-6 py-2.5 text-sm font-bold text-white shadow-sm"
              >
                Ir al dashboard del equipo →
              </a>
            </div>
          )}
        </div>
      </main>
      <Footer />
    </>
  );
}
