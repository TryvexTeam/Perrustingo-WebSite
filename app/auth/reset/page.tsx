import type { Metadata } from "next";
import { NuevaPasswordForm } from "@/components/auth/NuevaPasswordForm";
import { SiteMenu } from "@/components/SiteMenu";

export const metadata: Metadata = {
  title: "Nueva contraseña — Perrustingo",
};

export default function ResetPage() {
  return (
    <>
      <SiteMenu />
      <main className="flex min-h-screen flex-col items-center justify-center bg-cream px-5 py-20">
        <div className="w-full max-w-sm">
          <div className="mb-8 text-center">
            <p className="text-xs font-extrabold uppercase tracking-[0.22em] text-teal-dark">
              Nueva contraseña
            </p>
            <h1 className="mt-2 font-display text-3xl font-extrabold tracking-tight text-ink">
              Crea tu nueva contraseña
            </h1>
          </div>
          <NuevaPasswordForm />
        </div>
      </main>
    </>
  );
}
