"use client";

import { useEffect } from "react";

/** Parallax del hero: las capas (foto, nubes, estrellas) se mueven suave con el mouse. */
export function HeroParallax() {
  useEffect(() => {
    const hero = document.getElementById("inicio");
    if (!hero) return;
    const capas: { el: HTMLElement; fx: number; fy: number }[] = [];
    hero.querySelectorAll<HTMLElement>("img").forEach((el) => {
      capas.push({ el, fx: 14, fy: 10 });
    });
    hero
      .querySelectorAll<HTMLElement>(".pointer-events-none.absolute")
      .forEach((el) => {
        capas.push({ el, fx: -10, fy: -7 });
      });
    capas.forEach(({ el }) => {
      el.style.transition = "transform .35s ease-out";
      el.style.willChange = "transform";
    });
    const onMove = (ev: MouseEvent) => {
      if (window.scrollY > window.innerHeight) return;
      const x = ev.clientX / window.innerWidth - 0.5;
      const y = ev.clientY / window.innerHeight - 0.5;
      capas.forEach(({ el, fx, fy }) => {
        el.style.transform = `translate(${x * fx}px, ${y * fy}px)`;
      });
    };
    window.addEventListener("mousemove", onMove, { passive: true });
    return () => window.removeEventListener("mousemove", onMove);
  }, []);

  return null;
}
