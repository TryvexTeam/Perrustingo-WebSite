import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { supabaseConfigurado } from "@/lib/citas";
import { SiteMenu } from "@/components/layout/SiteMenu";
import { Footer } from "@/components/layout/Footer";
import { LogoutButton } from "@/components/auth/LogoutButton";
import { MisDatos } from "@/components/perfil/MisDatos";
import { MisPerros, type PerroPerfil } from "@/components/perfil/MisPerros";
import { ESTADO_LABEL, type EstadoCita } from "@/lib/citas";
import { TZ_NEGOCIO } from "@/lib/agenda";

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
    .select("nombre, apellido, telefono, comuna, rol")
    .eq("id", user.id)
    .single();

  /* La ficha completa: desde el 30-jul el cliente la edita desde acá, y la
     reserva la reutiliza. Más recientes primero — si hay duplicados
     históricos, el de arriba es el que tiene los datos al día. */
  const { data: perros } = await supabase
    .from("perros")
    .select("id, nombre, raza, peso_kg, contextura, tipo_pelo, temperamento, alergias")
    .eq("cliente_id", user.id)
    .order("created_at", { ascending: false });

  const { data: sesiones } = await supabase
    .from("sesiones")
    .select("id, estado, fecha_cita, servicio, precio_final, perros(nombre)")
    .eq("cliente_id", user.id)
    .order("fecha_cita", { ascending: false })
    .limit(5);

  /* La razón número uno para entrar a la cuenta: ¿cuándo me toca? Se
     responde arriba de todo, sin buscar en la lista. */
  const { data: proximas } = await supabase
    .from("sesiones")
    .select("id, estado, fecha_cita, servicio, perros(nombre)")
    .eq("cliente_id", user.id)
    .in("estado", ["pendiente", "confirmada", "en_proceso"])
    .gte("fecha_cita", new Date().toISOString())
    .order("fecha_cita", { ascending: true })
    .limit(1);
  const proxima = proximas?.[0] ?? null;
  const proximaPerro = (() => {
    if (!proxima) return null;
    const raw = proxima.perros as unknown;
    const fila = Array.isArray(raw) ? (raw[0] as { nombre: string } | undefined) : (raw as { nombre: string } | null);
    return fila?.nombre ?? null;
  })();

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

          {/* Próxima cita — la pregunta que trae a la gente a esta página */}
          {proxima && proxima.fecha_cita && (
            <div className="mb-6 rounded-3xl bg-[#d5efe2] p-6 shadow-sm">
              <h2 className="font-display text-lg font-extrabold text-teal-ink">
                Tu próxima cita 🐾
              </h2>
              <p className="mt-2 text-sm font-semibold text-teal-ink">
                {new Date(proxima.fecha_cita).toLocaleDateString("es-CL", {
                  weekday: "long",
                  day: "numeric",
                  month: "long",
                  timeZone: TZ_NEGOCIO,
                })}
                {" a las "}
                {new Date(proxima.fecha_cita).toLocaleTimeString("es-CL", {
                  hour: "2-digit",
                  minute: "2-digit",
                  hour12: false,
                  timeZone: TZ_NEGOCIO,
                })}
                {proximaPerro ? ` — ${proximaPerro}` : ""}
                {proxima.servicio ? `, ${proxima.servicio.toLowerCase()}` : ""}
              </p>
              <p className="mt-1 text-xs font-bold text-teal-dark">
                Estado: {ESTADO_LABEL[proxima.estado as EstadoCita] ?? proxima.estado}
                {proxima.estado === "pendiente" &&
                  " — te confirmamos por correo apenas el equipo la revise"}
              </p>
            </div>
          )}

          {/* Mis datos */}
          <div className="mb-6 rounded-3xl bg-white p-6 shadow-sm">
            <h2 className="mb-4 font-display text-lg font-extrabold text-ink">
              Mis datos
            </h2>
            <MisDatos
              email={user.email ?? ""}
              inicial={{
                nombre: perfil?.nombre ?? "",
                apellido: perfil?.apellido ?? "",
                telefono: perfil?.telefono ?? "",
                comuna: perfil?.comuna ?? "",
              }}
            />
          </div>

          {/* Mis perros — editables desde el 30-jul */}
          <div className="mb-6 rounded-3xl bg-white p-6 shadow-sm">
            <h2 className="mb-4 font-display text-lg font-extrabold text-ink">
              Mis perros
            </h2>
            <MisPerros perros={(perros ?? []) as PerroPerfil[]} />
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
