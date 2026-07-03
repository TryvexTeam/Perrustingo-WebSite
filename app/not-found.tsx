import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Página no encontrada — Perrustingo",
};

export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-cream px-5 text-center">
      <span className="text-7xl">🐾</span>
      <h1 className="mt-6 font-display text-5xl font-extrabold tracking-tight text-ink">
        404
      </h1>
      <p className="mt-2 font-display text-xl font-bold text-ink">
        Esta página se fue a pasear
      </p>
      <p className="mt-3 max-w-xs text-[15px] leading-relaxed text-ink-soft">
        No encontramos lo que buscas. Quizás el enlace cambió o el perro se lo comió.
      </p>
      <div className="mt-8 flex flex-wrap justify-center gap-4">
        <Link
          href="/"
          className="rounded-full bg-teal-dark px-7 py-3 font-display text-base font-extrabold text-white shadow-[0_3px_0_rgba(6,58,64,.4)] transition hover:bg-teal active:scale-[.97]"
        >
          Volver al inicio
        </Link>
        <Link
          href="/reserva"
          className="rounded-full bg-orange px-7 py-3 font-display text-base font-extrabold text-teal-ink shadow-[0_3px_0_rgba(6,58,64,.25)] transition hover:bg-[#f7ab52] active:scale-[.97]"
        >
          Hacer una reserva
        </Link>
      </div>
    </main>
  );
}
