"use client";

/* Página que abre el cliente desde el enlace de su correo para cancelar.
 *
 * LA DECISIÓN QUE IMPORTA: entrar acá NO cancela nada. La cancelación va
 * detrás de un botón que una persona aprieta. Las vistas previas de WhatsApp,
 * los escáneres de correo y los antivirus corporativos abren los enlaces solos;
 * si el GET cancelara, un cliente perdería su hora sin haber hecho nada y sin
 * que nadie pudiera explicar por qué. Por eso la página solo pide confirmación
 * y el POST a /api/cancelar es el único que toca la base.
 *
 * Es un componente de cliente completo porque todo lo que hace es interacción:
 * leer el token, confirmar y contar qué pasó.
 */

import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { SiteMenu } from "@/components/layout/SiteMenu";
import { Footer } from "@/components/layout/Footer";

interface Respuesta {
  ok: boolean;
  penalizada?: boolean;
  pct?: number;
  pierdeCupon?: boolean;
  cupon?: string | null;
  mensaje: string;
}

export default function CancelarPage() {
  return (
    /* `useSearchParams` obliga a un límite de Suspense para que la página
       pueda prerenderizarse; sin esto el build falla. */
    <Suspense fallback={<Marco><Cargando /></Marco>}>
      <Contenido />
    </Suspense>
  );
}

function Contenido() {
  const token = useSearchParams().get("token")?.trim() ?? "";
  const [estado, setEstado] = useState<"listo" | "enviando" | "hecho">("listo");
  const [respuesta, setRespuesta] = useState<Respuesta | null>(null);

  const cancelar = async () => {
    setEstado("enviando");
    try {
      const r = await fetch(`/api/cancelar?token=${encodeURIComponent(token)}`, { method: "POST" });
      const cuerpo = (await r.json()) as Respuesta;
      setRespuesta(cuerpo);
    } catch {
      /* Ni siquiera un fallo de red puede dejar la pantalla muda: el cliente
         tiene que saber que su cita SIGUE en pie y qué hacer. */
      setRespuesta({
        ok: false,
        mensaje:
          "No pudimos conectarnos. Su cita sigue agendada. Inténtelo de nuevo o escríbanos por WhatsApp.",
      });
    }
    setEstado("hecho");
  };

  if (!token) {
    return (
      <Marco>
        <Tarjeta
          titulo="Enlace incompleto"
          texto="Este enlace no trae el código de su cita. Ábralo directamente desde el correo que le enviamos, sin copiarlo a medias."
        />
      </Marco>
    );
  }

  if (estado === "hecho" && respuesta) {
    return (
      <Marco>
        <Resultado respuesta={respuesta} />
      </Marco>
    );
  }

  return (
    <Marco>
      <div className="rounded-3xl bg-white p-7 shadow-sm ring-1 ring-ink/5">
        <h1 className="font-display text-3xl font-extrabold tracking-tight text-ink">
          ¿Cancelamos su cita?
        </h1>
        <p className="mt-3 text-[15px] leading-relaxed text-ink-soft">
          Al confirmar liberamos su hora para otra familia. No se puede deshacer:
          si después quiere volver, tendrá que reservar de nuevo.
        </p>

        <div className="mt-6 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={cancelar}
            disabled={estado === "enviando"}
            className="rounded-full bg-teal px-6 py-3 font-display text-sm font-extrabold text-white transition-colors hover:bg-teal-dark disabled:opacity-50"
          >
            {estado === "enviando" ? "Cancelando…" : "Sí, cancelar mi cita"}
          </button>
          <Link
            href="/"
            className="rounded-full border-2 border-ink/10 px-6 py-3 font-display text-sm font-extrabold text-ink-soft transition-colors hover:border-teal/40"
          >
            No, mantener la cita
          </Link>
        </div>
      </div>
    </Marco>
  );
}

