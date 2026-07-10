"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";

interface BeforeAfterSliderProps {
  beforeSrc: string;
  afterSrc: string;
  beforeAlt: string;
  afterAlt: string;
}

const INITIAL_POSITION = 50;
const IDLE_AMPLITUDE = 9;
const IDLE_PERIOD_MS = 5200;

export function BeforeAfterSlider({ beforeSrc, afterSrc, beforeAlt, afterAlt }: BeforeAfterSliderProps) {
  const [position, setPosition] = useState(INITIAL_POSITION);
  const interactedRef = useRef(false);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      if (interactedRef.current) return;
      const phase = ((now - start) / IDLE_PERIOD_MS) * Math.PI * 2;
      setPosition(INITIAL_POSITION + Math.sin(phase) * IDLE_AMPLITUDE);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  const stopIdle = () => {
    interactedRef.current = true;
  };

  return (
    <div className="relative mx-auto aspect-[3/4] w-full max-w-xl select-none overflow-hidden rounded-3xl shadow-md">
      <Image
        src={afterSrc}
        alt={afterAlt}
        fill
        sizes="(min-width: 768px) 36rem, 100vw"
        className="object-cover"
        draggable={false}
      />
      <div
        aria-hidden="true"
        className="absolute inset-0"
        style={{ clipPath: `inset(0 ${100 - position}% 0 0)` }}
      >
        <Image
          src={beforeSrc}
          alt={beforeAlt}
          fill
          sizes="(min-width: 768px) 36rem, 100vw"
          className="object-cover"
          draggable={false}
        />
      </div>

      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-y-0 w-[3px] -translate-x-1/2 bg-white shadow-[0_0_8px_rgba(6,58,64,.35)]"
        style={{ left: `${position}%` }}
      >
        <span className="absolute left-1/2 top-1/2 flex h-12 w-12 -translate-x-1/2 -translate-y-1/2 items-center justify-center gap-1 rounded-full bg-white text-teal-ink shadow-lg">
          <svg viewBox="0 0 8 12" className="h-3 w-2 fill-coral">
            <path d="M7 0 1 6l6 6V0Z" />
          </svg>
          <svg viewBox="0 0 8 12" className="h-3 w-2 fill-teal">
            <path d="M1 0l6 6-6 6V0Z" />
          </svg>
        </span>
      </div>

      <input
        type="range"
        min={0}
        max={100}
        value={Math.round(position)}
        onPointerDown={stopIdle}
        onKeyDown={stopIdle}
        onChange={(e) => {
          stopIdle();
          setPosition(Number(e.target.value));
        }}
        aria-label="Desliza para comparar el antes y el después"
        className="absolute inset-0 h-full w-full cursor-ew-resize opacity-0"
      />
    </div>
  );
}
