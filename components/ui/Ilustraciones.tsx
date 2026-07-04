/* Ilustraciones estilo 3D-soft en SVG puro — gradientes y luces simulan el
   render "clay toy" de la línea creativa. Cada una vive en el círculo de una
   CloudCard. Cuando existan los renders definitivos (PNG), basta swapear el
   `visual` de la card por un <Image>. */

interface IluProps {
  className?: string;
}

export function IluCasa({ className }: IluProps) {
  return (
    <svg viewBox="0 0 96 96" aria-hidden="true" className={className}>
      <defs>
        <linearGradient id="casa-roof" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#f87560" />
          <stop offset="1" stopColor="#e04b3a" />
        </linearGradient>
        <linearGradient id="casa-wall" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fdf3e3" />
          <stop offset="1" stopColor="#f3dfc0" />
        </linearGradient>
        <linearGradient id="casa-door" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#b07a4a" />
          <stop offset="1" stopColor="#8a5a32" />
        </linearGradient>
      </defs>
      {/* sombra */}
      <ellipse cx="48" cy="86" rx="30" ry="5" fill="#00000014" />
      {/* chimenea */}
      <rect x="62" y="18" width="9" height="16" rx="2" fill="#c98a5b" />
      <rect x="60.5" y="15" width="12" height="6" rx="3" fill="#e0a273" />
      {/* muro */}
      <rect x="22" y="42" width="52" height="42" rx="6" fill="url(#casa-wall)" />
      {/* techo */}
      <path d="M14 46 44 20q4-3.4 8 0l30 26q3 2.8-1 5H15q-4-2.2-1-5Z" fill="url(#casa-roof)" />
      <path d="M14 46 44 20q4-3.4 8 0l6 5.2L22 51h-7q-4-2.2-1-5Z" fill="#ffffff2e" />
      {/* puerta */}
      <rect x="40" y="56" width="16" height="28" rx="7" fill="url(#casa-door)" />
      <circle cx="52.5" cy="70" r="1.8" fill="#f8e3c3" />
      {/* ventana */}
      <rect x="60" y="52" width="11" height="11" rx="3" fill="#bfe4f2" stroke="#fff" strokeWidth="2" />
      <path d="M65.5 52v11M60 57.5h11" stroke="#fff" strokeWidth="1.6" />
      {/* arbustos */}
      <circle cx="27" cy="82" r="7" fill="#6fbf73" />
      <circle cx="34" cy="84" r="5" fill="#57a95c" />
      <circle cx="69" cy="83" r="6" fill="#6fbf73" />
      {/* brillo */}
      <ellipse cx="36" cy="27" rx="4.5" ry="2.6" fill="#ffffff66" transform="rotate(-32 36 27)" />
    </svg>
  );
}

export function IluPluma({ className }: IluProps) {
  return (
    <svg viewBox="0 0 96 96" aria-hidden="true" className={className}>
      <defs>
        <linearGradient id="pluma-body" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#cdb8f2" />
          <stop offset="1" stopColor="#a184dd" />
        </linearGradient>
      </defs>
      <ellipse cx="48" cy="84" rx="24" ry="4.5" fill="#00000012" />
      {/* pluma — cuerpo curvado */}
      <path
        d="M76 18C58 20 34 34 26 52c-4.5 10 0 18 9 18 16 0 38-24 41-52Z"
        fill="url(#pluma-body)"
      />
      {/* raquis */}
      <path
        d="M74 20C56 32 40 48 24 72"
        stroke="#7e5fc4"
        strokeWidth="3.2"
        strokeLinecap="round"
        fill="none"
      />
      {/* barbas */}
      <path
        d="M63 30c-6-1-11-1-16 1M56 40c-6-1.4-12-.8-17 2M48 50c-6-1-11 0-15 3"
        stroke="#b79ae9"
        strokeWidth="2.4"
        strokeLinecap="round"
        fill="none"
      />
      {/* brillo */}
      <ellipse cx="63" cy="27" rx="6" ry="3" fill="#ffffff59" transform="rotate(-34 63 27)" />
    </svg>
  );
}

