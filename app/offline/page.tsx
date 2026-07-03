export default function OfflinePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-cream px-5 text-center">
      <span className="text-6xl">🐾</span>
      <h1 className="mt-6 font-display text-3xl font-extrabold tracking-tight text-ink">
        Sin conexión
      </h1>
      <p className="mt-3 max-w-xs text-[15px] leading-relaxed text-ink-soft">
        Parece que no tienes internet. Revisa tu conexión y vuelve a intentarlo.
      </p>
      <a
        href="/"
        className="mt-8 rounded-full bg-teal-dark px-7 py-3 font-display text-sm font-bold text-white"
      >
        Reintentar →
      </a>
    </main>
  );
}
