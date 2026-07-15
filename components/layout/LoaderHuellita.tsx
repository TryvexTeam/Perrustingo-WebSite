"use client";

import { useEffect, useState } from "react";
import { PawIcon } from "@/components/ui/PawIcon";

/** Pantalla de carga con huellita rebotando; se desvanece al cargar la página. */
export function LoaderHuellita() {
  const [fuera, setFuera] = useState(false);
  const [quitado, setQuitado] = useState(false);

  useEffect(() => {
    const salir = () => {
      setTimeout(() => setFuera(true), 400);
      setTimeout(() => setQuitado(true), 1200);
    };
    if (document.readyState === "complete") salir();
    else {
      window.addEventListener("load", salir);
      const respaldo = setTimeout(salir, 3500);
      return () => {
        window.removeEventListener("load", salir);
        clearTimeout(respaldo);
      };
    }
  }, []);

  if (quitado) return null;

  return (
    <div
      aria-hidden="true"
      className={`fixed inset-0 z-[100] flex flex-col items-center justify-center gap-3 bg-[#b6dfea] transition-opacity duration-700 ${
        fuera ? "pointer-events-none opacity-0" : "opacity-100"
      }`}
    >
      <div className="animate-bounce">
        <PawIcon className="h-14 w-14 fill-teal-ink" />
      </div>
      <span className="font-display text-xs font-extrabold uppercase tracking-[0.22em] text-teal-ink">
        Perrustingo
      </span>
    </div>
  );
}
