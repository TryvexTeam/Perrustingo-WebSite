"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

export function LoginForm() {
  const [isPending, startTransition] = useTransition();
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    startTransition(async () => {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      if (!supabaseUrl || supabaseUrl.includes("TU_PROYECTO")) {
        setError("Las cuentas estarán disponibles muy pronto — seguimos configurando el sistema.");
        return;
      }
      const supabase = createClient();
      const { error: err } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
          shouldCreateUser: false,
        },
      });
      if (err) {
        setError("No encontramos esa cuenta. ¿Aún no te has registrado?");
        return;
      }
      setSent(true);
    });
  }

  if (sent) {
    return (
      <div className="rounded-3xl bg-[#d8f0e3] p-8 text-center">
        <p className="text-3xl">📬</p>
        <h2 className="mt-3 font-display text-lg font-extrabold text-ink">
          ¡Revisa tu correo!
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-ink-soft">
          Enviamos un enlace mágico a <strong>{email}</strong>.
          Aprieta el botón del correo y quedarás dentro automáticamente.
        </p>
        <p className="mt-4 text-xs text-ink-soft">El enlace expira en 1 hora.</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="email" className="mb-1.5 block text-sm font-semibold text-ink">
          Correo electrónico
        </label>
        <input
          id="email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="tu@correo.com"
          className="w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-[15px] text-ink outline-none transition focus:border-teal-dark focus:ring-2 focus:ring-teal-dark/20"
        />
      </div>

      {error && (
        <p className="rounded-2xl bg-red-50 px-4 py-3 text-sm font-medium text-red-600">
          {error}{" "}
          <Link href="/registro" className="font-bold underline underline-offset-2">
            Regístrate aquí
          </Link>
        </p>
      )}

      <button
        type="submit"
        disabled={isPending}
        className="w-full rounded-full bg-teal-dark px-8 py-3.5 font-display text-base font-extrabold text-white shadow-[0_3px_0_rgba(6,58,64,.4)] transition-[background-color,transform,box-shadow] duration-150 hover:bg-teal hover:shadow-[0_5px_0_rgba(6,58,64,.4)] active:translate-y-0.5 active:shadow-[0_1px_0_rgba(6,58,64,.4)] disabled:opacity-60"
      >
        {isPending ? "Enviando…" : "Enviar enlace mágico →"}
      </button>

      <p className="text-center text-sm text-ink-soft">
        ¿No tienes cuenta?{" "}
        <Link href="/registro" className="font-bold text-teal-dark hover:underline">
          Regístrate gratis
        </Link>
      </p>
    </form>
  );
}
