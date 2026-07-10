"use client";

import { useEffect, useState } from "react";

const LANGS = [
  { code: "es", flag: "🇨🇱", label: "Español" },
  { code: "pt", flag: "🇧🇷", label: "Português" },
  { code: "de", flag: "🇩🇪", label: "Deutsch" },
];

const TRANSLATIONS: Record<string, Record<string, string>> = {
  es: {
    hero_title: "Llega hecho un desastre,\nse va hecho un rey.",
    hero_sub: "Bañamos, cortamos y consentimos a tu perro en Renca.",
    cta_wp: "Agenda por WhatsApp",
    cta_reserva: "Reserva inteligente →",
    cta_login: "Iniciar sesión",
    cta_registro: "Crear cuenta gratis",
  },
  pt: {
    hero_title: "Chega uma bagunça,\nvai embora um rei.",
    hero_sub: "Banho, tosa e cuidados para o seu cachorro em Renca.",
    cta_wp: "Agendar pelo WhatsApp",
    cta_reserva: "Reserva inteligente →",
    cta_login: "Entrar",
    cta_registro: "Criar conta grátis",
  },
  de: {
    hero_title: "Kommt als Chaos an,\ngeht als König raus.",
    hero_sub: "Baden, schneiden und verwöhnen — für Ihren Hund in Renca.",
    cta_wp: "Termin per WhatsApp",
    cta_reserva: "Intelligente Buchung →",
    cta_login: "Anmelden",
    cta_registro: "Konto erstellen",
  },
};

const LANG_KEY = "perrustingo_lang";

function applyLang(code: string) {
  const t = TRANSLATIONS[code];
  if (!t) return;
  document.documentElement.lang = code === "es" ? "es" : code === "pt" ? "pt-BR" : "de";
  // Inject translations via CSS custom properties available to JS components
  Object.entries(t).forEach(([k, v]) => {
    document.documentElement.setAttribute(`data-t-${k}`, v);
  });
}

export function LangSwitcher() {
  const [lang, setLang] = useState("es");
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem(LANG_KEY);
    if (saved && LANGS.find((l) => l.code === saved)) {
      setLang(saved);
      applyLang(saved);
    }
  }, []);

  function switchLang(code: string) {
    setLang(code);
    setOpen(false);
    localStorage.setItem(LANG_KEY, code);
    applyLang(code);
  }

  const current = LANGS.find((l) => l.code === lang)!;

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label="Cambiar idioma"
        className="flex items-center gap-1.5 rounded-full border border-zinc-200 bg-white/80 px-3 py-1.5 text-sm font-bold text-ink backdrop-blur-sm transition hover:border-zinc-300 hover:bg-white"
      >
        <span>{current.flag}</span>
        <span className="hidden sm:inline">{current.label}</span>
        <svg viewBox="0 0 16 16" fill="currentColor" className="h-3 w-3 text-ink-soft" aria-hidden="true">
          <path d="M8 10.5 3.5 6h9L8 10.5Z" />
        </svg>
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full z-50 mt-2 min-w-[140px] overflow-hidden rounded-2xl border border-zinc-100 bg-white shadow-xl">
            {LANGS.map((l) => (
              <button
                key={l.code}
                onClick={() => switchLang(l.code)}
                className={`flex w-full items-center gap-2.5 px-4 py-2.5 text-sm font-semibold transition hover:bg-cream ${
                  l.code === lang ? "text-teal-dark" : "text-ink"
                }`}
              >
                <span>{l.flag}</span>
                <span>{l.label}</span>
                {l.code === lang && (
                  <svg viewBox="0 0 16 16" fill="currentColor" className="ml-auto h-3.5 w-3.5 text-teal-dark" aria-hidden="true">
                    <path d="M13.5 3.5 6 11 2.5 7.5l-1 1L6 13l8.5-8.5-1-1Z" />
                  </svg>
                )}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
