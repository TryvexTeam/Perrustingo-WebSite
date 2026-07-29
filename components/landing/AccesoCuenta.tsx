"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

/* Entrar / Registrarse a la vista en la portada (pedido de Rodolfo, 27-jul).

   Hasta ahora las dos opciones vivían solo dentro del menú desplegable: para
   encontrarlas había que abrirlo primero. Quien llega por primera vez no
   abre un menú a buscar dónde registrarse.

   Dos decisiones sobre cómo se ven y cuándo:

   1. Van DEBAJO del botón de reservar y con menos peso visual. La acción que
      le da plata al salón es la reserva; si los tres botones gritan igual,
      ninguno guía. Además el formulario de reserva ya permite reservar sin
      cuenta, así que registrarse no puede robarle el lugar.

   2. Dependen de la sesión, igual que el menú (ver SiteMenu). Ofrecerle
      "Crear cuenta" a alguien que ya tiene cuenta —y que está con sesión
      abierta— es el error que el señor Ignacio corrigió en el menú el 27-jul;
      no tiene sentido reintroducirlo en la portada.

   Mientras no se sabe si hay sesión no se muestra nada, pero el espacio SÍ
   se reserva (min-h): si los botones aparecieran de golpe empujarían el
   contenido de abajo, y ese salto se siente como que la página está rota. */

type Estado = "cargando" | "visitante" | "con-sesion";

export function AccesoCuenta() {
  const [estado, setEstado] = useState<Estado>("cargando");

  useEffect(() => {
    let vigente = true;
    const supabase = createClient();

    void (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!vigente) return;
      setEstado(user ? "con-sesion" : "visitante");
    })();

    return () => {
      // No escribir estado sobre un componente ya desmontado.
      vigente = false;
    };
  }, []);

  return (
    <div className="mt-5 flex min-h-[46px] flex-wrap items-center gap-3">
      {estado === "visitante" && (
        <>
          <Link
            href="/login"
            className="rounded-full border-2 border-teal-ink/25 bg-white/70 px-6 py-2.5 font-display text-sm font-extrabold text-teal-ink transition-colors duration-150 hover:border-teal-ink/45 hover:bg-white"
          >
            Iniciar sesión
          </Link>
          <Link
            href="/registro"
            className="rounded-full border-2 border-teal-ink/25 bg-white/70 px-6 py-2.5 font-display text-sm font-extrabold text-teal-ink transition-colors duration-150 hover:border-teal-ink/45 hover:bg-white"
          >
            Registrarse
          </Link>
          <span className="text-xs font-semibold text-teal-ink/60">
            También puedes reservar sin cuenta.
          </span>
        </>
      )}

      {estado === "con-sesion" && (
        <Link
          href="/perfil"
          className="rounded-full border-2 border-teal-ink/25 bg-white/70 px-6 py-2.5 font-display text-sm font-extrabold text-teal-ink transition-colors duration-150 hover:border-teal-ink/45 hover:bg-white"
        >
          Mi cuenta
        </Link>
      )}
    </div>
  );
}
