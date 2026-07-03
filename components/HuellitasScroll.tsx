"use client";

import { useEffect, useRef } from "react";

const PUNTOS = [
  { left: "5vw", top: "24vh", rot: "-14deg" },
  { left: "90vw", top: "38vh", rot: "10deg" },
  { left: "7vw", top: "56vh", rot: "8deg" },
  { left: "88vw", top: "72vh", rot: "-8deg" },
  { left: "9vw", top: "86vh", rot: "12deg" },
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
        h.style.opacity = visible ? "0.45" : "0";
        h.style.transform = visible
          ? `scale(1) rotate(${h.dataset.rot})`
          : `scale(0.4) rotate(-20deg)`;
      });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div ref={ref} aria-hidden="true" className="pointer-events-none">
      {PUNTOS.map((p, i) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={i}
          src="/decor/huella.png"
          alt=""
          data-rot={p.rot}
          className="fixed z-[5] h-8 w-auto opacity-0"
          style={{
            left: p.left,
            top: p.top,
            transition:
              "opacity .8s ease, transform .8s cubic-bezier(.34,1.56,.64,1)",
            transitionDelay: `${(i % 3) * 120}ms`,
          }}
        />
      ))}
    </div>
  );
}
