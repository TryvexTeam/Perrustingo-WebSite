"use client";

import Link from "next/link";

// SVG icons — inline, no external dependencies
function IconCalendar() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true" className="h-4 w-4 shrink-0">
      <path fillRule="evenodd" d="M5.75 2a.75.75 0 0 1 .75.75V4h7V2.75a.75.75 0 0 1 1.5 0V4h.25A2.75 2.75 0 0 1 18 6.75v8.5A2.75 2.75 0 0 1 15.25 18H4.75A2.75 2.75 0 0 1 2 15.25v-8.5A2.75 2.75 0 0 1 4.75 4H5V2.75A.75.75 0 0 1 5.75 2Zm-1 5.5A.25.25 0 0 0 4.5 7.75v7.5c0 .138.112.25.25.25h10.5a.25.25 0 0 0 .25-.25v-7.5a.25.25 0 0 0-.25-.25H4.75Z" clipRule="evenodd" />
    </svg>
  );
}

function IconUser() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true" className="h-4 w-4 shrink-0">
      <path d="M10 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM3.465 14.493a1.23 1.23 0 0 0 .41 1.412A9.957 9.957 0 0 0 10 18c2.31 0 4.438-.784 6.131-2.1.43-.333.604-.903.408-1.41a7.002 7.002 0 0 0-13.074.003Z" />
    </svg>
  );
}

function IconUserPlus() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true" className="h-4 w-4 shrink-0">
      <path d="M11 5a3 3 0 1 1-6 0 3 3 0 0 1 6 0ZM2.046 15.253c-.058.468.172.92.57 1.175A9.953 9.953 0 0 0 8 18c1.982 0 3.83-.578 5.384-1.573.398-.255.628-.707.57-1.175a7.001 7.001 0 0 0-11.908.001ZM15.5 6.5a.5.5 0 0 0-1 0V8H13a.5.5 0 0 0 0 1h1.5v1.5a.5.5 0 0 0 1 0V9H17a.5.5 0 0 0 0-1h-1.5V6.5Z" />
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
      <div className="flex items-center gap-2">
        {/* Reserva inteligente */}
        <Link
          href="/reserva"
          className="flex items-center gap-1.5 rounded-full bg-teal-dark/90 px-3.5 py-2 text-[12px] font-bold text-white shadow-md backdrop-blur-sm transition-all duration-150 hover:bg-teal-dark hover:shadow-lg active:scale-95 sm:text-[13px] sm:px-4"
        >
          <IconCalendar />
          <span className="hidden sm:inline">Reserva</span>
        </Link>

        {/* Mi cuenta → va a /perfil, middleware redirige a /login si no está autenticado */}
        <Link
          href="/perfil"
          className="flex items-center gap-1.5 rounded-full bg-white/80 px-3.5 py-2 text-[12px] font-bold text-teal-dark shadow-md backdrop-blur-sm transition-all duration-150 hover:bg-white hover:shadow-lg active:scale-95 sm:text-[13px] sm:px-4"
        >
          <IconUser />
          <span className="hidden sm:inline">Mi cuenta</span>
        </Link>

        {/* Registro */}
        <Link
          href="/registro"
          className="flex items-center gap-1.5 rounded-full bg-orange/90 px-3.5 py-2 text-[12px] font-bold text-teal-ink shadow-md backdrop-blur-sm transition-all duration-150 hover:bg-orange hover:shadow-lg active:scale-95 sm:text-[13px] sm:px-4"
        >
          <IconUserPlus />
          <span className="hidden sm:inline">Crear cuenta</span>
        </Link>
      </div>
    </div>
  );
}
