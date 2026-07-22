"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";
import { createClient } from "@/lib/supabase/client";

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next");
  const [isPending, startTransition] = useTransition();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    startTransition(async () => {
      const supabaseUrl = process["env"]["NEXT_PUBLIC_SUPABASE_URL"] as string;
      if (!supabaseUrl || supabaseUrl.includes("TU_PROYECTO")) {
        setError("Las cuentas estaran disponibles muy pronto.");
        return;
      }
      const supabase = createClient();
      const { error: err } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (err) {
        setError("Correo o contrasena incorrectos. Intentalo de nuevo.");
        return;
      }
      router.push(next && next.startsWith("/") ? next : "/dashboard");
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="email" className="mb-1.5 block text-sm font-semibold text-ink">
          Correo electronico
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
          Contrasena
        </label>
        <input
          id="password"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Tu contrasena"
          className="w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-[15px] text-ink outline-none transition focus:border-teal-dark focus:ring-2 focus:ring-teal-dark/20"
        />
        <div className="mt-1.5 text-right">
          <Link href="/recuperar-contrasena" className="text-xs text-teal-dark hover:underline">
            Olvide mi contrasena
          </Link>
        </div>
      </div>

      {error && (
        <p className="rounded-2xl bg-red-50 px-4 py-3 text-sm font-medium text-red-600">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={isPending}
        className="w-full rounded-full bg-teal-dark px-8 py-3.5 font-display text-base font-extrabold text-white shadow-[0_3px_0_rgba(6,58,64,.4)] transition-[background-color,transform,box-shadow] duration-150 hover:bg-teal hover:shadow-[0_5px_0_rgba(6,58,64,.4)] active:translate-y-0.5 active:shadow-[0_1px_0_rgba(6,58,64,.4)] disabled:opacity-60"
      >
        {isPending ? "Entrando..." : "Iniciar sesion"}
      </button>

      <p className="text-center text-sm text-ink-soft">
        No tienes cuenta?{" "}
        <Link
          href={next ? `/registro?next=${encodeURIComponent(next)}` : "/registro"}
          className="font-bold text-teal-dark hover:underline"
        >
          Registrate gratis
        </Link>
      </p>
    </form>
  );
}
