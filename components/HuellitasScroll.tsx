"use client";

import { useEffect, useRef } from "react";
import { PawIcon } from "./PawIcon";

const PUNTOS = [
  { left: "5vw", top: "24vh", rot: "-18deg", color: "fill-teal-dark/50" },
  { left: "90vw", top: "38vh", rot: "12deg", color: "fill-orange/60" },
  { left: "7vw", top: "56vh", rot: "8deg", color: "fill-[#7dc3e8]/60" },
  { left: "88vw", top: "72vh", rot: "-10deg", color: "fill-teal-dark/50" },
  { left: "9vw", top: "86vh", rot: "14deg", color: "fill-orange/60" },
];

/** Huellitas fijas que van apareciendo a medida que se scrollea la página. */
export function HuellitasScroll() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const nodo = ref.current;
    if (!nodo) return;
    const huellas = Array.from(nodo.children) as HTMLElement[];
    const onScroll = () => {
      const max = Math.max(document.body.scrollHeight - window.innerHeight, 1);
      const progreso = window.scrollY / max;
      huellas.forEach((h, i) => {
        const visible = progreso > (i + 1) / (huellas.length + 1) - 0.12;
        h.style.opacity = visible ? "1" : "0";
        h.style.transform = visible
          ? `scale(1) rotate(${h.dataset.rot})`
          : `scale(0.4) rotate(-25deg)`;
      });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div ref={ref} aria-hidden="true" className="pointer-events-none">
      {PUNTOS.map((p, i) => (
        <div
          key={i}
          data-rot={p.rot}
          className="fixed z-[5] opacity-0"
          style={{
            left: p.left,
            top: p.top,
            transition:
              "opacity .8s ease, transform .8s cubic-bezier(.34,1.56,.64,1)",
            transitionDelay: `${(i % 3) * 120}ms`,
          }}
        >
          <PawIcon className={`h-9 w-9 ${p.color}`} />
        </div>
      ))}
    </div>
  );
}
