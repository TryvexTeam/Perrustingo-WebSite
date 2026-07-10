"use client";

import { useEffect, useRef, useState } from "react";

// Número base de perros atendidos en total (actualizar cuando llegue Supabase)
const BASE_TOTAL = 1847;

function useCountUp(target: number, duration = 1800) {
  const [count, setCount] = useState(0);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    const start = performance.now();
    function step(now: number) {
      const progress = Math.min((now - start) / duration, 1);
      // ease-out-expo
      const eased = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress);
      setCount(Math.round(eased * target));
      if (progress < 1) rafRef.current = requestAnimationFrame(step);
    }
    rafRef.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(rafRef.current);
  }, [target, duration]);

  return count;
}

export function ContadorVivo() {
  const [inView, setInView] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setInView(true); obs.disconnect(); } },
      { threshold: 0.4 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  // Simula perros de hoy basado en día de semana (reemplazar con Supabase)
  const hoy = new Date();
  const esDiaLaboral = hoy.getDay() >= 1 && hoy.getDay() <= 6;
  const perrrosHoy = esDiaLaboral ? 4 + (hoy.getDay() % 3) : 0;

  const totalAnimado = useCountUp(inView ? BASE_TOTAL : 0, 2000);
  const hoyAnimado = useCountUp(inView ? perrrosHoy : 0, 1200);

  return (
    <div ref={ref} className="grid grid-cols-2 gap-4 sm:grid-cols-3">
      <div className="col-span-2 flex flex-col items-center justify-center rounded-3xl bg-[#d8f0e3] p-6 sm:col-span-1">
        <p className="font-display text-5xl font-extrabold tabular-nums text-teal-dark">
          {hoyAnimado}
        </p>
        <p className="mt-1 text-center text-xs font-bold uppercase tracking-widest text-teal-dark/70">
          perros hoy
        </p>
        <span className="mt-2 flex items-center gap-1.5 rounded-full bg-teal-dark/10 px-2.5 py-1 text-[11px] font-bold text-teal-dark">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-teal-dark opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-teal-dark" />
          </span>
          en vivo
        </span>
      </div>

      <div className="flex flex-col items-center justify-center rounded-3xl bg-[#fdeaf1] p-6">
        <p className="font-display text-4xl font-extrabold tabular-nums text-[#c94fa8]">
          {totalAnimado.toLocaleString("es-CL")}
        </p>
        <p className="mt-1 text-center text-xs font-bold uppercase tracking-widest text-[#c94fa8]/70">
          perros felices
        </p>
      </div>

      <div className="flex flex-col items-center justify-center rounded-3xl bg-[#ece4f7] p-6">
        <p className="font-display text-4xl font-extrabold tabular-nums text-[#7c4bba]">
          4.6★
        </p>
        <p className="mt-1 text-center text-xs font-bold uppercase tracking-widest text-[#7c4bba]/70">
          en Google
        </p>
      </div>
    </div>
  );
}