/** Lo que pasó, dicho completo: si quedó penalizado y si perdió el cupón. */
function Resultado({ respuesta }: { respuesta: Respuesta }) {
  if (!respuesta.ok) {
    return <Tarjeta titulo="No se canceló" texto={respuesta.mensaje} tono="aviso" />;
  }

  return (
    <div className="rounded-3xl bg-white p-7 shadow-sm ring-1 ring-ink/5">
      <p className="text-xs font-extrabold uppercase tracking-[0.22em] text-teal-dark">
        Cita cancelada
      </p>
      <h1 className="mt-1 font-display text-3xl font-extrabold tracking-tight text-ink">
        Listo, su hora quedó liberada
      </h1>
      <p className="mt-3 text-[15px] leading-relaxed text-ink-soft">{respuesta.mensaje}</p>

      {/* Las consecuencias se dicen acá y no en un correo posterior: enterarse
          del recargo recién en la próxima visita es exactamente lo que hace
          que una regla razonable se sienta una trampa. */}
      {(respuesta.penalizada || respuesta.pierdeCupon) && (
        <ul className="mt-5 space-y-3 rounded-2xl bg-cream p-5 text-[15px] leading-relaxed text-ink-soft">
          {respuesta.penalizada && (
            <li className="flex gap-3">
              <span aria-hidden="true" className="mt-0.5 text-teal">🐾</span>
              <span>
                Su <strong className="font-bold text-ink">próxima cita</strong> tendrá un recargo
                del {respuesta.pct}%. Se aplica una sola vez y no se acumula.
              </span>
            </li>
          )}
          {respuesta.pierdeCupon && (
            <li className="flex gap-3">
              <span aria-hidden="true" className="mt-0.5 text-teal">🐾</span>
              <span>
                El cupón{" "}
                {respuesta.cupon ? (
                  <strong className="font-bold text-ink">{respuesta.cupon}</strong>
                ) : (
                  "que había usado"
                )}{" "}
                ya no queda disponible para esta reserva.
              </span>
            </li>
          )}
        </ul>
      )}

      <div className="mt-6 flex flex-wrap gap-3">
        <Link
          href="/reserva"
          className="rounded-full bg-teal px-6 py-3 font-display text-sm font-extrabold text-white transition-colors hover:bg-teal-dark"
        >
          Reservar otra hora
        </Link>
        <Link
          href="/"
          className="rounded-full border-2 border-ink/10 px-6 py-3 font-display text-sm font-extrabold text-ink-soft transition-colors hover:border-teal/40"
        >
          Volver al inicio
        </Link>
      </div>
    </div>
  );
}

function Tarjeta({
  titulo,
  texto,
  tono = "neutro",
}: {
  titulo: string;
  texto: string;
  tono?: "neutro" | "aviso";
}) {
  return (
    <div
      className={`rounded-3xl p-7 shadow-sm ring-1 ${
        tono === "aviso" ? "bg-[#fbeff3] ring-[#7a1030]/10" : "bg-white ring-ink/5"
      }`}
    >
      <h1 className="font-display text-3xl font-extrabold tracking-tight text-ink">{titulo}</h1>
      <p className="mt-3 text-[15px] leading-relaxed text-ink-soft">{texto}</p>
      <Link
        href="/"
        className="mt-6 inline-block rounded-full border-2 border-ink/10 px-6 py-3 font-display text-sm font-extrabold text-ink-soft transition-colors hover:border-teal/40"
      >
        Volver al inicio
      </Link>
    </div>
  );
}

function Cargando() {
  return (
    <div className="rounded-3xl bg-white p-7 text-center text-sm text-ink-soft shadow-sm">
      Cargando su cita…
    </div>
  );
}

function Marco({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SiteMenu />
      <main className="min-h-screen bg-cream px-5 pb-16 pt-28">
        <div className="mx-auto max-w-2xl">{children}</div>
      </main>
      <Footer />
    </>
  );
}
