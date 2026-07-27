import type { Metadata } from "next";
import { Footer } from "@/components/layout/Footer";
import { SiteMenu } from "@/components/layout/SiteMenu";
import { SITE } from "@/lib/site";

export const metadata: Metadata = {
  title: "Políticas — Perrustingo",
  description:
    "Políticas de servicio, reservas y privacidad de Peluquería Canina Perrustingo.",
};

const SECCIONES = [
  {
    titulo: "Política de servicio",
    puntos: [
      "Confirmamos el precio final antes de comenzar, según el tamaño, el peso y el estado del pelo.",
      "Si el perro o la perra presenta conducta difícil durante la sesión (nervios, mordidas, movimiento constante), podemos aplicar un recargo y siempre informamos el motivo.",
      "Con perros sin baño por períodos prolongados podemos requerir trabajo adicional con recargo; lo conversamos contigo antes.",
      "Nos tomamos entre 2 y 3 horas en promedio por sesión completa.",
    ],
  },
  {
    titulo: "Política de reservas",
    puntos: [
      "Gestionamos las reservas por WhatsApp: indícanos nombre, raza o tamaño y el servicio.",
      "Recibimos citas hasta las 17:00. Los miércoles son nuestro día de mayor demanda.",
      "Si no puedes asistir, avísanos con anticipación para que liberemos el cupo a otra familia.",
    ],
  },
  {
    titulo: "Política de privacidad",
    puntos: [
      "Solo usamos tus datos de contacto (nombre y teléfono) para coordinar la atención de tu mascota.",
      "No compartimos tu información con terceros.",
      "Compartimos fotos de mascotas en nuestras redes solo con el consentimiento de sus dueños.",
    ],
  },
];

export default function PoliticasPage() {
  return (
    <>
      <SiteMenu />
      <main className="flex-1 bg-white px-5 pb-14 pt-28">
        <div className="mx-auto max-w-3xl">
          <h1 className="font-display text-4xl font-extrabold tracking-tight">
            Políticas de {SITE.name}
          </h1>
          <p className="mt-3 text-ink-soft">
            Reglas claras para que tu perro o perra y tú tengan la mejor experiencia.
          </p>
          {SECCIONES.map((seccion) => (
            <section key={seccion.titulo} className="mt-10">
              <h2 className="font-display text-2xl font-bold">{seccion.titulo}</h2>
              <ul className="mt-4 space-y-3">
                {seccion.puntos.map((punto) => (
                  <li key={punto} className="flex gap-3 text-[15px] leading-relaxed text-ink-soft">
                    <span aria-hidden="true" className="mt-0.5 text-teal">🐾</span>
                    {punto}
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </main>
      <Footer />
    </>
  );
}
