import { BOOKING_URL } from "@/lib/site";

function Cloud({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 200 60" aria-hidden="true" className={`fill-white ${className ?? ""}`}>
      <ellipse cx="50" cy="45" rx="50" ry="18" />
      <ellipse cx="105" cy="35" rx="45" ry="24" />
      <ellipse cx="155" cy="46" rx="45" ry="16" />
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

export function Banner() {
  return (
    <section className="relative overflow-hidden bg-gradient-to-b from-[#cfe9f4] to-[#b6dfea] py-24 md:py-28">
      <div
        aria-hidden="true"
        className="absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-white to-transparent"
      />
      <Cloud className="animate-drift-slow absolute left-[-4%] top-10 w-40 opacity-80" />
      <Cloud className="animate-drift absolute right-[-3%] top-16 w-52 opacity-90" />
      <Sparkle className="animate-float absolute left-[16%] top-[30%] w-5 fill-white/80" />
      <Sparkle className="animate-float absolute right-[20%] top-[22%] w-4 fill-[#f49d37]/70 [animation-delay:-2s]" />
      <Sparkle className="animate-float absolute right-[12%] bottom-[30%] w-6 fill-white/70 [animation-delay:-4s]" />

      <div className="relative mx-auto flex max-w-4xl flex-col items-center px-5 text-center">
        <p className="text-xs font-extrabold uppercase tracking-[0.25em] text-teal-dark">
          Peluquería Canina Perrustingo
        </p>
        <h2 className="mt-3 font-display text-4xl font-extrabold leading-tight tracking-tight text-teal-ink md:text-6xl">
          La felicidad se les nota en la cola.
        </h2>
        <p className="mt-4 max-w-xl text-base leading-relaxed text-teal-ink/70">
          Dejamos a cada perro limpio, cómodo y feliz. Mira los resultados
          reales de nuestros clientes peludos.
        </p>
        <a
          href={BOOKING_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-8 rounded-full bg-orange px-8 py-3.5 font-display text-base font-extrabold text-teal-ink shadow-[0_3px_0_rgba(6,58,64,.25)] transition-[background-color,transform,box-shadow] duration-150 hover:bg-[#f7ab52] hover:shadow-[0_5px_0_rgba(6,58,64,.25)] active:translate-y-0.5 active:shadow-[0_1px_0_rgba(6,58,64,.25)]"
        >
          Reserva tu cita
        </a>
      </div>

      <svg
        aria-hidden="true"
        viewBox="0 0 1440 90"
        preserveAspectRatio="none"
        className="absolute inset-x-0 bottom-0 h-[60px] w-full fill-cream md:h-[80px]"
      >
        <path d="M0,90 L0,58 Q 60,26 140,52 Q 200,14 300,44 Q 380,10 470,42 Q 560,20 650,48 Q 730,10 830,40 Q 920,22 1010,50 Q 1090,12 1190,44 Q 1280,18 1360,48 Q 1410,34 1440,54 L1440,90 Z" />
      </svg>
    </section>
  );
}
