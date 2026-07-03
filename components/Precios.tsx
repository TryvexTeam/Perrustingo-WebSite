import Link from "next/link";
import { Flotantes } from "./Flotantes";
import { Reveal } from "./Reveal";

interface Tarifa {
  emoji: string;
  nombre: string;
  rango: string;
  precio: number;
  sinCorte: boolean;
  bg: string;
  priceColor: string;
}

const TARIFAS: Tarifa[] = [
  {
    emoji: "🐁",
    nombre: "Mini / Toy",
    rango: "hasta 5 kg",
    precio: 18000,
    sinCorte: true,
    bg: "bg-[#fdeaf1]",
    priceColor: "text-[#c94fa8]",
  },
  {
    emoji: "🐕",
    nombre: "Pequeños",
    rango: "6 – 10 kg",
    precio: 20000,
    sinCorte: true,
    bg: "bg-[#e3f1fb]",
    priceColor: "text-[#1890d4]",
  },
  {
    emoji: "🦴",
    nombre: "Medianos",
    rango: "11 – 25 kg",
    precio: 25000,
    sinCorte: false,
    bg: "bg-[#ece4f7]",
    priceColor: "text-[#7c4bba]",
  },
  {
    emoji: "🦮",
    nombre: "Grandes",
    rango: "26 – 45 kg",
    precio: 40000,
    sinCorte: false,
    bg: "bg-[#fde4c8]",
    priceColor: "text-orange",
  },
  {
    emoji: "🐻",
    nombre: "Gigantes",
    rango: "más de 45 kg",
    precio: 80000,
    sinCorte: false,
    bg: "bg-[#d8f0e3]",
    priceColor: "text-teal-dark",
  },
];

const INCLUYE = [
  { emoji: "✂️", texto: "Corte de pelo y estilo" },
  { emoji: "💅", texto: "Corte de uñas" },
  { emoji: "👂", texto: "Limpieza de oídos" },
  { emoji: "🧴", texto: "Drenaje de glándulas anales" },
  { emoji: "🚿", texto: "Baño completo" },
  { emoji: "🪮", texto: "Peinado y eliminación de pelo muerto" },
  { emoji: "💨", texto: "Secado profesional" },
];

function formatCLP(n: number): string {
  return "$" + n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

export function Precios() {
  return (
    <section id="precios" className="relative scroll-mt-20 overflow-hidden bg-white px-5 py-16">
      <Flotantes />
      <div className="relative mx-auto max-w-6xl">
        <Reveal>
          <p className="text-center text-xs font-extrabold uppercase tracking-[0.22em] text-teal-dark">
            Tarifas
          </p>
          <h2 className="mt-2 text-center font-display text-3xl font-extrabold tracking-tight md:text-4xl">
            Precio según el tamaño de tu perro
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-center text-[15px] leading-relaxed text-ink-soft">
            El precio se confirma antes de comenzar, según el tamaño, el peso y
            el estado del pelo. Sin sorpresas.
          </p>
        </Reveal>

        <div className="mt-10 grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-5 [&>div:last-child]:col-span-2 md:[&>div:last-child]:col-span-1">
          {TARIFAS.map((t, i) => (
            <Reveal key={t.nombre} delay={i * 60} className="h-full">
              <div
                className={`flex h-full flex-col items-center gap-3 rounded-3xl ${t.bg} p-6 text-center transition-transform duration-200 ease-[var(--ease-out-expo)] hover:-translate-y-1`}
              >
                <span
                  aria-hidden="true"
                  className="flex h-14 w-14 items-center justify-center rounded-full border-[3px] border-white bg-white/70 text-2xl shadow-sm"
                >
                  {t.emoji}
                </span>
                <div>
                  <h3 className="font-display text-base font-extrabold">{t.nombre}</h3>
                  <p className="text-xs font-bold uppercase tracking-wide text-teal-dark">{t.rango}</p>
                </div>
                <p className={`font-display text-2xl font-extrabold ${t.priceColor}`}>
                  desde {formatCLP(t.precio)}
                </p>
                {t.sinCorte && (
                  <span className="rounded-full bg-white/80 px-3 py-1 text-[11px] font-bold text-ink-soft">
                    sin corte de pelo
                  </span>
                )}
              </div>
            </Reveal>
          ))}
        </div>

        <Reveal className="mt-12">
          <div className="rounded-3xl bg-cream p-8">
            <h3 className="text-center font-display text-xl font-extrabold tracking-tight">
              ¿Qué incluye el servicio?
            </h3>
            <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {INCLUYE.map((item) => (
                <div
                  key={item.texto}
                  className="flex items-center gap-3 rounded-2xl bg-white px-4 py-3 shadow-sm"
                >
                  <span aria-hidden="true" className="text-xl">{item.emoji}</span>
                  <span className="text-sm font-semibold text-ink">{item.texto}</span>
                </div>
              ))}
            </div>
            <p className="mt-5 text-center text-xs leading-relaxed text-ink-soft">
              * Para Mini / Toy y Pequeños el corte de pelo se cotiza por separado.
              Podemos agregar <strong>pinches decorativos</strong> (hembras) y accesorios si el cliente los solicita.
            </p>
          </div>
        </Reveal>

        <Reveal className="mt-8 text-center">
          <Link
            href="/reserva"
            className="inline-block rounded-full bg-orange px-8 py-3.5 font-display text-base font-extrabold text-teal-ink shadow-[0_3px_0_rgba(6,58,64,.25)] transition-[background-color,transform,box-shadow] duration-150 hover:bg-[#f7ab52] hover:shadow-[0_5px_0_rgba(6,58,64,.25)] active:translate-y-0.5 active:shadow-[0_1px_0_rgba(6,58,64,.25)]"
          >
            Reserva y confirma tu precio →
          </Link>
        </Reveal>
      </div>
    </section>
  );
}