export function IluCachorro({ className }: IluProps) {
  return (
    <svg viewBox="0 0 96 96" aria-hidden="true" className={className}>
      <defs>
        <linearGradient id="dog-head" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#f2d9ae" />
          <stop offset="1" stopColor="#e0b97f" />
        </linearGradient>
        <linearGradient id="dog-ear" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#b9834c" />
          <stop offset="1" stopColor="#96622f" />
        </linearGradient>
      </defs>
      <ellipse cx="48" cy="88" rx="26" ry="4.5" fill="#00000012" />
      {/* orejas */}
      <path d="M18 34c-3 14 2 26 10 30 6-4 8-14 6-24-5-6-11-8-16-6Z" fill="url(#dog-ear)" />
      <path d="M78 34c3 14-2 26-10 30-6-4-8-14-6-24 5-6 11-8 16-6Z" fill="url(#dog-ear)" />
      {/* cabeza */}
      <ellipse cx="48" cy="52" rx="28" ry="27" fill="url(#dog-head)" />
      {/* mancha de ojo */}
      <ellipse cx="61" cy="43" rx="9.5" ry="10.5" fill="#c99a5f" />
      {/* ojos */}
      <circle cx="37" cy="45" r="5.2" fill="#2d2320" />
      <circle cx="61" cy="45" r="5.2" fill="#2d2320" />
      <circle cx="38.8" cy="43.2" r="1.7" fill="#fff" />
      <circle cx="62.8" cy="43.2" r="1.7" fill="#fff" />
      {/* hocico */}
      <ellipse cx="48" cy="62" rx="13" ry="10" fill="#f8ecd4" />
      <ellipse cx="48" cy="56.5" rx="5.4" ry="4" fill="#2d2320" />
      <path d="M48 60v4" stroke="#2d2320" strokeWidth="1.8" strokeLinecap="round" />
      {/* lengua */}
      <path d="M42 66c0 7 2.5 11 6 11s6-4 6-11c-4 2.4-8 2.4-12 0Z" fill="#f2708a" />
      <path d="M48 68v6" stroke="#d9536e" strokeWidth="1.6" strokeLinecap="round" />
      {/* brillo frente */}
      <ellipse cx="38" cy="32" rx="6" ry="3" fill="#ffffff4d" transform="rotate(-18 38 32)" />
    </svg>
  );
}

export function IluCorazon({ className }: IluProps) {
  return (
    <svg viewBox="0 0 96 96" aria-hidden="true" className={className}>
      <defs>
        <linearGradient id="heart-3d" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fb8da8" />
          <stop offset="1" stopColor="#e85d80" />
        </linearGradient>
      </defs>
      <ellipse cx="48" cy="85" rx="22" ry="4" fill="#00000012" />
      <path
        d="M48 80C33 68 18 57 18 40c0-11 8-18 17-18 6 0 10.6 3 13 8 2.4-5 7-8 13-8 9 0 17 7 17 18 0 17-15 28-30 40Z"
        fill="url(#heart-3d)"
      />
      <ellipse cx="34" cy="34" rx="7" ry="4" fill="#ffffff59" transform="rotate(-24 34 34)" />
      {/* huella dentro */}
      <g fill="#ffffffd9">
        <ellipse cx="48" cy="50" rx="6.4" ry="5.4" />
        <ellipse cx="39.5" cy="42" rx="2.5" ry="3.3" transform="rotate(-16 39.5 42)" />
        <ellipse cx="45" cy="38.4" rx="2.5" ry="3.3" />
        <ellipse cx="51" cy="38.4" rx="2.5" ry="3.3" />
        <ellipse cx="56.5" cy="42" rx="2.5" ry="3.3" transform="rotate(16 56.5 42)" />
      </g>
    </svg>
  );
}

export function IluWhatsApp({ className }: IluProps) {
  return (
    <svg viewBox="0 0 96 96" aria-hidden="true" className={className}>
      <defs>
        <linearGradient id="wa-bubble" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#5fd669" />
          <stop offset="1" stopColor="#2fa93c" />
        </linearGradient>
      </defs>
      <ellipse cx="48" cy="85" rx="22" ry="4" fill="#00000012" />
      <path
        d="M48 16c-18 0-32 13.4-32 30 0 6 1.8 11.5 5 16l-4 14 15-3.8c4.8 2.4 10.2 3.8 16 3.8 18 0 32-13.4 32-30S66 16 48 16Z"
        fill="url(#wa-bubble)"
      />
      <path
        d="M38 34c-1.6 0-4 1.8-4 6 0 7.6 9 17.4 17 20 5.6 1.8 9-.4 10-3 .6-1.6.2-2.8-1-3.4l-5.4-2.6c-1-.4-1.8-.2-2.4.6l-1.4 1.8c-.6.8-1.4 1-2.4.4-3.2-1.8-6.6-5.2-8-8.2-.4-1-.2-1.8.4-2.4l1.6-1.6c.8-.6.9-1.4.5-2.4l-2.3-4.6c-.5-1-1.4-1.2-2.2-1Z"
        fill="#fff"
      />
      <ellipse cx="34" cy="26" rx="7" ry="3.4" fill="#ffffff4d" transform="rotate(-20 34 26)" />
    </svg>
  );
}

