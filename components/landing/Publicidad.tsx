import { Reveal } from "@/components/ui/Reveal";
import { WHATSAPP_NUMBER, hayWhatsAppConfigurado } from "@/lib/site";

/* Invitación a publicitar en el sitio.

   Hasta el 27-jul esto eran tres tarjetas —"Espacio A", "Espacio B",
   "Espacio C"— de borde punteado, con un megáfono gris y sin nada dentro.
   El señor Ignacio pidió sacarlas, y con razón: tres huecos vacíos seguidos
   le dicen al visitante que el sitio está a medio hacer. Un salón que se ve
   incompleto es un salón en el que se confía menos, y quien entra a este
   sitio viene a reservar, no a comprar publicidad.

   Queda la invitación, que sí sirve al negocio, en una franja de una línea:
   ocupa la décima parte y dice exactamente lo mismo.

   El enlace a WhatsApp se mantiene directo a propósito, y no pasa por el
   formulario de reserva como el resto de los botones del sitio: acá escribe
   un negocio que quiere pauta, no un cliente con un perrito que agendar. */

const MENSAJE = encodeURIComponent(
  "Hola Perrustingo, me interesa publicitar mi negocio en su sitio web. ¿Podría darme más información?"
);

export function Publicidad() {
  /* Sin número configurado no se pinta el bloque. Antes había uno escrito
     acá —el mismo número alemán de prueba que estaba en lib/site.ts— y
     cualquiera que quisiera pautar le escribía a un desconocido. */
  if (!hayWhatsAppConfigurado()) return null;

  return (
    <section className="bg-section-blend px-5 py-12">
      <div className="mx-auto max-w-3xl">
        <Reveal>
          <div className="flex flex-col items-center gap-4 rounded-3xl bg-cream px-6 py-8 text-center sm:flex-row sm:justify-between sm:gap-6 sm:text-left">
            <div>
              <p className="text-xs font-extrabold uppercase tracking-[0.22em] text-teal-dark">
                Espacios publicitarios
              </p>
              <h2 className="mt-1.5 font-display text-xl font-extrabold tracking-tight text-ink md:text-2xl">
                ¿Tienes un negocio para mascotas?
              </h2>
              <p className="mt-1.5 text-sm leading-relaxed text-ink-soft">
                Llega a las familias con perros y perras de Renca y Santiago.
              </p>
            </div>
            <a
              href={`https://wa.me/${WHATSAPP_NUMBER}?text=${MENSAJE}`}
              target="_blank"
              rel="noopener noreferrer"
              className="shrink-0 rounded-full bg-teal px-6 py-3 font-display text-sm font-extrabold text-white shadow-[0_3px_0_rgba(6,58,64,.25)] transition-[background-color,transform] duration-150 hover:bg-teal-dark active:translate-y-0.5"
            >
              Consultar tarifas
            </a>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
