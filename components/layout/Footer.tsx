import Image from "next/image";
import Link from "next/link";
import { LangSwitcher } from "./LangSwitcher";
import { SITE } from "@/lib/site";

export function Footer() {
  return (
    <footer className="relative overflow-hidden bg-gradient-to-b from-[#cfe9f4] to-[#b6dfea]">
      <svg
        aria-hidden="true"
        viewBox="0 0 1440 90"
        preserveAspectRatio="none"
        className="h-[50px] w-full rotate-180 fill-white md:h-[70px]"
      >
        <path d="M0,90 L0,58 Q 60,26 140,52 Q 200,14 300,44 Q 380,10 470,42 Q 560,20 650,48 Q 730,10 830,40 Q 920,22 1010,50 Q 1090,12 1190,44 Q 1280,18 1360,48 Q 1410,34 1440,54 L1440,90 Z" />
      </svg>

      <div className="px-5 pb-10 pt-8">
        <div className="mx-auto grid max-w-6xl grid-cols-1 items-center justify-items-center gap-6 md:grid-cols-3">
          <nav
            aria-label="Enlaces legales"
            className="flex gap-6 text-xs font-bold uppercase tracking-wide text-teal-ink md:justify-self-start"
          >
            <Link href="/politicas" className="transition-colors hover:text-teal-dark">
              Políticas
            </Link>
            <Link href="/#advertencias" className="transition-colors hover:text-teal-dark">
              Advertencias
            </Link>
            <Link href="/#visita" className="transition-colors hover:text-teal-dark">
              Contacto
            </Link>
          </nav>

          <Link href="/" aria-label={SITE.name} className="order-first justify-self-center md:order-none">
            <Image
              src="/logo.jpeg"
              alt={`Logo ${SITE.name}`}
              width={112}
              height={112}
              className="mx-auto rounded-full border-4 border-white object-cover shadow-[0_4px_16px_rgba(6,58,64,.22)] transition-transform duration-200 hover:scale-105"
            />
          </Link>

          <div className="flex items-center gap-5 text-sm font-bold text-teal-ink md:justify-self-end">
            <a
              href={SITE.instagram}
              target="_blank"
              rel="noopener noreferrer"
              className="transition-colors hover:text-teal-dark"
            >
              Instagram
            </a>
            <a
              href={SITE.facebook}
              target="_blank"
              rel="noopener noreferrer"
              className="transition-colors hover:text-teal-dark"
            >
              Facebook
            </a>
          </div>
        </div>
        <div className="mt-6 flex flex-col items-center gap-3">
          <p className="text-center text-sm text-teal-ink/60">
            Atendemos a familias de{" "}
            <span aria-label="Chile">🇨🇱</span>{" "}
            <span aria-label="Brasil">🇧🇷</span>{" "}
            <span aria-label="Alemania">🇩🇪</span>{" "}
            <span aria-label="y el mundo">🌎</span>
          </p>
          <LangSwitcher />
        </div>
        <p className="mt-3 text-center text-xs text-teal-ink/70">
          © {new Date().getFullYear()} {SITE.name} · {SITE.tagline} · {SITE.address}
        </p>
      </div>
    </footer>
  );
}
