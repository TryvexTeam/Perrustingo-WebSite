function Paw({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className}>
      <ellipse cx="12" cy="15.5" rx="5" ry="4.5" />
      <ellipse cx="5.5" cy="10" rx="2.2" ry="3" />
      <ellipse cx="10" cy="6.5" rx="2.2" ry="3" />
      <ellipse cx="14" cy="6.5" rx="2.2" ry="3" />
      <ellipse cx="18.5" cy="10" rx="2.2" ry="3" />
    </svg>
  );
}

function Bone({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 20" aria-hidden="true" className={className}>
      <circle cx="7" cy="6" r="5" />
      <circle cx="7" cy="14" r="5" />
      <circle cx="41" cy="6" r="5" />
      <circle cx="41" cy="14" r="5" />
      <rect x="7" y="6" width="34" height="8" rx="4" />
    </svg>
  );
}

function Sparkle({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className}>
      <path d="M12 0c1 6 3 9 12 12-9 3-11 6-12 12-1-6-3-9-12-12 9-3 11-6 12-12Z" />
    </svg>
  );
}

/** Decoración flotante para secciones. El contenedor padre debe ser `relative overflow-hidden`. */
export function Flotantes() {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0">
      <Paw className="animate-float absolute left-[4%] top-[16%] w-8 fill-teal/15" />
      <Bone className="animate-float absolute right-[5%] top-[24%] w-11 fill-orange/25 [animation-delay:-2.5s]" />
      <Sparkle className="animate-float absolute left-[12%] bottom-[14%] w-5 fill-teal-bright/30 [animation-delay:-4s]" />
      <Paw className="animate-float absolute right-[14%] bottom-[10%] w-6 fill-coral/20 [animation-delay:-1.2s]" />
    </div>
  );
}
