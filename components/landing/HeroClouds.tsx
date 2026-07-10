"use client";

import { useEffect, useRef } from "react";

interface CloudSpec {
  className: string;
  factor: number;
}

interface CloudLayer extends CloudSpec {
  drift: string;
}

const CLOUDS: CloudLayer[] = [
  { className: "left-[-8%] top-[6%] w-32 opacity-90", drift: "animate-drift-slow", factor: -0.18 },
  { className: "right-[-6%] top-[14%] w-40 opacity-80", drift: "animate-drift", factor: 0.26 },
  { className: "left-[18%] top-[38%] w-16 opacity-60", drift: "animate-drift", factor: -0.34 },
  { className: "right-[10%] top-[46%] w-24 opacity-70", drift: "animate-drift-slow", factor: 0.16 },
  { className: "hidden md:block left-[30%] top-[8%] w-28 opacity-70", drift: "animate-drift", factor: -0.22 },
  { className: "hidden md:block left-[6%] top-[64%] w-36 opacity-60", drift: "animate-drift-slow", factor: 0.2 },
  { className: "left-[42%] top-[24%] w-20 opacity-50", drift: "animate-drift-slow", factor: 0.3 },
  { className: "right-[24%] top-[68%] w-28 opacity-60", drift: "animate-drift", factor: -0.14 },
];

function CloudShape() {
  return (
    <svg viewBox="0 0 200 60" aria-hidden="true" className="w-full fill-white">
      <ellipse cx="50" cy="45" rx="50" ry="18" />
      <ellipse cx="105" cy="35" rx="45" ry="24" />
      <ellipse cx="155" cy="46" rx="45" ry="16" />
    </svg>
  );
}

export function HeroClouds() {
  const refs = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) return;

    let raf = 0;
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const y = window.scrollY;
        refs.current.forEach((node, i) => {
          if (node) {
            node.style.transform = `translateX(${y * CLOUDS[i].factor}px)`;
          }
        });
      });
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
      {CLOUDS.map((cloud, i) => (
        <div
          key={i}
          ref={(node) => {
            refs.current[i] = node;
          }}
          className={`absolute will-change-transform ${cloud.className}`}
        >
          <div className={cloud.drift}>
            <CloudShape />
          </div>
        </div>
      ))}
    </div>
  );
}
