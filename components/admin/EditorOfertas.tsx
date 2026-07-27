"use client";

import { useState } from "react";
import {
  chocaConLeadTime,
  textoBeneficio,
  validarOferta,
  type Oferta,
  type TipoOferta,
} from "@/lib/ofertas";
import {
  crearOfertaAction,
  eliminarOfertaAction,
  guardarOfertaAction,
} from "@/app/dashboard/ofertas/actions";

/* Editor de ofertas (PRP-003 F2). Antes el incentivo estaba escrito en el
   HTML de /reserva y el descuento en otra tabla: cambiar uno sin el otro
   prometía algo distinto de lo que se cobraba. Acá el texto y el número son
   la misma fila. */

interface EditorOfertasProps {
  ofertasIniciales: Oferta[];
  /** Anticipación mínima configurada, para avisar si una oferta la contradice. */
  leadTimeDias: number;
}

function ofertaNueva(): Oferta {
  return {
    id: crypto.randomUUID(),
    titulo: "Oferta nueva",
    detalle: "Describe el beneficio como lo verá el cliente.",
    soloConCuenta: true,
    desdeVisita: 1,
    hastaVisita: 1,
    tipo: "pct",
    pct: 10,
    monto: null,
    activa: false,
    vigenteDesde: null,
    vigenteHasta: null,
  };
}

