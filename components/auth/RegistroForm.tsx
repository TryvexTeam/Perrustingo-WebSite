"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";
import { createClient } from "@/lib/supabase/client";

/* Registro comunitario (pedido de Rodolfo 19-jul): nombre y apellido,
   comuna, telefono, email + contrasena. Nada mas — no invade. */

const inputClass =
  "w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-[15px] text-ink outline-none transition focus:border-teal-dark focus:ring-2 focus:ring-teal-dark/20";

export function RegistroForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next");
  const [isPending, startTransition] = useTransition();
  const [nombre, setNombre] = useState("");
  const [apellido, setApellido] = useState("");
  const [comuna, setComuna] = useState("");
  const [telefono, setTelefono] = useState("");
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
      const { error: err } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { nombre, apellido, comuna, telefono },
        },
      });
      if (err) {
        if (err.message.toLowerCase().includes("already registered") || err.message.toLowerCase().includes("already exists")) {
          setError("Ya tienes una cuenta con ese correo.");
        } else {
          setError("No pudimos crear tu cuenta. Intenta de nuevo.");
        }
        return;
      }
      router.push(next && next.startsWith("/") ? next : "/perfil");
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="nombre" className="mb-1.5 block text-sm font-semibold text-ink">
            Nombre
          </label>
          <input
            id="nombre"
            type="text"
            autoComplete="given-name"
            required
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            placeholder="Ej: Maria"
            className={inputClass}
          />
        </div>
        <div>
          <label htmlFor="apellido" className="mb-1.5 block text-sm font-semibold text-ink">
            Apellido
          </label>
          <input
            id="apellido"
            type="text"
            autoComplete="family-name"
            required
            value={apellido}
            onChange={(e) => setApellido(e.target.value)}
            placeholder="Ej: Rojas"
            className={inputClass}
          />
        </div>
      </div>

      <div>
        <label htmlFor="comuna" className="mb-1.5 block text-sm font-semibold text-ink">
          Comuna
        </label>
        <input
          id="comuna"
          type="text"
          autoComplete="address-level2"
          required
          value={comuna}
          onChange={(e) => setComuna(e.target.value)}
          placeholder="Ej: Renca"
          className={inputClass}
        />
      </div>

      <div>
        <label htmlFor="telefono" className="mb-1.5 block text-sm font-semibold text-ink">
          Telefono
        </label>
        <input
          id="telefono"
          type="tel"
          autoComplete="tel"
          required
          pattern="^\+?[\d\s]{8,15}$"
          value={telefono}
          onChange={(e) => setTelefono(e.target.value)}
          placeholder="+56 9 1234 5678"
          className={inputClass}
        />
      </div>

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
          className={inputClass}
        />
      </div>

      <div>
        <label htmlFor="password" className="mb-1.5 block text-sm font-semibold text-ink">
          Contrasena
        </label>
        <input
          id="password"
          type="password"
          autoComplete="new-password"
          required
          minLength={6}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Minimo 6 caracteres"
          className={inputClass}
        />
      </div>

      {error && (
        <p className="rounded-2xl bg-red-50 px-4 py-3 text-sm font-medium text-red-600">
          {error}{" "}
          {error.includes("Ya tienes una cuenta") && (
            <Link
              href={next ? `/login?next=${encodeURIComponent(next)}` : "/login"}
              className="font-bold underline underline-offset-2"
            >
              Iniciar sesion
            </Link>
          )}
        </p>
      )}

      <button
        type="submit"
        disabled={isPending}
        className="w-full rounded-full bg-orange px-8 py-3.5 font-display text-base font-extrabold text-teal-ink shadow-[0_3px_0_rgba(6,58,64,.25)] transition-[background-color,transform,box-shadow] duration-150 hover:bg-[#f7ab52] hover:shadow-[0_5px_0_rgba(6,58,64,.25)] active:translate-y-0.5 active:shadow-[0_1px_0_rgba(6,58,64,.25)] disabled:opacity-60"
      >
        {isPending ? "Creando cuenta..." : "Crear cuenta gratis"}
      </button>

      <p className="text-center text-xs leading-relaxed text-ink-soft">
        Al registrarte aceptas nuestras{" "}
        <a href="/politicas" className="underline underline-offset-2">
          politicas de privacidad
        </a>
        .
      </p>
    </form>
  );
}
