"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function RegistroForm() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [nombre, setNombre] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (password !== confirmPassword) {
      setError("Las contraseñas no coinciden.");
      return;
    }
    if (password.length < 8) {
      setError("La contraseña debe tener al menos 8 caracteres.");
      return;
    }

    startTransition(async () => {
      const supabase = createClient();
      const { error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { nombre },
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      });

      if (authError) {
        setError(authError.message);
        return;
      }

      setSuccess(true);
    });
  }

  if (success) {
    return (
      <div className="rounded-3xl bg-[#d8f0e3] p-6 text-center">
        <p className="text-2xl">📬</p>
        <h2 className="mt-2 font-display text-lg font-extrabold text-ink">
          Revisa tu correo
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-ink-soft">
          Te enviamos un enlace de confirmación a <strong>{email}</strong>.
          Haz clic en él para activar tu cuenta.
        </p>
        <a
          href="/"
          className="mt-4 inline-block text-sm font-semibold text-teal-dark underline underline-offset-2"
        >
          Volver al inicio
        </a>
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

      <div>
        <label htmlFor="password" className="mb-1.5 block text-sm font-semibold text-ink">
          Contraseña
        </label>
        <input
          id="password"
          type="password"
          autoComplete="new-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Mínimo 8 caracteres"
          className="w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-[15px] text-ink outline-none transition focus:border-teal-dark focus:ring-2 focus:ring-teal-dark/20"
        />
      </div>

      <div>
        <label htmlFor="confirm" className="mb-1.5 block text-sm font-semibold text-ink">
          Confirmar contraseña
        </label>
        <input
          id="confirm"
          type="password"
          autoComplete="new-password"
          required
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          placeholder="Repite tu contraseña"
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
        {isPending ? "Creando cuenta…" : "Crear cuenta →"}
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
