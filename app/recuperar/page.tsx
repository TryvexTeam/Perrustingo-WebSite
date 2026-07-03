import type { Metadata } from "next";
import { RecuperarForm } from "@/components/auth/RecuperarForm";
import { SiteMenu } from "@/components/SiteMenu";

export const metadata: Metadata = {
  title: "Recuperar contraseña — Perrustingo",
};

export default function RecuperarPage() {
  return (
    <>
      <SiteMenu />
      <main className="flex min-h-screen flex-col items-center justify-center bg-cream px-5 py-20">
        <div className="w-full max-w-sm">
          <div className="mb-8 text-center">
            <p className="text-xs font-extrabold uppercase tracking-[0.22em] text-teal-dark">
              Recuperar acceso
            </p>
            <h1 className="mt-2 font-display text-3xl font-extrabold tracking-tight text-ink">
              ¿Olvidaste tu contraseña?
            </h1>
            <p className="mt-3 text-sm leading-relaxed text-ink-soft">
              Escribe tu correo y te enviamos un enlace para crear una nueva.
            </p>
          </div>
          <RecuperarForm />
          <p className="mt-6 text-center text-sm text-ink-soft">
            <a href="/login" className="font-semibold text-teal-dark underline underline-offset-2">
              ← Volver al inicio de sesión
            </a>
          </p>
        </div>
      </main>
    </>
  );
}
