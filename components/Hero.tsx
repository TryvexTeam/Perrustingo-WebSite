import Image from "next/image";
import Link from "next/link";
import { BOOKING_URL } from "@/lib/site";
import { HeroClouds } from "./HeroClouds";

function Star({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className}>
      <path d="M12 1.5 14.8 8.6l7.7.5-5.9 5 1.9 7.4L12 17.4l-6.5 4.1 1.9-7.4-5.9-5 7.7-.5Z" />
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

export function Hero() {
  return (
    <section id="inicio" className="relative overflow-hidden bg-[#b6dfea] md:bg-[#bfe3f2]">
      <Image
        src="/hero-bg.png"
        alt="Perro recién peluqueado sentado sobre nubes en un cielo celeste"
        fill
        priority
        sizes="(min-width: 768px) 100vw, 1px"
        className="hidden object-cover object-[62%_top] md:block"
      />
      <div
        aria-hidden="true"
        className="absolute inset-0 hidden bg-gradient-to-r from-[#bfe3f2]/70 to-transparent to-45% md:block"
      />
      <HeroClouds />
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
        <Star className="animate-float absolute left-[10%] top-[14%] w-5 fill-[#7dc3e8]" />
        <Star className="animate-float absolute right-[8%] top-[34%] w-7 fill-[#5bb4e5] [animation-delay:-1.4s]" />
        <Sparkle className="animate-float absolute left-[34%] top-[10%] w-4 fill-white/90 [animation-delay:-2.6s]" />
        <Sparkle className="animate-float absolute right-[28%] top-[12%] w-5 fill-orange/70 [animation-delay:-0.8s]" />
        <Star className="animate-float absolute left-[6%] top-[58%] w-4 fill-white/80 [animation-delay:-3.1s]" />
        <Sparkle className="animate-float absolute right-[6%] top-[70%] w-4 fill-[#7dc3e8]/80 [animation-delay:-2s]" />
      </div>

      <div className="relative mx-auto flex max-w-7xl flex-col px-5 pt-24 md:min-h-[min(60.5vw,860px)] md:flex-row md:items-center md:py-16 md:pt-24">
        <div className="max-w-xl">
          <h1 className="rise-in font-display text-[2.7rem] font-extrabold leading-[1.08] tracking-[-0.03em] text-teal-ink [animation-delay:80ms] md:text-[3.8rem]">
            Llega hecho un{" "}
            <span className="relative inline-block whitespace-nowrap">
              desastre
              <svg
                viewBox="0 0 220 14"
                aria-hidden="true"
                className="absolute -bottom-1.5 left-0 w-full"
                preserveAspectRatio="none"
              >
                <path
                  d="M3 10 Q 20 3, 40 8 T 80 8 T 120 8 T 160 8 T 200 8 L 217 7"
                  fill="none"
                  stroke="var(--color-coral)"
                  strokeWidth="5"
                  strokeLinecap="round"
                />
              </svg>
            </span>
            ,<br />
            se va hecho{" "}
            <span className="relative inline-block whitespace-nowrap px-2">
              <span
                aria-hidden="true"
                className="absolute inset-x-0 inset-y-1 -rotate-1 rounded-lg bg-orange/70"
              />
              <span className="relative">un rey.</span>
            </span>
          </h1>
          <p className="rise-in mt-5 max-w-md text-lg leading-relaxed text-teal-ink/75 [animation-delay:160ms]">
            Bañamos, cortamos y consentimos a tu perro en Renca. Dejamos cortes
            parejos, oídos limpios y colitas felices desde hace años.
          </p>
          <div className="rise-in mt-8 flex flex-wrap items-center gap-4 [animation-delay:240ms]">
            <a
              href={BOOKING_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-full bg-orange px-7 py-3.5 font-display text-base font-extrabold text-teal-ink shadow-[0_3px_0_rgba(6,58,64,.25)] transition-[background-color,transform,box-shadow] duration-150 hover:bg-[#f7ab52] hover:shadow-[0_5px_0_rgba(6,58,64,.25)] active:translate-y-0.5 active:shadow-[0_1px_0_rgba(6,58,64,.25)]"
            >
              Agenda por WhatsApp
            </a>
            <Link
              href="/reserva"
              className="rounded-full bg-teal-dark px-7 py-3.5 font-display text-base font-extrabold text-white shadow-[0_3px_0_rgba(6,58,64,.4)] transition-[background-color,transform,box-shadow] duration-150 hover:bg-teal hover:shadow-[0_5px_0_rgba(6,58,64,.4)] active:translate-y-0.5 active:shadow-[0_1px_0_rgba(6,58,64,.4)]"
            >
              Reserva inteligente →
            </Link>
            <a
              href="#servicios"
              className="font-bold text-teal-dark underline-offset-4 transition-colors hover:text-teal-ink hover:underline"
            >
              Ver servicios ↓
            </a>
          </div>

          {/* Accesos rápidos — cuenta nueva o iniciar sesión */}
          <div className="rise-in mt-5 flex flex-wrap items-center gap-3 [animation-delay:320ms]">
            <span className="text-sm font-medium text-teal-ink/60">¿Ya eres cliente?</span>
            <Link
              href="/login"
              className="flex items-center gap-1.5 rounded-full border-2 border-teal-dark/30 bg-white/60 px-4 py-1.5 text-sm font-bold text-teal-dark backdrop-blur-sm transition hover:border-teal-dark hover:bg-white"
            >
              <svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true" className="h-3.5 w-3.5">
                <path d="M8 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM1.5 14.5a6.5 6.5 0 0 1 13 0H1.5Z" />
              </svg>
              Iniciar sesión
            </Link>
            <Link
              href="/registro"
              className="flex items-center gap-1.5 rounded-full border-2 border-orange/40 bg-white/60 px-4 py-1.5 text-sm font-bold text-orange backdrop-blur-sm transition hover:border-orange hover:bg-white"
            >
              <svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true" className="h-3.5 w-3.5">
                <path d="M8 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM1.5 14.5a6.5 6.5 0 0 1 13 0H1.5ZM13.5 5.5v-2h-2V2h2V0h1.5v2h2v1.5h-2v2H13.5Z" />
              </svg>
              Crear cuenta gratis
            </Link>
          </div>
        </div>

        <Image
          src="/hero-bg.png"
          alt="Perro recién peluqueado sentado sobre nubes en un cielo celeste"
          width={1612}
          height={976}
          priority
          sizes="(min-width: 768px) 1px, 100vw"
          className="-mx-5 mt-8 w-[calc(100%+2.5rem)] max-w-none md:hidden"
        />
      </div>

      <svg
        aria-hidden="true"
        viewBox="0 0 1440 90"
        preserveAspectRatio="none"
        className="absolute inset-x-0 bottom-0 h-[70px] w-full fill-white md:h-[90px]"
      >
        <path d="M0,90 L0,58 Q 60,26 140,52 Q 200,14 300,44 Q 380,10 470,42 Q 560,20 650,48 Q 730,10 830,40 Q 920,22 1010,50 Q 1090,12 1190,44 Q 1280,18 1360,48 Q 1410,34 1440,54 L1440,90 Z" />
      </svg>
    </section>
  );
}
