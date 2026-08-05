import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { formatCLP } from "@/lib/reserva";
import { ESTADO_COLOR } from "@/lib/citas";
import { EnVivo } from "@/components/admin/EnVivo";
import { SiteMenu } from "@/components/layout/SiteMenu";
import { Footer } from "@/components/layout/Footer";

export const metadata: Metadata = {
  title: "Dashboard — Perrustingo",
  robots: { index: false, follow: false },
};

/* Maqueta del panel del equipo mientras no hay base de datos conectada. */
function DashboardDemo() {
  const hoy = new Date();
  const citasDemo = [
    { perro: "Luna · Poodle Toy · 4 kg", cliente: "Camila R.", servicio: "Baño + corte de pelo", hora: "10:00", estado: "confirmada", precio: "$20.000" },
    { perro: "Rocky · Labrador · 32 kg", cliente: "Jorge M.", servicio: "Baño completo", hora: "12:00", estado: "pendiente", precio: "$40.000" },
    { perro: "Milo · Shih Tzu · 6 kg", cliente: "Fernanda T.", servicio: "Spa completo", hora: "15:30", estado: "en_proceso", precio: "$20.000" },
  ];

  return (
    <>
      <SiteMenu />
      <main className="min-h-screen bg-cream px-5 pb-16 pt-28">
        <div className="mx-auto max-w-5xl">
          <div className="mb-6 flex items-center gap-2 rounded-2xl bg-[#fde4c8] px-5 py-4 text-sm font-semibold text-[#7a4d10]">
            <span aria-hidden="true">🔧</span>
            Panel en modo demostración — sin base de datos conectada. Las citas
            que ves son de ejemplo.
          </div>

          <div className="mb-8">
            <p className="text-xs font-extrabold uppercase tracking-[0.22em] text-teal-dark">
              Panel del equipo
            </p>
            <h1 className="mt-1 font-display text-3xl font-extrabold tracking-tight text-ink">
              Hola, equipo 👋
            </h1>
            <p className="mt-1 text-sm text-ink-soft">
              {hoy.toLocaleDateString("es-CL", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
            </p>
          </div>

          <EnVivo />

          <div className="rounded-3xl bg-white p-6 shadow-sm">
            <h2 className="mb-4 font-display text-lg font-extrabold text-ink">Citas de hoy</h2>
            <div className="space-y-3">
              {citasDemo.map((cita) => (
                <div key={cita.perro} className="flex flex-wrap items-center gap-3 rounded-2xl border border-zinc-100 p-4 transition-colors hover:bg-cream/60">
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-ink">{cita.perro}</p>
                    <p className="mt-0.5 text-xs text-ink-soft">Cliente: {cita.cliente}</p>
                    <p className="mt-0.5 text-xs text-ink-soft">{cita.servicio} · {cita.hora}</p>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${ESTADO_COLOR[cita.estado as keyof typeof ESTADO_COLOR] ?? ""}`}>
                      {cita.estado}
                    </span>
                    <span className="text-xs font-semibold text-teal-dark">{cita.precio}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3">
            {[
              { label: "Agenda semanal", href: "/agenda", emoji: "📅" },
              { label: "Costos y tarifas", href: "/dashboard/tarifas", emoji: "💰" },
              { label: "Anuncios", href: "/dashboard/anuncios", emoji: "📣" },
              { label: "Reserva inteligente", href: "/reserva", emoji: "🐾" },
            ].map((accion) => (
              <a key={accion.label} href={accion.href} className="flex items-center gap-3 rounded-2xl bg-white px-5 py-4 shadow-sm transition-transform hover:-translate-y-0.5">
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

export default async function DashboardPage() {
  // Sin Supabase configurado → maqueta del panel con datos demo
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!supabaseUrl || supabaseUrl.includes("TU_PROYECTO")) {
    return <DashboardDemo />;
  }

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
    .from("sesiones_equipo")
    /* Sin joins: `sesiones_equipo` es una vista y PostgREST no le deduce las
       claves foráneas. Los datos del perrito ya vienen en `detalle_form`
       (snapshot del formulario) y los del cliente en las columnas
       `contacto_*`, que la vista deja en NULL si quien mira no es admin. */
    .select(
      "id, estado, fecha_cita, servicio, precio_base, precio_final, contacto_nombre, contacto_telefono, detalle_form"
    )
    .gte("fecha_cita", inicioHoy)
    .lt("fecha_cita", finHoy)
    .order("fecha_cita");

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

          {/* Datos reales en vivo */}
          <EnVivo />

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
                  /* El detalle del formulario es un snapshot de texto: trae
                     lo que la persona escribió al reservar, sin depender de
                     que la ficha del perrito exista en `perros`. */
                  const detalle = (cita.detalle_form ?? {}) as Record<string, string>;
                  const perro = {
                    nombre: detalle.nombrePerro ?? null,
                    raza: detalle.raza ?? null,
                    peso_kg: detalle.pesoKg ?? null,
                    temperamento: detalle.temperamento ?? null,
                  };
                  /* `contacto_telefono` llega en NULL cuando quien mira no es
                     admin (migración 027), así que el enlace de WhatsApp de
                     más abajo simplemente no se dibuja para el peluquero. */
                  const cliente = {
                    nombre: cita.contacto_nombre as string | null,
                    telefono: cita.contacto_telefono as string | null,
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
                          className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${ESTADO_COLOR[cita.estado as keyof typeof ESTADO_COLOR] ?? ""}`}
                        >
                          {cita.estado}
                        </span>
                        {cita.precio_final && (
                          <span className="text-xs font-semibold text-teal-dark">
                            {formatCLP(cita.precio_final)}
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
              { label: "Hoy en el local", href: "/dashboard/hoy", emoji: "☀️" },
              { label: "Ver todas las citas", href: "/dashboard/citas", emoji: "📅" },
              { label: "Agenda semanal", href: "/agenda", emoji: "🗓️" },
              { label: "Analíticas", href: "/dashboard/analiticas", emoji: "📊" },
              { label: "Tarifas", href: "/dashboard/tarifas", emoji: "💰", onlyAdmin: true },
              { label: "Anuncios", href: "/dashboard/anuncios", emoji: "📣", onlyAdmin: true },
              { label: "Usuarios", href: "/dashboard/usuarios", emoji: "👥", onlyAdmin: true },
              { label: "Disponibilidad", href: "/dashboard/disponibilidad", emoji: "🕘", onlyAdmin: true },
              { label: "Horarios del equipo", href: "/dashboard/horarios", emoji: "🧑‍🔧", onlyAdmin: true },
              { label: "Ofertas", href: "/dashboard/ofertas", emoji: "🎁", onlyAdmin: true },
              { label: "Atrasos y cancelaciones", href: "/dashboard/politica", emoji: "⏱️", onlyAdmin: true },
              { label: "Cupones", href: "/dashboard/cupones", emoji: "🏷️", onlyAdmin: true },
              { label: "Revisar reservas", href: "/dashboard/seguridad", emoji: "🛡️", onlyAdmin: true },
              { label: "Fotos guardadas", href: "/dashboard/fotos", emoji: "🖼️", onlyAdmin: true },
              { label: "Descargar respaldo", href: "/api/respaldo", emoji: "💾", onlyAdmin: true },
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

          {/* El plan gratuito de Supabase NO incluye respaldos (verificado en
              el panel el 26-jul). Decirlo acá, donde está el botón, en vez de
              dejar que alguien asuma que "seguro el proveedor los tiene". */}
          {perfil.rol === "admin" && (
            <p className="mt-4 rounded-2xl bg-[#fde4c8] px-5 py-4 text-xs leading-relaxed text-[#7a4d10]">
              💾 <strong>El plan actual de la base de datos no hace respaldos
              automáticos.</strong> Si se pierden los datos, no hay de dónde
              recuperarlos. Descargue el respaldo cada cierto tiempo y guárdelo
              fuera del computador del local.
            </p>
          )}
        </div>
      </main>
      <Footer />
    </>
  );
}
