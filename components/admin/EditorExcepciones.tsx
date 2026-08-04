"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  bloquearFechaAction,
  bloquearRangoAction,
  liberarFechaAction,
  type ExcepcionEditable,
} from "@/app/dashboard/disponibilidad/actions";
import { diaSemanaDe, hoyEnSantiago } from "@/lib/disponibilidad";

/* Días libres (reunión con Rodolfo, 27-jul).

   La idea del cliente: cuando se toma un día, que el formulario NO diga
   "cerrado" sino que los cupos están tomados. Por eso esta pantalla separa
   dos textos que es fácil confundir:

     · el mensaje  — lo lee el cliente
     · la nota     — la lee solo Rodolfo, nunca sale de acá

   La pantalla lo dice con todas sus letras en cada campo, porque escribir
   "vacaciones" en la casilla equivocada publicaría justo lo que la regla
   trata de esconder. */

interface EditorExcepcionesProps {
  excepcionesIniciales: ExcepcionEditable[];
  /** Texto general, para mostrar qué verá el cliente si no se escribe uno. */
  mensajePorDefecto: string;
  /** Días de la semana (0=domingo … 6=sábado) con horario de atención. Al
      bloquear un rango se saltan los demás: cerrar un domingo que ya no se
      atiende no cambia nada y llena la lista. */
  diasAtendidos: number[];
}

/* Mismo tope que la server action. Está repetido a propósito y no importado:
   `actions.ts` lleva "use server" y todo lo que exporta debe ser una función
   async, así que una constante no puede viajar desde ahí. */
const MAX_DIAS_RANGO = 92;

/** "2026-08-12" → "12 de agosto". Corto, para los resúmenes de rango. */
function fechaCorta(fecha: string): string {
  const [a, m, d] = fecha.split("-").map(Number);
  return new Date(a, m - 1, d).toLocaleDateString("es-CL", {
    day: "numeric",
    month: "long",
  });
}

/** "2026-08-12" → "martes 12 de agosto". Con la fecha partida a mano: pasar
    un YYYY-MM-DD por `new Date()` lo lee como UTC y en Chile muestra el día
    anterior. */
