"use client";

import { useEffect, useState } from "react";

const COOKIE_KEY = "perrustingo_cookies_accepted";

export function CookieBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!localStorage.getItem(COOKIE_KEY)) setVisible(true);
  }, []);

  function accept() {
    localStorage.setItem(COOKIE_KEY, "true");
    setVisible(false);
  }

  function reject() {
    localStorage.setItem(COOKIE_KEY, "false");
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div
      role="dialog"
      aria-label="Aviso de cookies"
      className="fixed bottom-4 left-4 right-4 z-50 mx-auto max-w-xl rounded-3xl bg-teal-ink p-5 shadow-2xl md:left-auto md:right-6 md:max-w-sm"
    >
      <p className="text-[13px] leading-relaxed text-white/90">
        Usamos cookies esenciales para el funcionamiento del sitio. Sin datos de
        marketing.{" "}
        <a
          href="/politicas"
          className="underline underline-offset-2 hover:text-white"
        >
          Política de privacidad
        </a>{" "}
        (Ley 21.096 · GDPR).
      </p>
      <div className="mt-4 flex gap-3">
        <button
          onClick={accept}
          className="flex-1 rounded-full bg-orange py-2 text-sm font-extrabold text-teal-ink transition hover:bg-[#f7ab52]"
        >
          Aceptar
        </button>
        <button
          onClick={reject}
          className="flex-1 rounded-full border border-white/30 py-2 text-sm font-bold text-white/80 transition hover:border-white hover:text-white"
        >
          Rechazar
        </button>
      </div>
    </div>
  );
}
