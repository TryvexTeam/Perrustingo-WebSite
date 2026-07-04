/* Banderas circulares en SVG — Chile, Brasil, Alemania y el mundo.
   Se usan bajo el logo en el hero y en la ventana "Próximamente internacional". */

interface BanderaProps {
  className?: string;
  title?: string;
}

export function BanderaChile({ className, title = "Chile" }: BanderaProps) {
  return (
    <svg viewBox="0 0 40 40" role="img" aria-label={title} className={className}>
      <clipPath id="cl-circle">
        <circle cx="20" cy="20" r="20" />
      </clipPath>
      <g clipPath="url(#cl-circle)">
        <rect width="40" height="20" fill="#fff" />
        <rect y="20" width="40" height="20" fill="#d52b1e" />
        <rect width="16" height="20" fill="#0039a6" />
        <path
          d="M8 5.2l1.5 4.4h4.6l-3.7 2.8 1.4 4.4L8 14l-3.8 2.8 1.4-4.4-3.7-2.8h4.6Z"
          fill="#fff"
        />
      </g>
      <circle cx="20" cy="20" r="19" fill="none" stroke="#00000014" strokeWidth="2" />
    </svg>
  );
}

export function BanderaBrasil({ className, title = "Brasil" }: BanderaProps) {
  return (
    <svg viewBox="0 0 40 40" role="img" aria-label={title} className={className}>
      <clipPath id="br-circle">
        <circle cx="20" cy="20" r="20" />
      </clipPath>
      <g clipPath="url(#br-circle)">
        <rect width="40" height="40" fill="#009b3a" />
        <path d="M20 6 36 20 20 34 4 20Z" fill="#fedf00" />
        <circle cx="20" cy="20" r="7" fill="#002776" />
        <path d="M13.5 18.2c4.5-1.2 9 .3 12.8 3.4" stroke="#fff" strokeWidth="1.6" fill="none" />
      </g>
      <circle cx="20" cy="20" r="19" fill="none" stroke="#00000014" strokeWidth="2" />
    </svg>
  );
}

export function BanderaAlemania({ className, title = "Alemania" }: BanderaProps) {
  return (
    <svg viewBox="0 0 40 40" role="img" aria-label={title} className={className}>
      <clipPath id="de-circle">
        <circle cx="20" cy="20" r="20" />
      </clipPath>
      <g clipPath="url(#de-circle)">
        <rect width="40" height="14" fill="#000" />
        <rect y="14" width="40" height="13" fill="#dd0000" />
        <rect y="27" width="40" height="13" fill="#ffce00" />
      </g>
      <circle cx="20" cy="20" r="19" fill="none" stroke="#00000014" strokeWidth="2" />
    </svg>
  );
}

export function BanderaMundo({ className, title = "El mundo" }: BanderaProps) {
  return (
    <svg viewBox="0 0 40 40" role="img" aria-label={title} className={className}>
      <circle cx="20" cy="20" r="20" fill="#5bb4e5" />
      {/* continentes estilizados */}
      <path
        d="M10 12c3-3 8-3 10 0 1.4 2-1 4-3.4 4.4C13 17 10.5 15 10 12Zm14 4c3-1.4 6.6.6 7 3.6.4 3.4-2.6 5.4-5.6 4.4-2.8-1-3.8-6-1.4-8Zm-12 10c2.4-1.6 6-.6 6.6 2 .6 2.6-1.6 5-4.6 4.4-2.6-.6-3.6-4.6-2-6.4Z"
        fill="#6fbf73"
      />
      <circle cx="20" cy="20" r="19" fill="none" stroke="#ffffff59" strokeWidth="2" />
      <circle cx="20" cy="20" r="19" fill="none" stroke="#00000014" strokeWidth="2" />
    </svg>
  );
}
