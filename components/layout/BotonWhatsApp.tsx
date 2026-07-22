import Link from "next/link";

/** Botón flotante, siempre visible, para agendar una cita. */
export function BotonWhatsApp() {
  return (
    <Link
      href="/reserva"
      aria-label="Agendar una cita"
      className="group fixed bottom-5 right-5 z-40 flex items-center gap-2.5 rounded-full bg-teal-dark py-3.5 pl-4 pr-5 font-display text-[15px] font-extrabold text-white shadow-[0_8px_24px_rgba(6,58,64,.28)] transition-[transform,box-shadow] duration-200 hover:-translate-y-1 hover:shadow-[0_14px_34px_rgba(6,58,64,.36)]"
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="h-6 w-6 flex-none">
        <rect x="3" y="4" width="18" height="18" rx="3" />
        <path d="M3 9h18" />
        <path d="M8 2v4" />
        <path d="M16 2v4" />
        <path d="m9 16 2 2 4-4" />
      </svg>
      <span className="hidden sm:inline">Agenda tu cita</span>
    </Link>
  );
}
