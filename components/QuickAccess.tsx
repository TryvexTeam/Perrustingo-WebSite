"use client";

import Link from "next/link";

/* Nav superior — solo el acceso a Reserva. "Mi cuenta" y "Crear cuenta"
   viven en el menú lateral (SiteMenu). */

function IconCalendar() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true" className="h-4 w-4 shrink-0">
      <path fillRule="evenodd" d="M5.75 2a.75.75 0 0 1 .75.75V4h7V2.75a.75.75 0 0 1 1.5 0V4h.25A2.75 2.75 0 0 1 18 6.75v8.5A2.75 2.75 0 0 1 15.25 18H4.75A2.75 2.75 0 0 1 2 15.25v-8.5A2.75 2.75 0 0 1 4.75 4H5V2.75A.75.75 0 0 1 5.75 2Zm-1 5.5A.25.25 0 0 0 4.5 7.75v7.5c0 .138.112.25.25.25h10.5a.25.25 0 0 0 .25-.25v-7.5a.25.25 0 0 0-.25-.25H4.75Z" clipRule="evenodd" />
    </svg>
  );
}

export function QuickAccess() {
  return (
    <div
      className="fixed left-1/2 top-3 z-40 -translate-x-1/2"
      role="navigation"
      aria-label="Accesos directos"
    >
      <Link
        href="/reserva"
        className="flex items-center gap-1.5 rounded-full bg-teal-dark/90 px-3.5 py-2 text-[12px] font-bold text-white shadow-md backdrop-blur-sm transition-all duration-150 hover:bg-teal-dark hover:shadow-lg active:scale-95 sm:text-[13px] sm:px-4"
      >
        <IconCalendar />
        <span className="hidden min-[430px]:inline">Reserva</span>
      </Link>
    </div>
  );
}
