import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SiteMenu } from "@/components/SiteMenu";
import { Footer } from "@/components/Footer";

export const metadata: Metadata = {
  title: "Dashboard — Perrustingo",
  robots: { index: false, follow: false },
};

export default async function DashboardPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  // Verificar rol — solo trabajador y admin pueden entrar
  const { data: perfil } = await supabase
    .from("perfiles")
    .select("rol, nombre")
    .eq("id", user.id)
    .single();

  if (!perfil || !["admin", "trabajador"].includes(perfil.rol)) {
    redirect("/perfil");
  }

  // Citas del día de hoy
  const hoy = new Date();
  const inicioHoy = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate()).toISOString();
  const finHoy = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() + 1).toISOString();

  const { data: citasHoy } = await supabase
    .from("sesiones")
    .select(`
      id, estado, fecha_cita, servicio, precio_base, precio_final,
      perros ( nombre, raza, peso_kg, temperamento ),
      perfiles!sesiones_cliente_id_fkey ( nombre, telefono )
    `)
    .gte("fecha_cita", inicioHoy)
    .lt("fecha_cita", finHoy)
    .order("fecha_cita");

  const citasPendientes = citasHoy?.filter((c) => c.estado === "pendiente") ?? [];
  const citasConfirmadas = citasHoy?.filter((c) => c.estado === "confirmada") ?? [];
  const citasEnProceso = citasHoy?.filter((c) => c.estado === "en_proceso") ?? [];

  return (
    <>
      <SiteMenu />
      <main className="min-h-screen bg-cream px-5 pb-16 pt-28">
        <div className="mx-auto max-w-5xl">
          {/* Header */}
          <div className="mb-8">
            <p className="text-xs font-extrabold uppercase tracking-[0.22em] text-teal-dark">
              Panel del equipo
            </p>
            <h1 className="mt-1 font-display text-3xl font-extrabold tracking-tight text-ink">
              Hola, {perfil.nombre ?? "equipo"} 👋
            </h1>
            <p className="mt-1 text-sm text-ink-soft">
              {hoy.toLocaleDateString("es-CL", {
                weekday: "long",
                year: "numeric",
                month: "long",
                day: "numeric",
              })}
            </p>
          </div>

          {/* Stats del día */}
          <div className="mb-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
            {[
              { label: "Total hoy", value: citasHoy?.length ?? 0, color: "bg-[#e3f1fb]" },
              { label: "Pendientes", value: citasPendientes.length, color: "bg-[#fdeaf1]" },
              { label: "Confirmadas", value: citasConfirmadas.length, color: "bg-[#ece4f7]" },
              { label: "En proceso", value: citasEnProceso.length, color: "bg-[#d8f0e3]" },
            ].map((stat) => (
              <div
                key={stat.label}
                className={`${stat.color} rounded-3xl p-5 text-center`}
              >
                <p className="font-display text-3xl font-extrabold text-ink">
                  {stat.value}
                </p>
                <p className="mt-1 text-xs font-bold uppercase tracking-wide text-ink-soft">
                  {stat.label}
                </p>
              </div>
            ))}
          </div>

          {/* Lista de citas */}
          <div className="rounded-3xl bg-white p-6 shadow-sm">
            <h2 className="mb-4 font-display text-lg font-extrabold text-ink">
              Citas de hoy
            </h2>

            {!citasHoy || citasHoy.length === 0 ? (
              <p className="py-8 text-center text-sm text-ink-soft">
                No hay citas registradas para hoy.
              </p>
            ) : (
              <div className="space-y-3">
                {citasHoy.map((cita) => {
                  type PerroRow = { nombre: string; raza: string; peso_kg: number; temperamento: string };
                  type ClienteRow = { nombre: string; telefono: string };
                  const perrosRaw = cita.perros as unknown;
                  const perro: PerroRow | null = Array.isArray(perrosRaw)
                    ? (perrosRaw[0] as PerroRow) ?? null
                    : (perrosRaw as PerroRow | null);
                  const clienteRaw = cita.perfiles as unknown;
                  const cliente: ClienteRow | null = Array.isArray(clienteRaw)
                    ? (clienteRaw[0] as ClienteRow) ?? null
                    : (clienteRaw as ClienteRow | null);

                  const estadoColor: Record<string, string> = {
                    pendiente: "bg-yellow-100 text-yellow-800",
                    confirmada: "bg-blue-100 text-blue-800",
                    en_proceso: "bg-purple-100 text-purple-800",
                    completada: "bg-green-100 text-green-800",
                    cancelada: "bg-red-100 text-red-800",
                  };

                  return (
                    <div
                      key={cita.id}
                      className="flex flex-wrap items-center gap-3 rounded-2xl border border-zinc-100 p-4 hover:bg-cream/60 transition-colors"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-ink">
                            {perro?.nombre ?? "—"}
                          </span>
                          <span className="text-xs text-ink-soft">
                            {perro?.raza} · {perro?.peso_kg} kg
                          </span>
                          {perro?.temperamento === "no_se_deja" && (
                            <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-bold text-red-700">
                              ⚠️ cuidado
                            </span>
                          )}
                        </div>
                        <p className="mt-0.5 text-xs text-ink-soft">
                          Cliente: {cliente?.nombre ?? "—"}
                          {cliente?.telefono && (
                            <a
                              href={`https://wa.me/${cliente.telefono.replace(/\D/g, "")}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="ml-2 text-teal-dark underline underline-offset-2"
                            >
                              WhatsApp →
                            </a>
                          )}
                        </p>
                        <p className="mt-0.5 text-xs text-ink-soft">
                          {cita.servicio} ·{" "}
                          {cita.fecha_cita
                            ? new Date(cita.fecha_cita).toLocaleTimeString("es-CL", {
                                hour: "2-digit",
                                minute: "2-digit",
                              })
                            : "hora sin definir"}
                        </p>
                      </div>

                      <div className="flex flex-col items-end gap-1">
                        <span
                          className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${estadoColor[cita.estado] ?? ""}`}
                        >
                          {cita.estado}
                        </span>
                        {cita.precio_final && (
                          <span className="text-xs font-semibold text-teal-dark">
                            $
                            {cita.precio_final
                              .toString()
                              .replace(/\B(?=(\d{3})+(?!\d))/g, ".")}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Acciones rápidas */}
          <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3">
            {[
              { label: "Ver todas las citas", href: "/dashboard/citas", emoji: "📅" },
              { label: "Clientes", href: "/dashboard/clientes", emoji: "👥" },
              { label: "Tarifas", href: "/dashboard/tarifas", emoji: "💰", onlyAdmin: true },
            ]
              .filter((a) => !a.onlyAdmin || perfil.rol === "admin")
              .map((accion) => (
                <a
                  key={accion.label}
                  href={accion.href}
                  className="flex items-center gap-3 rounded-2xl bg-white px-5 py-4 shadow-sm transition-transform hover:-translate-y-0.5"
                >
                  <span className="text-xl">{accion.emoji}</span>
                  <span className="text-sm font-semibold text-ink">{accion.label}</span>
                </a>
              ))}
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