function fechaLarga(fecha: string): string {
  const [a, m, d] = fecha.split("-").map(Number);
  return new Date(a, m - 1, d).toLocaleDateString("es-CL", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

export function EditorExcepciones({
  excepcionesIniciales,
  mensajePorDefecto,
  diasAtendidos,
}: EditorExcepcionesProps) {
  const router = useRouter();
  const [excepciones, setExcepciones] = useState(excepcionesIniciales);
  const [fecha, setFecha] = useState("");
  const [hasta, setHasta] = useState("");
  const [mensaje, setMensaje] = useState("");
  const [nota, setNota] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState("");
  const [aviso, setAviso] = useState("");

  const yaBloqueada = excepciones.some((e) => e.fecha === fecha);
  const esRango = hasta !== "" && hasta !== fecha;

  /* Qué va a pasar si aprieta el botón, contado antes de apretarlo. Un rango
     de fechas es justo el caso donde uno cree que bloquea una semana y
     bloquea un mes; verlo escrito lo ataja. */
  const resumen = useMemo(() => {
    if (!fecha || !esRango) return null;
    if (hasta < fecha) return { invalido: "La fecha de término va antes que la de inicio." };

    const [a1, m1, d1] = fecha.split("-").map(Number);
    const [a2, m2, d2] = hasta.split("-").map(Number);
    const inicio = Date.UTC(a1, m1 - 1, d1);
    const fin = Date.UTC(a2, m2 - 1, d2);
    // El total sale de la resta, no de contar iteraciones: un rango absurdo
    // (equivocarse en el año) debe poder decir cuántos días son sin recorrer
    // miles de fechas ni quedarse en un tope que mostraría un número falso.
    const total = Math.round((fin - inicio) / 86_400_000) + 1;
    if (total > MAX_DIAS_RANGO) return { total, excede: true as const };

    // Se camina en UTC igual que en el servidor: sumar días sobre una fecha
    // local se rompe en el cambio de hora, y en Chile eso pasa dos veces al año.
    const dias: string[] = [];
    for (let t = inicio; t <= fin; t += 86_400_000) {
      const d = new Date(t);
      dias.push(
        `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(
          d.getUTCDate()
        ).padStart(2, "0")}`
      );
    }
    const atendidos = new Set(diasAtendidos);
    const seBloquean = atendidos.size === 0 ? dias : dias.filter((f) => atendidos.has(diaSemanaDe(f)));
    return {
      total,
      excede: false as const,
      seBloquean: seBloquean.length,
      omitidos: total - seBloquean.length,
      yaBloqueados: seBloquean.filter((f) => excepciones.some((e) => e.fecha === f)).length,
    };
  }, [fecha, hasta, esRango, diasAtendidos, excepciones]);

  const bloquear = async () => {
    setError("");
    setAviso("");
    if (!fecha) {
      setError("Elija una fecha.");
      return;
    }
    setOcupado(true);

    if (esRango) {
      const res = await bloquearRangoAction({
        desde: fecha,
        hasta,
        mensaje,
        notaInterna: nota,
        diasAtendidos,
      });
      setOcupado(false);
      if (!res.success) {
        setError(res.error ?? "No se pudieron bloquear las fechas.");
        return;
      }
      /* La lista se pide de vuelta al servidor en vez de reconstruirla acá:
         son muchas fechas y duplicar la regla de qué días se omiten es cómo
         la pantalla termina mostrando algo distinto de lo que quedó guardado.
         `router.refresh()` y no `location.reload()`: recargar entera la
         página se llevaría por delante el aviso de confirmación justo cuando
         hay que leerlo. */
      setAviso(
        `${res.bloqueadas} ${res.bloqueadas === 1 ? "día bloqueado" : "días bloqueados"}` +
          (res.omitidas
            ? ` · ${res.omitidas} sin atención ${res.omitidas === 1 ? "quedó" : "quedaron"} fuera`
            : "")
      );
      setFecha("");
      setHasta("");
      setMensaje("");
      setNota("");
      router.refresh();
      return;
    }

    const nueva: ExcepcionEditable = { fecha, mensaje, notaInterna: nota };
    const res = await bloquearFechaAction(nueva);
    setOcupado(false);
    if (!res.success) {
      setError(res.error ?? "No se pudo bloquear la fecha.");
      return;
    }
    setExcepciones((prev) =>
      [...prev.filter((e) => e.fecha !== fecha), nueva].sort((a, b) =>
        a.fecha.localeCompare(b.fecha)
      )
    );
    setFecha("");
    setHasta("");
    setMensaje("");
    setNota("");
  };

  const liberar = async (fechaALiberar: string) => {
    setError("");
    setOcupado(true);
    const res = await liberarFechaAction(fechaALiberar);
    setOcupado(false);
    if (!res.success) {
      setError(res.error ?? "No se pudo liberar la fecha.");
      return;
    }
    setExcepciones((prev) => prev.filter((e) => e.fecha !== fechaALiberar));
  };

  return (
    <div className="rounded-3xl bg-white p-7 shadow-sm">
      <h2 className="font-display text-lg font-extrabold text-ink">Días libres</h2>
      <p className="mt-1 max-w-2xl text-xs leading-relaxed text-ink-soft">
        Bloquee una fecha puntual sin tocar los horarios de la semana. Al
        cliente le aparece que <strong>ya no quedan cupos</strong> ese día —
        nunca que el local está cerrado.
      </p>

      {error && (
        <div
          role="alert"
          className="mt-5 flex items-center gap-2 rounded-2xl bg-[#fbdbe7] px-4 py-3 text-xs font-semibold text-[#7a1030]"
        >
          <span aria-hidden="true">⚠️</span>
          {error}
        </div>
      )}

      <div className="mt-5 rounded-2xl bg-cream px-4 py-4">
        {/* Las fechas ocupan su propia fila. Antes compartían un grid de dos
            columnas con el mensaje, y al sumar el segundo calendario la
            columna del mensaje quedó aplastada contra el borde. */}
        <div className="grid gap-4">
          <div>
            <span className="text-sm font-bold text-ink">Fecha</span>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <input
                id="fecha-libre"
                type="date"
                aria-label="Primer día bloqueado"
                value={fecha}
                min={hoyEnSantiago()}
                onChange={(e) => {
                  setFecha(e.target.value);
                  // Un "hasta" que quedó antes del nuevo inicio es basura que
                  // solo produce un error al guardar: se limpia solo.
                  if (hasta && e.target.value && hasta < e.target.value) setHasta("");
                  setError("");
                  setAviso("");
                }}
                disabled={ocupado}
                className="block rounded-xl border-2 border-white bg-white px-3 py-2 text-sm font-bold text-ink focus:border-teal focus:outline-none disabled:opacity-50"
              />
              <span className="text-xs font-bold text-ink-soft">hasta</span>
              <input
                id="fecha-libre-hasta"
                type="date"
                aria-label="Último día bloqueado (opcional, para varios días seguidos)"
                value={hasta}
                min={fecha || hoyEnSantiago()}
                onChange={(e) => {
                  setHasta(e.target.value);
                  setError("");
                  setAviso("");
                }}
                disabled={ocupado || !fecha}
                className="block rounded-xl border-2 border-white bg-white px-3 py-2 text-sm font-bold text-ink focus:border-teal focus:outline-none disabled:opacity-50"
              />
            </div>
            <p className="mt-1.5 text-[11px] leading-relaxed text-ink-soft">
              Para un solo día, deje el segundo campo vacío. Para vacaciones,
              ponga el último día y se bloquea todo el tramo de una vez.
            </p>
            {yaBloqueada && !esRango && (
              <p className="mt-1.5 text-[11px] font-semibold text-[#7a4d10]">
                Esa fecha ya está bloqueada — guardar la reemplaza.
              </p>
            )}
          </div>

          <div>
            <label htmlFor="mensaje-libre" className="text-sm font-bold text-ink">
              Mensaje para el cliente{" "}
              <span className="font-semibold text-ink-soft">(opcional)</span>
            </label>
            <input
              id="mensaje-libre"
              type="text"
              value={mensaje}
              maxLength={200}
              placeholder={mensajePorDefecto}
              onChange={(e) => setMensaje(e.target.value)}
              disabled={ocupado}
              className="mt-2 w-full rounded-xl border-2 border-white bg-white px-3 py-2 text-sm font-semibold text-ink focus:border-teal focus:outline-none disabled:opacity-50"
            />
            <p className="mt-1.5 text-[11px] leading-relaxed text-ink-soft">
              Esto <strong>lo lee el cliente</strong> en el formulario. En
              blanco se usa el texto general.
            </p>
          </div>
        </div>

        <div className="mt-4">
          <label htmlFor="nota-libre" className="text-sm font-bold text-ink">
            Nota para usted <span className="font-semibold text-ink-soft">(opcional)</span>
          </label>
          <input
            id="nota-libre"
            type="text"
            value={nota}
            maxLength={200}
            placeholder="Vacaciones, hora médica…"
            onChange={(e) => setNota(e.target.value)}
            disabled={ocupado}
            className="mt-2 w-full rounded-xl border-2 border-white bg-white px-3 py-2 text-sm font-semibold text-ink focus:border-teal focus:outline-none disabled:opacity-50"
          />
          <p className="mt-1.5 text-[11px] leading-relaxed text-ink-soft">
            🔒 Solo la ve usted. <strong>Nunca</strong> sale al formulario ni
            al sitio público.
          </p>
        </div>

        {/* Qué va a pasar, antes de que pase. */}
        {resumen && (
          <div
            className={`mt-4 rounded-2xl px-4 py-3 text-xs leading-relaxed ${
              "invalido" in resumen || resumen.excede
                ? "bg-[#fbdbe7] font-semibold text-[#7a1030]"
                : "bg-white font-semibold text-ink"
            }`}
          >
            {"invalido" in resumen ? (
              resumen.invalido
            ) : resumen.excede ? (
              <>
                Son {resumen.total} días y el máximo por tanda es {MAX_DIAS_RANGO}. Revise las
                fechas — si de verdad son tantos, hágalo en dos tandas.
              </>
            ) : (
              <>
                Se bloquean <strong>{resumen.seBloquean} días</strong>, del{" "}
                {fechaCorta(fecha)} al {fechaCorta(hasta)}.
                {resumen.omitidos > 0 && (
                  <span className="block text-ink-soft">
                    {resumen.omitidos} {resumen.omitidos === 1 ? "día queda" : "días quedan"} fuera
                    por no tener horario de atención.
                  </span>
                )}
                {resumen.yaBloqueados > 0 && (
                  <span className="block text-ink-soft">
                    {resumen.yaBloqueados}{" "}
                    {resumen.yaBloqueados === 1 ? "ya estaba bloqueado" : "ya estaban bloqueados"};
                    se les actualiza el texto.
                  </span>
                )}
              </>
            )}
          </div>
        )}

        {aviso && (
          <p className="mt-4 rounded-2xl bg-[#d8f0e3] px-4 py-3 text-xs font-bold text-teal-ink">
            ✅ {aviso}
          </p>
        )}

        <button
          type="button"
          onClick={bloquear}
          disabled={ocupado || !fecha || (resumen !== null && ("invalido" in resumen || resumen.excede))}
          className="mt-4 rounded-full bg-teal px-6 py-2.5 font-display text-sm font-extrabold text-white shadow-[0_3px_0_rgba(6,58,64,.25)] transition-[background-color,transform,box-shadow] duration-150 hover:bg-teal-dark active:translate-y-0.5 active:shadow-[0_1px_0_rgba(6,58,64,.25)] disabled:cursor-not-allowed disabled:opacity-60 disabled:active:translate-y-0"
        >
          {/* El conteo solo se muestra cuando de verdad se van a bloquear
              esos días. Con el rango fuera de rango el botón decía un número
              distinto al del aviso de arriba, y dos cifras que se contradicen
              en la misma pantalla es peor que no dar ninguna. */}
          {ocupado
            ? "Guardando…"
            : esRango && resumen && !("invalido" in resumen) && !resumen.excede
              ? `Bloquear ${resumen.seBloquean} días`
              : esRango
                ? "Bloquear estos días"
                : "Bloquear este día"}
        </button>
      </div>

      <div className="mt-6">
        <h3 className="text-xs font-extrabold uppercase tracking-wider text-ink-soft">
          Fechas bloqueadas
        </h3>

        {excepciones.length === 0 ? (
          <p className="mt-3 rounded-2xl bg-cream px-4 py-3 text-xs font-semibold text-ink-soft">
            No hay ningún día bloqueado. La agenda sigue los horarios de la semana.
          </p>
        ) : (
          <ul className="mt-3 space-y-2">
            {excepciones.map((e) => (
              <li
                key={e.fecha}
                className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-2xl bg-cream px-4 py-3"
              >
                <span className="text-sm font-extrabold text-ink first-letter:uppercase">
                  {fechaLarga(e.fecha)}
                </span>
                {e.notaInterna && (
                  <span className="rounded-full bg-white px-2.5 py-0.5 text-[11px] font-bold text-ink-soft">
                    🔒 {e.notaInterna}
                  </span>
                )}
                <span className="basis-full text-[11px] leading-relaxed text-ink-soft">
                  El cliente lee: “{e.mensaje.trim() || mensajePorDefecto}”
                </span>
                <button
                  type="button"
                  onClick={() => liberar(e.fecha)}
                  disabled={ocupado}
                  className="ml-auto rounded-full bg-white px-3 py-1.5 text-xs font-bold text-teal-dark transition-colors hover:bg-sky/40 disabled:opacity-50"
                >
                  Volver a abrir
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
