"use client";

import Link from "next/link";

import { useState, useTransition } from "react";
import { createClient } from "@/lib/supabase/client";

export function RegistroForm() {
  const [isPending, startTransition] = useTransition();
  const [nombre, setNombre] = useState("");
  const [telefono, setTelefono] = useState("");
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
          shouldCreateUser: true,
          data: { nombre, telefono },
        },
      });
      if (err) {
        setError("No pudimos crear tu cuenta. Intenta de nuevo.");
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
          ¡Ya casi está!
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-ink-soft">
          Enviamos un enlace de activación a <strong>{email}</strong>.
          Aprieta el botón del correo para activar tu cuenta y entrar.
        </p>
        <p className="mt-4 text-xs text-ink-soft">El enlace expira en 1 hora.</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="nombre" className="mb-1.5 block text-sm font-semibold text-ink">
          Tu nombre
        </label>
        <input
          id="nombre"
          type="text"
          autoComplete="given-name"
          required
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          placeholder="Ej: María"
          className="w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-[15px] text-ink outline-none transition focus:border-teal-dark focus:ring-2 focus:ring-teal-dark/20"
        />
      </div>

      <div>
        <label htmlFor="telefono" className="mb-1.5 block text-sm font-semibold text-ink">
          Teléfono{" "}
          <span className="font-normal text-ink-soft">(opcional)</span>
        </label>
        <input
          id="telefono"
          type="tel"
          autoComplete="tel"
          value={telefono}
          onChange={(e) => setTelefono(e.target.value)}
          placeholder="+56 9 1234 5678"
          className="w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-[15px] text-ink outline-none transition focus:border-teal-dark focus:ring-2 focus:ring-teal-dark/20"
        />
      </div>

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
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={isPending}
        className="w-full rounded-full bg-orange px-8 py-3.5 font-display text-base font-extrabold text-teal-ink shadow-[0_3px_0_rgba(6,58,64,.25)] transition-[background-color,transform,box-shadow] duration-150 hover:bg-[#f7ab52] hover:shadow-[0_5px_0_rgba(6,58,64,.25)] active:translate-y-0.5 active:shadow-[0_1px_0_rgba(6,58,64,.25)] disabled:opacity-60"
      >
        {isPending ? "Creando cuenta…" : "Crear cuenta gratis →"}
      </button>

      <p className="text-center text-xs leading-relaxed text-ink-soft">
        Al registrarte aceptas nuestras{" "}
        <a href="/politicas" className="underline underline-offset-2">
          políticas de privacidad
        </a>
        .
      </p>
    </form>
  );
}