export function IluEtiqueta({ className }: IluProps) {
  return (
    <svg viewBox="0 0 96 96" aria-hidden="true" className={className}>
      <defs>
        <linearGradient id="tag-3d" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#ffc46b" />
          <stop offset="1" stopColor="#f49d37" />
        </linearGradient>
      </defs>
      <ellipse cx="48" cy="85" rx="24" ry="4" fill="#00000012" />
      <path
        d="M42 18h24a8 8 0 0 1 8 8v24c0 2.4-.9 4.4-2.6 6L48 79.4a8 8 0 0 1-11.3 0L20.6 63.3a8 8 0 0 1 0-11.3L44 28.6"
        fill="url(#tag-3d)"
        transform="rotate(3 48 48)"
      />
      <circle cx="62" cy="32" r="6" fill="#fff8ec" />
      <circle cx="62" cy="32" r="3" fill="#c97c1d" />
      <text
        x="45"
        y="62"
        fontFamily="system-ui, sans-serif"
        fontSize="26"
        fontWeight="800"
        fill="#fff"
        textAnchor="middle"
      >
        $
      </text>
      <ellipse cx="38" cy="36" rx="6" ry="3" fill="#ffffff59" transform="rotate(-38 38 36)" />
    </svg>
  );
}

export function IluEstrella({ className }: IluProps) {
  return (
    <svg viewBox="0 0 96 96" aria-hidden="true" className={className}>
      <defs>
        <linearGradient id="star-3d" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffd76b" />
          <stop offset="1" stopColor="#f6b02f" />
        </linearGradient>
      </defs>
      <ellipse cx="48" cy="85" rx="24" ry="4" fill="#00000012" />
      <path
        d="M48 12c2 0 3.7 1.2 4.6 3.2l7.6 17 18.4 1.8c4.4.4 6.2 5.7 3 8.7L67.8 55.4l4 18c1 4.3-3.7 7.6-7.5 5.4L48 69.6 31.7 78.8c-3.8 2.2-8.4-1.1-7.5-5.4l4-18L14.4 42.7c-3.3-3-1.4-8.3 3-8.7l18.4-1.8 7.6-17c.9-2 2.6-3.2 4.6-3.2Z"
        fill="url(#star-3d)"
      />
      <ellipse cx="38" cy="28" rx="6" ry="3" fill="#ffffff66" transform="rotate(-26 38 28)" />
      {/* carita feliz */}
      <circle cx="41" cy="47" r="2.6" fill="#7a4d10" />
      <circle cx="55" cy="47" r="2.6" fill="#7a4d10" />
      <path d="M41 56c4.6 4 9.4 4 14 0" stroke="#7a4d10" strokeWidth="2.6" strokeLinecap="round" fill="none" />
    </svg>
  );
}

export function IluVan({ className }: IluProps) {
  return (
    <svg viewBox="0 0 96 96" aria-hidden="true" className={className}>
      <defs>
        <linearGradient id="van-body" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#8fd0f2" />
          <stop offset="1" stopColor="#54aede" />
        </linearGradient>
      </defs>
      <ellipse cx="48" cy="82" rx="34" ry="5" fill="#00000014" />
      {/* carrocería */}
      <path
        d="M12 62V44a8 8 0 0 1 8-8h34l10 4 16 10a6 6 0 0 1 4 6v6a4 4 0 0 1-4 4H16a4 4 0 0 1-4-4Z"
        fill="url(#van-body)"
      />
      {/* cabina/ventana */}
      <path d="M58 40l8 3.2L76 50H60a2 2 0 0 1-2-2v-8Z" fill="#dff2fc" />
      <rect x="18" y="42" width="14" height="10" rx="3" fill="#dff2fc" />
      {/* huella en el costado */}
      <g fill="#ffffffd9">
        <ellipse cx="42" cy="54" rx="5" ry="4.2" />
        <ellipse cx="35.5" cy="48" rx="2" ry="2.6" transform="rotate(-16 35.5 48)" />
        <ellipse cx="40" cy="45.4" rx="2" ry="2.6" />
        <ellipse cx="44.6" cy="45.4" rx="2" ry="2.6" />
        <ellipse cx="49" cy="48" rx="2" ry="2.6" transform="rotate(16 49 48)" />
      </g>
      {/* ruedas */}
      <circle cx="28" cy="68" r="8" fill="#2f3e46" />
      <circle cx="28" cy="68" r="3.6" fill="#c8d2d8" />
      <circle cx="68" cy="68" r="8" fill="#2f3e46" />
      <circle cx="68" cy="68" r="3.6" fill="#c8d2d8" />
      <ellipse cx="26" cy="41" rx="6" ry="2.6" fill="#ffffff59" transform="rotate(-8 26 41)" />
    </svg>
  );
}

