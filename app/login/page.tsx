import type { Metadata } from "next";
import { LoginForm } from "@/components/auth/LoginForm";
import { SiteMenu } from "@/components/SiteMenu";

export const metadata: Metadata = {
  title: "Iniciar sesión — Perrustingo",
  description: "Accede a tu cuenta para ver el historial y agendar con tus datos guardados.",
};

export default function LoginPage() {
  return (
    <>
      <SiteMenu />
      <main className="flex min-h-screen flex-col items-center justify-center bg-cream px-5 py-20">
        <div className="w-full max-w-sm">
          <div className="mb-8 text-center">
            <p className="text-xs font-extrabold uppercase tracking-[0.22em] text-teal-dark">
              Bienvenido de vuelta
            </p>
            <h1 className="mt-2 font-display text-3xl font-extrabold tracking-tight text-ink">
              Iniciar sesión
            </h1>
            <p className="mt-3 text-sm leading-relaxed text-ink-soft">
              Accede para ver tu historial, datos de tu perro y agendar más rápido.
            </p>
          </div>
          <LoginForm />
          <p className="mt-6 text-center text-sm text-ink-soft">
            ¿Primera vez?{" "}
            <a href="/registro" className="font-semibold text-teal-dark underline underline-offset-2">
              Crea tu cuenta
            </a>
          </p>
        </div>
      </main>
    </>
  );
}
