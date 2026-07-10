import type { Metadata } from "next";
import { RegistroForm } from "@/components/auth/RegistroForm";
import { SiteMenu } from "@/components/layout/SiteMenu";

export const metadata: Metadata = {
  title: "Crear cuenta — Perrustingo",
  description: "Regístrate para guardar los datos de tu perro y agendar más rápido.",
};

export default function RegistroPage() {
  return (
    <>
      <SiteMenu />
      <main className="flex min-h-screen flex-col items-center justify-center bg-cream px-5 py-20">
        <div className="w-full max-w-sm">
          <div className="mb-8 text-center">
            <p className="text-xs font-extrabold uppercase tracking-[0.22em] text-teal-dark">
              Nuevo cliente
            </p>
            <h1 className="mt-2 font-display text-3xl font-extrabold tracking-tight text-ink">
              Crea tu cuenta
            </h1>
            <p className="mt-3 text-sm leading-relaxed text-ink-soft">
              Guarda los datos de tu perro y agenda más rápido la próxima vez.
            </p>
          </div>
          <RegistroForm />
          <p className="mt-6 text-center text-sm text-ink-soft">
            ¿Ya tienes cuenta?{" "}
            <a href="/login" className="font-semibold text-teal-dark underline underline-offset-2">
              Inicia sesión
            </a>
          </p>
        </div>
      </main>
    </>
  );
}
