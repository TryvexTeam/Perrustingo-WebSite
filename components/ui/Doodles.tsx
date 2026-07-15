/* Doodles de contorno blanco — decoran los headers pastel de las CloudCards,
   replicando la línea creativa de los posters (huellas, corazones, huesos…). */

interface DoodleProps {
  className?: string;
}

export function DoodlePaw({ className }: DoodleProps) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true" fill="none" className={className}>
      <ellipse cx="16" cy="21" rx="6.5" ry="5.5" stroke="currentColor" strokeWidth="2.4" />
      <ellipse cx="7.5" cy="13" rx="2.6" ry="3.4" stroke="currentColor" strokeWidth="2.2" transform="rotate(-18 7.5 13)" />
      <ellipse cx="13" cy="8.5" rx="2.6" ry="3.4" stroke="currentColor" strokeWidth="2.2" />
      <ellipse cx="19.5" cy="8.5" rx="2.6" ry="3.4" stroke="currentColor" strokeWidth="2.2" />
      <ellipse cx="25" cy="13" rx="2.6" ry="3.4" stroke="currentColor" strokeWidth="2.2" transform="rotate(18 25 13)" />
    </svg>
  );
}

export function DoodleHeart({ className }: DoodleProps) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true" fill="none" className={className}>
      <path
        d="M16 27C10 22 4 17.5 4 11.5 4 7.5 7 5 10.2 5c2.4 0 4.6 1.4 5.8 3.6C17.2 6.4 19.4 5 21.8 5 25 5 28 7.5 28 11.5c0 6-6 10.5-12 15.5Z"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function DoodleSparkle({ className }: DoodleProps) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true" fill="none" className={className}>
      <path
        d="M16 3c1.2 6.5 3.3 9.7 10 13-6.7 3.3-8.8 6.5-10 13-1.2-6.5-3.3-9.7-10-13 6.7-3.3 8.8-6.5 10-13Z"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function DoodleBone({ className }: DoodleProps) {
  return (
    <svg viewBox="0 0 36 24" aria-hidden="true" fill="none" className={className}>
      <path
        d="M10.5 9.2a3.6 3.6 0 1 0-4.3 4.3 3.6 3.6 0 1 0 4.3 4.3l14-3.8a3.6 3.6 0 1 0 4.3-4.3 3.6 3.6 0 1 0-4.3-4.3l-14 3.8Z"
        stroke="currentColor"
        strokeWidth="2.3"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function DoodleBow({ className }: DoodleProps) {
  return (
    <svg viewBox="0 0 36 24" aria-hidden="true" fill="none" className={className}>
      <path
        d="M18 12 6.5 5.2c-2-1.1-4 .6-3.4 2.7l1.6 5.6c.2.9.2 1.4 0 2.2l-1.6 5.1c-.6 2.1 1.4 3.8 3.4 2.7L18 17"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinejoin="round"
        transform="translate(0 -4.5)"
      />
      <path
        d="m18 12 11.5-6.8c2-1.1 4 .6 3.4 2.7l-1.6 5.6c-.2.9-.2 1.4 0 2.2l1.6 5.1c.6 2.1-1.4 3.8-3.4 2.7L18 17"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinejoin="round"
        transform="translate(0 -4.5)"
      />
      <circle cx="18" cy="10" r="3" stroke="currentColor" strokeWidth="2.2" />
    </svg>
  );
}

export function DoodleCollar({ className }: DoodleProps) {
  return (
    <svg viewBox="0 0 36 28" aria-hidden="true" fill="none" className={className}>
      <path
        d="M4 10c0-3.3 6.3-6 14-6s14 2.7 14 6-6.3 6-14 6S4 13.3 4 10Z"
        stroke="currentColor"
        strokeWidth="2.3"
      />
      <circle cx="18" cy="19" r="3.4" stroke="currentColor" strokeWidth="2.3" />
      <path d="M18 15.6V13" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" />
    </svg>
  );
}