export function IluCasaMovil({ className }: IluProps) {
  return (
    <svg viewBox="0 0 96 96" aria-hidden="true" className={className}>
      <defs>
        <linearGradient id="cm-roof" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffb26b" />
          <stop offset="1" stopColor="#f4913a" />
        </linearGradient>
        <linearGradient id="cm-wall" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fdf3e3" />
          <stop offset="1" stopColor="#f1ddbd" />
        </linearGradient>
      </defs>
      <ellipse cx="48" cy="83" rx="32" ry="5" fill="#00000014" />
      {/* casa rodante */}
      <rect x="16" y="38" width="56" height="34" rx="9" fill="url(#cm-wall)" />
      <path d="M14 42q34-18 68 0v4q-34-15-68 0Z" fill="url(#cm-roof)" />
      {/* puerta y ventana */}
      <rect x="26" y="50" width="13" height="22" rx="5" fill="#ba7f4c" />
      <rect x="48" y="50" width="14" height="11" rx="3.5" fill="#bfe4f2" stroke="#fff" strokeWidth="2" />
      {/* ruedas */}
      <circle cx="30" cy="72" r="7.5" fill="#2f3e46" />
      <circle cx="30" cy="72" r="3.2" fill="#c8d2d8" />
      <circle cx="64" cy="72" r="7.5" fill="#2f3e46" />
      <circle cx="64" cy="72" r="3.2" fill="#c8d2d8" />
      {/* corazón sobre la puerta */}
      <path
        d="M32.5 44.3c-1.6-1.3-3.2-2.5-3.2-4 0-1 .8-1.8 1.7-1.8.6 0 1.2.4 1.5 1 .3-.6.9-1 1.5-1 1 0 1.7.8 1.7 1.8 0 1.5-1.6 2.7-3.2 4Z"
        fill="#e85d80"
      />
      <ellipse cx="30" cy="34" rx="7" ry="2.4" fill="#ffffff59" transform="rotate(-6 30 34)" />
    </svg>
  );
}

export function IluFoco({ className }: IluProps) {
  return (
    <svg viewBox="0 0 96 96" aria-hidden="true" className={className}>
      <defs>
        <radialGradient id="foco-glow" cx="0.5" cy="0.4" r="0.7">
          <stop offset="0" stopColor="#fff2c4" />
          <stop offset="1" stopColor="#ffd76b" />
        </radialGradient>
      </defs>
      <ellipse cx="48" cy="86" rx="18" ry="3.6" fill="#00000012" />
      {/* rayos */}
      <path
        d="M48 8v7M24 16l4.6 5.4M72 16l-4.6 5.4M16 40h7M73 40h7"
        stroke="#f6b02f"
        strokeWidth="3.4"
        strokeLinecap="round"
      />
      {/* bulbo */}
      <circle cx="48" cy="42" r="21" fill="url(#foco-glow)" />
      {/* huella dentro del bulbo */}
      <g fill="#e8930cbf">
        <ellipse cx="48" cy="46" rx="5.6" ry="4.8" />
        <ellipse cx="40.5" cy="39" rx="2.2" ry="2.9" transform="rotate(-16 40.5 39)" />
        <ellipse cx="45.4" cy="36" rx="2.2" ry="2.9" />
        <ellipse cx="50.6" cy="36" rx="2.2" ry="2.9" />
        <ellipse cx="55.5" cy="39" rx="2.2" ry="2.9" transform="rotate(16 55.5 39)" />
      </g>
      {/* base */}
      <path d="M41 62h14v4a4 4 0 0 1-4 4h-6a4 4 0 0 1-4-4v-4Z" fill="#c8d2d8" />
      <rect x="42.5" y="70" width="11" height="4" rx="2" fill="#a9b6bd" />
      <rect x="44" y="76" width="8" height="3.4" rx="1.7" fill="#8d9aa1" />
      <ellipse cx="40" cy="31" rx="5" ry="2.6" fill="#ffffff80" transform="rotate(-28 40 31)" />
    </svg>
  );
}