export function EditorOfertas({ ofertasIniciales, leadTimeDias }: EditorOfertasProps) {
  const [ofertas, setOfertas] = useState<Oferta[]>(ofertasIniciales);
  const [guardando, setGuardando] = useState<string | null>(null);
  const [guardada, setGuardada] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [porConfirmar, setPorConfirmar] = useState<string | null>(null);

  const actualizar = (id: string, cambios: Partial<Oferta>) => {
    setOfertas((prev) => prev.map((o) => (o.id === id ? { ...o, ...cambios } : o)));
    setGuardada(null);
    setError("");
  };

  const guardar = async (oferta: Oferta, esNueva: boolean) => {
    const problema = validarOferta(oferta);
    if (problema) {
      setError(problema);
      return;
    }
    setGuardando(oferta.id);
    setError("");
    const resultado = esNueva
      ? await crearOfertaAction(oferta)
      : await guardarOfertaAction(oferta);
    setGuardando(null);
    if (!resultado.success) {
      setError(resultado.error ?? "No se pudo guardar.");
      return;
    }
    setNuevas((prev) => prev.filter((n) => n !== oferta.id));
    setGuardada(oferta.id);
  };

  const [nuevas, setNuevas] = useState<string[]>([]);

  const agregar = () => {
    const o = ofertaNueva();
    setOfertas((prev) => [...prev, o]);
    setNuevas((prev) => [...prev, o.id]);
    setGuardada(null);
  };

  const eliminar = async (id: string) => {
    setPorConfirmar(null);
    // Si nunca se guardó, basta con sacarla de la lista.
    if (nuevas.includes(id)) {
      setOfertas((prev) => prev.filter((o) => o.id !== id));
      setNuevas((prev) => prev.filter((n) => n !== id));
      return;
    }
    setGuardando(id);
    const resultado = await eliminarOfertaAction(id);
    setGuardando(null);
    if (!resultado.success) {
      setError(resultado.error ?? "No se pudo eliminar.");
      return;
    }
    setOfertas((prev) => prev.filter((o) => o.id !== id));
  };

  return (
    <div className="space-y-5">
      {error && (
        <div
          role="alert"
          className="flex items-center gap-2 rounded-2xl bg-[#fbdbe7] px-4 py-3 text-xs font-semibold text-[#7a1030]"
        >
          <span aria-hidden="true">⚠️</span>
          {error}
        </div>
      )}

      {ofertas.length === 0 && (
        <div className="rounded-3xl bg-white p-10 text-center shadow-sm">
          <p className="font-display text-lg font-extrabold text-ink">
            No hay ninguna oferta creada
          </p>
          <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-ink-soft">
            Sin ofertas, quien entra a reservar no ve ningún motivo para crear
            una cuenta. Cree al menos una de bienvenida.
          </p>
        </div>
      )}

      {ofertas.map((oferta) => {
        const esNueva = nuevas.includes(oferta.id);
        const ocupado = guardando === oferta.id;
        const advertencia = chocaConLeadTime(oferta, leadTimeDias);

        return (
          <div key={oferta.id} className="rounded-3xl bg-white p-6 shadow-sm">
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={`rounded-full px-3 py-1 text-[11px] font-bold ${
                  oferta.activa ? "bg-[#d5efe2] text-teal-dark" : "bg-zinc-100 text-zinc-500"
                }`}
              >
                {oferta.activa ? "Activa" : "Apagada"}
              </span>
              <span className="rounded-full bg-[#fde4c8] px-3 py-1 text-[11px] font-bold text-[#7a4d10]">
                {textoBeneficio(oferta)} de descuento
              </span>
              <span className="text-[11px] font-bold text-ink-soft">
                {oferta.soloConCuenta ? "solo con cuenta" : "para todos"}
              </span>
              {esNueva && (
                <span className="text-[11px] font-bold text-orange">sin guardar</span>
              )}
            </div>

            <div className="mt-4 grid gap-3">
              <div>
                <label
                  htmlFor={`titulo-${oferta.id}`}
                  className="block text-[11px] font-extrabold uppercase tracking-wider text-ink-soft"
                >
                  Título
                </label>
                <input
                  id={`titulo-${oferta.id}`}
                  type="text"
                  value={oferta.titulo}
                  onChange={(e) => actualizar(oferta.id, { titulo: e.target.value })}
                  disabled={ocupado}
                  maxLength={60}
                  className="mt-1 w-full rounded-xl border-2 border-transparent bg-cream px-3 py-2 text-sm font-bold text-ink focus:border-teal focus:outline-none disabled:opacity-50"
                />
              </div>

              <div>
                <label
                  htmlFor={`detalle-${oferta.id}`}
                  className="block text-[11px] font-extrabold uppercase tracking-wider text-ink-soft"
                >
                  Cómo lo ve el cliente
                </label>
                <textarea
                  id={`detalle-${oferta.id}`}
                  value={oferta.detalle}
                  onChange={(e) => actualizar(oferta.id, { detalle: e.target.value })}
                  disabled={ocupado}
                  maxLength={200}
                  rows={2}
                  className="mt-1 w-full rounded-xl border-2 border-transparent bg-cream px-3 py-2 text-sm text-ink focus:border-teal focus:outline-none disabled:opacity-50"
                />
              </div>

              {advertencia && (
                <p className="rounded-2xl bg-[#fde4c8] px-4 py-2.5 text-xs font-semibold text-[#7a4d10]">
                  ⚠️ El texto promete una fecha muy próxima, pero las reservas se
                  piden con {leadTimeDias} {leadTimeDias === 1 ? "día" : "días"} de
                  anticipación. Revise la redacción o cambie la anticipación en{" "}
                  <a href="/dashboard/disponibilidad" className="underline">
                    Disponibilidad
                  </a>
                  .
                </p>
              )}

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl bg-cream px-4 py-3">
                  <p className="text-xs font-extrabold uppercase tracking-wider text-ink-soft">
                    Descuento
                  </p>
                  <div className="mt-2 flex items-center gap-2">
                    {oferta.tipo === "monto" && (
                      <span className="text-sm font-bold text-ink-soft">$</span>
                    )}
                    <label htmlFor={`valor-${oferta.id}`} className="sr-only">
                      Valor del descuento
                    </label>
                    <input
                      id={`valor-${oferta.id}`}
                      type="number"
                      min={0}
                      step={oferta.tipo === "monto" ? 500 : 1}
                      value={oferta.tipo === "monto" ? (oferta.monto ?? 0) : oferta.pct}
                      onChange={(e) => {
                        const n = parseFloat(e.target.value) || 0;
                        actualizar(
                          oferta.id,
                          oferta.tipo === "monto" ? { monto: Math.round(n) } : { pct: n }
                        );
                      }}
                      disabled={ocupado}
                      className={`rounded-xl border-2 border-white bg-white px-2.5 py-1.5 text-right text-sm font-extrabold text-ink focus:border-teal focus:outline-none disabled:opacity-50 ${
                        oferta.tipo === "monto" ? "w-24" : "w-20"
                      }`}
                    />
                    <label htmlFor={`tipo-${oferta.id}`} className="sr-only">
                      Porcentaje o monto fijo
                    </label>
                    <select
                      id={`tipo-${oferta.id}`}
                      value={oferta.tipo}
                      onChange={(e) => {
                        const tipo = e.target.value as TipoOferta;
                        // No se convierte el número: un 10 que pasa a pesos no
                        // son $10, y adivinar la equivalencia sería inventar un
                        // precio.
                        actualizar(oferta.id, {
                          tipo,
                          monto: tipo === "monto" ? (oferta.monto ?? 0) : null,
                        });
                      }}
                      disabled={ocupado}
                      className="rounded-xl border-2 border-white bg-white px-2 py-1.5 text-sm font-bold text-ink focus:border-teal focus:outline-none disabled:opacity-50"
                    >
                      <option value="pct">%</option>
                      <option value="monto">$ fijo</option>
                    </select>
                  </div>
                </div>

                <div className="rounded-2xl bg-cream px-4 py-3">
                  <p className="text-xs font-extrabold uppercase tracking-wider text-ink-soft">
                    ¿En qué visita?
                  </p>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <label htmlFor={`desde-${oferta.id}`} className="text-xs font-bold text-ink-soft">
                      de la
                    </label>
                    <input
                      id={`desde-${oferta.id}`}
                      type="number"
                      min={1}
                      value={oferta.desdeVisita}
                      onChange={(e) =>
                        actualizar(oferta.id, { desdeVisita: parseInt(e.target.value, 10) || 1 })
                      }
                      disabled={ocupado}
                      className="w-16 rounded-xl border-2 border-white bg-white px-2.5 py-1.5 text-right text-sm font-extrabold text-ink focus:border-teal focus:outline-none disabled:opacity-50"
                    />
                    <label htmlFor={`hasta-${oferta.id}`} className="text-xs font-bold text-ink-soft">
                      a la
                    </label>
                    <input
                      id={`hasta-${oferta.id}`}
                      type="number"
                      min={oferta.desdeVisita}
                      placeholder="∞"
                      value={oferta.hastaVisita ?? ""}
                      onChange={(e) =>
                        actualizar(oferta.id, {
                          hastaVisita: e.target.value === "" ? null : parseInt(e.target.value, 10),
                        })
                      }
                      disabled={ocupado}
                      className="w-16 rounded-xl border-2 border-white bg-white px-2.5 py-1.5 text-right text-sm font-extrabold text-ink focus:border-teal focus:outline-none disabled:opacity-50"
                    />
                  </div>
                  <p className="mt-1.5 text-[11px] leading-relaxed text-ink-soft">
                    {oferta.hastaVisita === null
                      ? `Desde la visita ${oferta.desdeVisita} en adelante.`
                      : oferta.desdeVisita === oferta.hastaVisita
                        ? `Solo en la visita ${oferta.desdeVisita}.`
                        : `De la visita ${oferta.desdeVisita} a la ${oferta.hastaVisita}.`}
                  </p>

                  {/* Sin cuenta no se puede saber cuántas visitas lleva
                      alguien: contar por teléfono a cualquiera que lo pida
                      permitiría averiguar quién es cliente del local
                      probando números (PRP-004 F3). Se dice acá en vez de
                      dejar que la oferta falle en silencio. */}
                  {oferta.desdeVisita > 1 && !oferta.soloConCuenta && (
                    <p className="mt-2 rounded-xl bg-[#fde4c8] px-3 py-2 text-[11px] leading-relaxed text-[#7a4d10]">
                      ⚠️ Esta oferta empieza en la visita {oferta.desdeVisita} pero
                      está abierta a todos. A quien reserve <strong>sin cuenta</strong>{" "}
                      no se le puede contar el historial, así que no la recibirá.
                      Marque &ldquo;solo para quien tenga cuenta&rdquo; para que se
                      entienda como beneficio de registrarse.
                    </p>
                  )}
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl bg-cream px-4 py-3">
                  <label htmlFor={`vdesde-${oferta.id}`} className="block text-[11px] font-extrabold uppercase tracking-wider text-ink-soft">
                    Vigente desde (opcional)
                  </label>
                  <input
                    id={`vdesde-${oferta.id}`}
                    type="date"
                    value={oferta.vigenteDesde ?? ""}
                    onChange={(e) => actualizar(oferta.id, { vigenteDesde: e.target.value || null })}
                    disabled={ocupado}
                    className="mt-1 rounded-xl border-2 border-white bg-white px-3 py-2 text-sm font-semibold text-ink focus:border-teal focus:outline-none disabled:opacity-50"
                  />
                </div>
                <div className="rounded-2xl bg-cream px-4 py-3">
                  <label htmlFor={`vhasta-${oferta.id}`} className="block text-[11px] font-extrabold uppercase tracking-wider text-ink-soft">
                    Hasta (opcional)
                  </label>
                  <input
                    id={`vhasta-${oferta.id}`}
                    type="date"
                    value={oferta.vigenteHasta ?? ""}
                    onChange={(e) => actualizar(oferta.id, { vigenteHasta: e.target.value || null })}
                    disabled={ocupado}
                    className="mt-1 rounded-xl border-2 border-white bg-white px-3 py-2 text-sm font-semibold text-ink focus:border-teal focus:outline-none disabled:opacity-50"
                  />
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-4">
                <label className="flex items-center gap-2 text-xs font-bold text-ink-soft">
                  <input
                    type="checkbox"
                    checked={oferta.activa}
                    onChange={(e) => actualizar(oferta.id, { activa: e.target.checked })}
                    disabled={ocupado}
                    className="h-4 w-4 accent-teal-dark"
                  />
                  Activa
                </label>
                <label className="flex items-center gap-2 text-xs font-bold text-ink-soft">
                  <input
                    type="checkbox"
                    checked={oferta.soloConCuenta}
                    onChange={(e) => actualizar(oferta.id, { soloConCuenta: e.target.checked })}
                    disabled={ocupado}
                    className="h-4 w-4 accent-teal-dark"
                  />
                  Solo para quien tenga cuenta
                </label>
              </div>
            </div>

            <div className="mt-5 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => guardar(oferta, esNueva)}
                disabled={ocupado}
                className="rounded-full bg-teal px-6 py-2.5 font-display text-sm font-extrabold text-white shadow-[0_3px_0_rgba(6,58,64,.25)] transition-[background-color,transform,box-shadow] duration-150 hover:bg-teal-dark active:translate-y-0.5 active:shadow-[0_1px_0_rgba(6,58,64,.25)] disabled:cursor-not-allowed disabled:opacity-60 disabled:active:translate-y-0"
              >
                {ocupado ? "Guardando…" : esNueva ? "Crear oferta" : "Guardar"}
              </button>
              {guardada === oferta.id && !ocupado && (
                <span className="text-sm font-bold text-teal-dark">✓ Guardada</span>
              )}

              {porConfirmar === oferta.id ? (
                <span className="ml-auto flex items-center gap-2 text-xs font-bold text-[#7a1030]">
                  ¿Eliminar?
                  <button
                    type="button"
                    onClick={() => eliminar(oferta.id)}
                    disabled={ocupado}
                    className="rounded-full bg-[#fbdbe7] px-3 py-1 font-bold text-[#7a1030] disabled:opacity-50"
                  >
                    Sí, eliminar
                  </button>
                  <button
                    type="button"
                    onClick={() => setPorConfirmar(null)}
                    className="text-ink-soft underline underline-offset-2"
                  >
                    No
                  </button>
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => setPorConfirmar(oferta.id)}
                  disabled={ocupado}
                  className="ml-auto text-xs font-bold text-ink-soft underline underline-offset-2 hover:text-[#7a1030] disabled:opacity-50"
                >
                  Eliminar
                </button>
              )}
            </div>
          </div>
        );
      })}

      <button
        type="button"
        onClick={agregar}
        className="rounded-full border-2 border-ink/15 px-6 py-3 font-display text-sm font-extrabold text-ink transition-colors hover:border-ink/30"
      >
        + Oferta nueva
      </button>
    </div>
  );
}
