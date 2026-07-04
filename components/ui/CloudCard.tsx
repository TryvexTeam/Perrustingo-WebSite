import type { ReactNode } from "react";
import {
  DoodleBone,
  DoodleBow,
  DoodleCollar,
  DoodleHeart,
  DoodlePaw,
  DoodleSparkle,
} from "./Doodles";

/* CloudCard — la card insignia de Perrustingo:
   header pastel con doodles blancos, ícono 3D flotando en un círculo tonal,
   y un borde de nubes festoneado que funde el header con el cuerpo blanco. */

export type CloudCardTone = "sky" | "rose" | "lilac" | "peach" | "mint";

interface ToneSpec {
  header: string;
  circle: string;
  doodle: string;
}

const TONES: Record<CloudCardTone, ToneSpec> = {
  sky: { header: "bg-[#d3e9fb]", circle: "bg-[#bcdcf6]", doodle: "text-white/80" },
  rose: { header: "bg-[#fbdbe7]", circle: "bg-[#f7c6da]", doodle: "text-white/80" },
  lilac: { header: "bg-[#e3d9f6]", circle: "bg-[#d3c3f0]", doodle: "text-white/80" },
  peach: { header: "bg-[#fde4c8]", circle: "bg-[#fbd3a4]", doodle: "text-white/80" },
  mint: { header: "bg-[#d5efe2]", circle: "bg-[#b8e4cd]", doodle: "text-white/80" },
};

/* Pares de doodles por esquina — varían con el índice para que ninguna
   card repita exactamente la decoración de su vecina. */
const DOODLE_SETS = [
  [DoodlePaw, DoodleSparkle, DoodleHeart, DoodleSparkle],
  [DoodleSparkle, DoodleBone, DoodleSparkle, DoodlePaw],
  [DoodleHeart, DoodlePaw, DoodleBow, DoodleCollar],
  [DoodleBone, DoodleHeart, DoodleSparkle, DoodlePaw],
  [DoodlePaw, DoodleBow, DoodleHeart, DoodleSparkle],
] as const;

function CloudEdge({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 400 30"
      preserveAspectRatio="none"
      aria-hidden="true"
      className={className}
    >
      <path
        d="M0 30 L0 16
           Q 14 4 30 13 Q 46 0 66 10 Q 84 2 102 12 Q 118 1 138 10
           Q 156 3 174 13 Q 192 0 212 11 Q 230 2 248 12 Q 266 1 286 10
           Q 304 3 322 13 Q 340 0 360 11 Q 378 4 392 13 L 400 16 L 400 30 Z"
        fill="currentColor"
      />
    </svg>
  );
}

interface CloudCardProps {
  tone: CloudCardTone;
  /** Ícono o imagen 3D que flota en el círculo del header */
  visual: ReactNode;
  titulo: ReactNode;
  children: ReactNode;
  /** Índice dentro del grid — rota el set de doodles */
  index?: number;
  /** Pill flotante (ej: "Próximamente") en la esquina del header */
  badge?: ReactNode;
  /** Header más bajo para cards compactas (Beneficios) */
  compact?: boolean;
  className?: string;
}

export function CloudCard({
  tone,
  visual,
  titulo,
  children,
  index = 0,
  badge,
  compact = false,
  className = "",
}: CloudCardProps) {
  const t = TONES[tone];
  const [D1, D2, D3, D4] = DOODLE_SETS[index % DOODLE_SETS.length];

  return (
    <div
      className={`group flex h-full flex-col overflow-hidden rounded-[28px] bg-white shadow-[0_2px_16px_rgba(47,62,70,0.07)] transition-[transform,box-shadow] duration-300 ease-[var(--ease-out-expo)] hover:-translate-y-1.5 hover:shadow-[0_10px_28px_rgba(47,62,70,0.12)] ${className}`}
    >
      <div className={`relative ${t.header} ${compact ? "px-5 pb-9 pt-6" : "px-6 pb-12 pt-9"}`}>
        {/* Doodles de esquina */}
        <D1 className={`absolute left-[7%] top-[14%] ${compact ? "w-5" : "w-7"} ${t.doodle}`} />
        <D2 className={`absolute right-[8%] top-[10%] ${compact ? "w-5" : "w-7"} ${t.doodle}`} />
        {!compact && (
          <>
            <D3 className={`absolute left-[10%] bottom-[30%] w-6 ${t.doodle}`} />
            <D4 className={`absolute right-[9%] bottom-[34%] w-6 ${t.doodle}`} />
          </>
        )}

        {badge && (
          <span className="absolute right-4 top-4 z-10 rounded-full bg-white/90 px-3 py-1 text-[10px] font-extrabold uppercase tracking-wider text-ink-soft shadow-sm">
            {badge}
          </span>
        )}

        {/* Círculo con el visual 3D */}
        <div
          className={`relative mx-auto flex items-center justify-center overflow-hidden rounded-full ${t.circle} transition-transform duration-300 ease-[var(--ease-out-expo)] group-hover:scale-[1.05] ${
            compact ? "h-16 w-16" : "h-32 w-32 md:h-36 md:w-36"
          }`}
        >
          {visual}
        </div>

        {/* Borde de nubes que funde con el cuerpo blanco */}
        <CloudEdge className="absolute inset-x-0 bottom-0 h-[22px] w-full text-white" />
      </div>

      <div className={`flex flex-1 flex-col items-center gap-2.5 text-center ${compact ? "px-4 pb-5 pt-1" : "px-7 pb-8 pt-2"}`}>
        <h3 className={`font-display font-extrabold tracking-tight text-teal-ink ${compact ? "text-sm" : "text-xl leading-snug"}`}>
          {titulo}
        </h3>
        <div className={`leading-relaxed text-ink-soft ${compact ? "text-xs" : "text-sm"}`}>
          {children}
        </div>
      </div>
    </div>
  );
}
