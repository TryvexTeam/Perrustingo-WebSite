/** Huella de perro en SVG nítido (misma silueta clásica, sin emoji). */
export function PawIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" aria-hidden="true" className={className}>
      <ellipse cx="19" cy="19" rx="7" ry="9" />
      <ellipse cx="45" cy="19" rx="7" ry="9" />
      <ellipse cx="8" cy="34" rx="6" ry="8" />
      <ellipse cx="56" cy="34" rx="6" ry="8" />
      <path d="M32 30c-9 0-17 8-18 16-.7 5.5 3 9 8 9 4 0 6-2 10-2s6 2 10 2c5 0 8.7-3.5 8-9-1-8-9-16-18-16Z" />
    </svg>
  );
}
