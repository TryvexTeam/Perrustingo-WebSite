import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SiteMenu } from "@/components/layout/SiteMenu";
import { Footer } from "@/components/layout/Footer";
import { PanelSospechas } from "@/components/admin/PanelSospechas";
import { detectarSospechas, inicioVentana, type FilaSospecha } from "@/lib/sospechas";

export const metadata: Metadata = {
  title: "Revisión de reservas — Perrustingo",
  robots: { index: false, follow: false },
};

/* Revisión de reservas raras (PRP-004 F6).

   La última capa de defensa, y a propósito la menos automática. Las anteriores
   frenan lo que se puede frenar sin riesgo; ésta se ocupa de lo que ninguna
   regla puede decidir sola: si diez reservas nuevas son un ataque o un buen
   día. Muestra la evidencia agrupada y deja el gatillo en manos del dueño. */

/* Una ráfaga es cosa de horas. Mirar más atrás no encuentra ataques: encuentra
   la operación normal del salón y la disfraza de alarma. */
const HORAS_VENTANA = 48;

export default async function SeguridadPage() {
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
  // Solo admin: acá se ven teléfonos agrupados y se cancela en bloque.
  if (perfil?.rol !== "admin") redirect("/dashboard");

  const desde = inicioVentana(HORAS_VENTANA);
  const { data: filas } = await supabase
    .from("sesiones")
    .select("id, created_at, fecha_cita, estado, contacto_telefono, contacto_nombre, cliente_id")
    .gte("created_at", desde)
    .order("created_at", { ascending: false });

  const reservas = (filas as FilaSospecha[]) ?? [];
  const alertas = detectarSospechas(reservas);
  const sinCuenta = reservas.filter((r) => !r.cliente_id).length;

  return (
    <>
      <SiteMenu />
      <main className="min-h-screen bg-cream px-5 pb-16 pt-28">
        <div className="mx-auto max-w-2xl">
          <p className="text-xs font-extrabold uppercase tracking-[0.22em] text-teal-dark">
            Revisión
          </p>
          <h1 className="mt-1 font-display text-3xl font-extrabold tracking-tight text-ink">
            Reservas que vale la pena mirar
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-ink-soft">
            Últimas {HORAS_VENTANA} horas: <strong>{reservas.length}</strong>{" "}
            {reservas.length === 1 ? "reserva" : "reservas"}
            {reservas.length > 0 && `, ${sinCuenta} sin cuenta`}.
          </p>

          <div className="mt-6">
            <PanelSospechas alertas={alertas} />
          </div>

          {/* Decir la verdad sobre lo que esta pantalla NO hace. Un panel de
              seguridad que se presenta como infalible es peor que no tenerlo:
              hace que nadie mire la agenda. */}
          <div className="mt-8 rounded-3xl bg-white p-6 shadow-sm">
            <h2 className="font-display text-base font-extrabold text-ink">
              Qué alcanza a frenar la plataforma
            </h2>
            <ul className="mt-3 space-y-2 text-sm leading-relaxed text-ink-soft">
              <li>
                ✅ Un mismo teléfono no puede tener más de{" "}
                <strong>4 citas activas</strong> ni pedir más de{" "}
                <strong>5 reservas por hora</strong>.
              </li>
              <li>
                ✅ Nadie puede averiguar desde afuera si un teléfono es cliente
                del salón.
              </li>
              <li>
                ⚠️ Lo que <strong>no</strong> se puede frenar solo: alguien con
                muchos teléfonos distintos, uno por reserva. Para eso está esta
                pantalla — y por eso avisa en vez de cancelar.
              </li>
            </ul>
            <p className="mt-4 rounded-2xl bg-[#fde4c8] px-4 py-3 text-xs leading-relaxed text-[#7a4d10]">
              💡 Ante la duda, <strong>escriba por WhatsApp antes de cancelar</strong>.
              Cancelarle a un cliente real cuesta mucho más caro que atender una
              cita falsa.
            </p>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
