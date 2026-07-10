import { BOOKING_URL } from "@/lib/site";

/** Botón flotante de WhatsApp, siempre visible para agendar. */
export function BotonWhatsApp() {
  return (
    <a
      href={BOOKING_URL}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Agendar por WhatsApp"
      className="group fixed bottom-5 right-5 z-40 flex items-center gap-2.5 rounded-full bg-[#25D366] py-3.5 pl-4 pr-5 font-display text-[15px] font-extrabold text-white shadow-[0_8px_24px_rgba(6,58,64,.28)] transition-[transform,box-shadow] duration-200 hover:-translate-y-1 hover:shadow-[0_14px_34px_rgba(6,58,64,.36)]"
    >
      <span
        aria-hidden="true"
        className="absolute inset-0 animate-ping rounded-full border-2 border-[#25D366] opacity-60 [animation-duration:2.2s]"
      />
      <svg viewBox="0 0 32 32" fill="currentColor" aria-hidden="true" className="h-6 w-6 flex-none">
        <path d="M16 3C9.4 3 4 8.3 4 14.9c0 2.6.9 5 2.3 7L4 29l7.3-2.3c1.9 1 4 1.6 6.2 1.6 6.6 0 12-5.3 12-11.9C29.5 8.3 22.6 3 16 3zm6.6 16.9c-.3.8-1.6 1.5-2.3 1.6-.6.1-1.3.2-3.8-.8-3.2-1.3-5.2-4.5-5.4-4.7-.2-.2-1.3-1.7-1.3-3.2s.8-2.3 1.1-2.6c.3-.3.6-.4.8-.4h.6c.2 0 .5-.1.7.5l1 2.5c.1.2.1.4 0 .6-.1.2-.2.4-.4.6l-.6.7c-.2.2-.4.4-.2.8.2.4 1 1.7 2.2 2.7 1.5 1.3 2.8 1.7 3.2 1.9.4.2.6.2.8-.1.2-.3 1-1.1 1.2-1.5.3-.4.5-.3.9-.2l2.4 1.1c.4.2.6.3.7.4.1.2.1.8-.2 1.6z" />
      </svg>
      <span className="hidden sm:inline">Agenda tu cita</span>
    </a>
  );
}
