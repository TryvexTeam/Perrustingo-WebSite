"use client";

import { useState } from "react";

/* Avatar de raza — intenta cargar el render 3D desde /public/razas/;
   si aún no existe, cae a un avatar SVG con silueta de perrito.
   Así el catálogo funciona hoy y las fotos se enchufan después sin tocar código. */

const SIZE_CLASSES = {
  sm: "h-9 w-9",
  md: "h-14 w-14",
  lg: "h-20 w-20",
} as const;

interface BreedAvatarProps {
  src: string;
  nombre: string;
  size?: keyof typeof SIZE_CLASSES;
  className?: string;
}

function DogSilhouette({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" aria-hidden="true" className={className}>
      {/* orejas */}
      <path d="M10 16c-2 7 0 13 4 16 3-2 4.5-7 3.5-12-2.5-3.5-5.5-5-7.5-4Z" fill="currentColor" opacity="0.55" />
      <path d="M38 16c2 7 0 13-4 16-3-2-4.5-7-3.5-12 2.5-3.5 5.5-5 7.5-4Z" fill="currentColor" opacity="0.55" />
      {/* cabeza */}
      <ellipse cx="24" cy="26" rx="13.5" ry="13" fill="currentColor" opacity="0.75" />
      {/* hocico */}
      <ellipse cx="24" cy="31" rx="6" ry="4.6" fill="#fff" opacity="0.85" />
      <ellipse cx="24" cy="28.6" rx="2.6" ry="2" fill="#2f3e46" />
      {/* ojos */}
      <circle cx="18.5" cy="23" r="2.2" fill="#2f3e46" />
      <circle cx="29.5" cy="23" r="2.2" fill="#2f3e46" />
    </svg>
  );
}

export function BreedAvatar({ src, nombre, size = "md", className = "" }: BreedAvatarProps) {
  const [failed, setFailed] = useState(false);

  return (
    <span
      className={`relative inline-flex flex-none items-center justify-center overflow-hidden rounded-full border-[3px] border-white bg-white/70 shadow-sm ${SIZE_CLASSES[size]} ${className}`}
    >
      {failed ? (
        <DogSilhouette className="h-[72%] w-[72%] text-teal" />
      ) : (
        // eslint-disable-next-line @next/next/no-img-element -- fallback onError requiere <img>
        <img
          src={src}
          alt={`Ilustración de ${nombre}`}
          loading="lazy"
          className="h-full w-full object-cover"
          onError={() => setFailed(true)}
        />
      )}
    </span>
  );
}
