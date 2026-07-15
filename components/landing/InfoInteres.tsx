import { BOOKING_URL, SITE } from "@/lib/site";
import { Reveal } from "@/components/ui/Reveal";

export function InfoInteres() {
  return (
    <section id="visita" className="scroll-mt-20 bg-white px-5 py-16">
      <div className="mx-auto grid max-w-6xl gap-10 md:grid-cols-2">
        <Reveal>
          <div>
            <p className="text-xs font-extrabold uppercase tracking-[0.22em] text-teal-dark">
              Estamos en Renca
            </p>
            <h2 className="mt-2 font-display text-3xl font-extrabold tracking-tight md:text-4xl">
              Ven a conocernos
            </h2>
            <dl className="mt-6 space-y-5 text-[15px]">
              <div>
                <dt className="font-extrabold">📍 Dirección</dt>
                <dd className="mt-1 text-ink-soft">
                  {SITE.address} ·{" "}
                  <a
                    href={SITE.mapsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-bold text-teal-dark underline-offset-4 hover:underline"
                  >
                    Ver en Google Maps
                  </a>
                </dd>
              </div>
              <div>
                <dt className="font-extrabold">🚗 Cómo llegar</dt>
                <dd className="mt-1 text-ink-soft">
                  Estamos a 3–4 minutos en vehículo de la Plaza Mayor de Renca
                  y a 13–15 minutos caminando. A pasos del Liceo El Señor de
                  Renca, a un costado de Nelas Pizza (ex-Telepizza), donde
                  también hay paradas de locomoción colectiva a pocos metros.
                </dd>
              </div>
              <div>
                <dt className="font-extrabold">🕘 Horario</dt>
                <dd className="mt-1 text-ink-soft">
                  {SITE.hours}. Los miércoles son nuestro día de más demanda:
                  te recomendamos reservar con anticipación.
                </dd>
              </div>
              <div>
                <dt className="font-extrabold">💬 Reservas</dt>
                <dd className="mt-1 text-ink-soft">
                  Agendamos directo por WhatsApp: envíanos el nombre, la raza o
                  tamaño de tu perro y el servicio que necesitas.
                </dd>
              </div>
              <div>
                <dt className="font-extrabold">🏳️‍🌈 Para toda la familia</dt>
                <dd className="mt-1 text-ink-soft">
                  Somos un espacio amigable con la comunidad LGBTQ+ y con cada
                  perro que cruza nuestra puerta.
                </dd>
              </div>
            </dl>
            <a
              href={BOOKING_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-8 inline-block rounded-full bg-teal px-7 py-3.5 font-display text-base font-extrabold text-white shadow-[0_3px_0_rgba(6,58,64,.3)] transition-[background-color,transform] duration-150 hover:bg-teal-dark active:scale-[.97]"
            >
              Escríbenos por WhatsApp
            </a>
          </div>
        </Reveal>

        <Reveal delay={100}>
          <div className="overflow-hidden rounded-3xl border border-ink/10 shadow-sm">
            <iframe
              title="Mapa Perrustingo — Arturo Prat 4556, Renca"
              src="https://maps.google.com/maps?q=-33.4035606,-70.7133999&z=16&output=embed&hl=es"
              className="h-full min-h-[380px] w-full"
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              allowFullScreen
            />
          </div>
        </Reveal>
      </div>
    </section>
  );
}
