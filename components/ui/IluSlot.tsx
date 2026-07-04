"use client";

import { useState, type ReactNode } from "react";

/* Slot de ilustración — intenta cargar el render 3D definitivo desde
   /public/ilustraciones/; mientras no exista, muestra el SVG de respaldo.
   Al dejar el PNG en la carpeta, la card lo usa sin tocar código. */

interface IluSlotProps {
  src: string;
  alt: string;
  /** SVG de respaldo mientras no exista el archivo */
  fallback: ReactNode;
  className?: string;
}

export function IluSlot({ src, alt, fallback, className = "" }: IluSlotProps) {
  const [failed, setFailed] = useState(false);

  if (failed) return <>{fallback}</>;

  return (
    // eslint-disable-next-line @next/next/no-img-element -- fallback onError requiere <img>
    <img
      src={src}
      alt={alt}
      loading="lazy"
      className={`h-full w-full object-cover ${className}`}
      onError={() => setFailed(true)}
    />
  );
}
