import { ContadorVivo } from "./ContadorVivo";
import { Reveal } from "./Reveal";

export function StatsBar() {
  return (
    <section className="bg-white px-5 py-14">
      <div className="mx-auto max-w-3xl">
        <Reveal>
          <p className="mb-6 text-center text-xs font-extrabold uppercase tracking-[0.22em] text-teal-dark">
            En tiempo real
          </p>
        </Reveal>
        <ContadorVivo />
      </div>
    </section>
  );
}
