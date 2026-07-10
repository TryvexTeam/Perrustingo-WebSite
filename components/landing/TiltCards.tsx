"use client";

import { useEffect } from "react";

const SELECTOR = "#servicios a, .tilt-card";

/** Inclinación 3D suave al pasar el mouse sobre las cards (delegado, sin tocar cada card). */
export function TiltCards() {
  useEffect(() => {
    const onMove = (ev: MouseEvent) => {
      const card = (ev.target as HTMLElement | null)?.closest?.(
        SELECTOR
      ) as HTMLElement | null;
      if (!card) return;
      const r = card.getBoundingClientRect();
      const x = (ev.clientX - r.left) / r.width - 0.5;
      const y = (ev.clientY - r.top) / r.height - 0.5;
      card.style.transition = "transform .18s ease-out";
      card.style.transform = `perspective(800px) rotateY(${x * 7}deg) rotateX(${-y * 7}deg) translateY(-4px)`;
    };
    const onOut = (ev: MouseEvent) => {
      const card = (ev.target as HTMLElement | null)?.closest?.(
        SELECTOR
      ) as HTMLElement | null;
      if (!card) return;
      const hacia = ev.relatedTarget as Node | null;
      if (hacia && card.contains(hacia)) return;
      card.style.transform = "";
    };
    document.addEventListener("mousemove", onMove, { passive: true });
    document.addEventListener("mouseout", onOut, { passive: true });
    return () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseout", onOut);
    };
  }, []);

  return null;
}
