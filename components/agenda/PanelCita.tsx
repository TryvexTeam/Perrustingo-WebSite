"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { CitaSemana } from "@/lib/agenda";
import { ESTADO_COLOR, ESTADO_LABEL } from "@/lib/citas";
import { formatCLP } from "@/lib/reserva";
import {
  asignarPeluqueroAction,
  cambiarEstadoCita,
  estadoAtrasoAction,
  estadoCierreAction,
  guardarNotasEquipo,
  marcarLlegadaAction,
  registrarPrecioCobradoAction,
  resolverRecargoAction,
  type EstadoAtraso,
  type EstadoCierre,
} from "@/app/dashboard/citas/actions";
import { avisarPerroListoAction } from "@/app/dashboard/citas/aviso-actions";
import { createClient } from "@/lib/supabase/client";
import { FotosCita } from "@/components/admin/FotosCita";

interface PanelCitaProps {
  cita: CitaSemana;
  onCerrar: () => void;
}

const CAMPOS_DETALLE: Record<string, string> = {
  nombrePerro: "Perro",
  raza: "Raza",
  edad: "Edad",
  esPrimeraVez: "Primera peluquería",
  pesoKg: "Peso (kg)",
  contextura: "Contextura",
  tipoPelo: "Tipo de pelo",
  salud: "Salud",
  temperamento: "Temperamento",
  noSeDejaCon: "No se deja con",
};

/** Panel lateral del equipo: contexto completo de la cita + acciones de estado. */
export function PanelCita({ cita, onCerrar }: PanelCitaProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [hora, setHora] = useState("10:00");
  const [duracion, setDuracion] = useState("1.5");
  const [notas, setNotas] = useState(cita.sesion?.notas_equipo ?? "");
  const [notasEstado, setNotasEstado] = useState<"idle" | "guardando" | "ok" | "error">("idle");
  const [historial, setHistorial] = useState<{ fecha: string; notas: string }[]>([]);
  /* Aviso "está listo". Estado propio y no el `pending` general: mientras se
     manda el correo, los botones de estado tienen que seguir usables.

     Arranca en "enviado" si la cita ya trae la marca (migración 030). Antes
     arrancaba siempre en "idle", así que cerrar y reabrir el panel volvía a
     habilitar el botón y el cliente recibía el aviso dos veces. */
  const avisadoEn = cita.sesion?.aviso_listo_en ?? null;
  const [aviso, setAviso] = useState<"idle" | "enviando" | "enviado" | "error">(
    avisadoEn ? "enviado" : "idle"
  );
  const [avisoError, setAvisoError] = useState("");

  const sesionId = cita.sesion?.id;
  const perroId = cita.sesion?.perro_id;

  /* Llegada real y recargo por atraso (migración 035).
     Se piden al servidor y no vienen con la cita: la vista `sesiones_equipo`
     tiene una lista fija de columnas (migración 030) y no incluye
     `llegada_en` ni los recargos, así que desde este navegador no existen. */
  const [atraso, setAtraso] = useState<EstadoAtraso | null>(null);
  const [atrasoOcupado, setAtrasoOcupado] = useState(false);
  const [atrasoError, setAtrasoError] = useState("");

  /* Cierre de la cita: lo cobrado y el peluquero asignado.
     Viaja por server action por lo mismo que el atraso — `peluquero_id` no
     está en la lista de columnas de `sesiones_equipo` (migración 030), así que
     desde este navegador ese campo sencillamente no existe. */
  const [cierre, setCierre] = useState<EstadoCierre | null>(null);
  /* Lo que la persona escribió. Vive aparte de `cierre` a propósito: mientras
     alguien está tecleando, el número de la pantalla es SUYO y ninguna
     respuesta del servidor se lo puede pisar. */
  const [cobrado, setCobrado] = useState("");
  const [cierreEstado, setCierreEstado] = useState<"idle" | "guardando" | "ok" | "error">("idle");
  const [cierreError, setCierreError] = useState("");
  const [asignando, setAsignando] = useState(false);

  /* Notas de visitas anteriores del mismo perrito (RLS: solo el equipo llega
     a este panel). Las fotos las carga <FotosCita>, que además las sube. */
  useEffect(() => {
    if (!sesionId) return;
    const supabase = createClient();

    if (perroId) {
      supabase
        .from("sesiones_equipo")
        .select("fecha_cita, notas_equipo")
        .eq("perro_id", perroId)
        .neq("id", sesionId)
        .not("notas_equipo", "is", null)
        .order("fecha_cita", { ascending: false })
        .limit(5)
        .then(({ data }) =>
          setHistorial(
            (data ?? []).map((s) => ({
              fecha: s.fecha_cita ? new Date(s.fecha_cita).toLocaleDateString("es-CL") : "—",
              notas: s.notas_equipo as string,
            }))
          )
        );
    }
  }, [sesionId, perroId]);

  /* El estado del atraso se lee al abrir la ficha. Un fallo acá no se pinta
     como error: si la migración 035 todavía no está aplicada, la sección
     simplemente no aparece en vez de llenar el panel de alarmas. */
  useEffect(() => {
    if (!sesionId) return;
    let vigente = true;
    estadoAtrasoAction(sesionId).then((res) => {
      if (vigente && res.success && res.estado) setAtraso(res.estado);
    });
    return () => {
      vigente = false;
    };
  }, [sesionId]);

  /* El cierre se lee al abrir la ficha. El campo del monto arranca con lo que
     YA se había registrado, o vacío: nunca precargado con la sugerencia. Un
     input que viene lleno con una cifra del sistema se guarda sin mirarlo, y
     entonces el número que termina en las analíticas no lo decidió nadie. */
  useEffect(() => {
    if (!sesionId) return;
    let vigente = true;
    estadoCierreAction(sesionId).then((res) => {
      if (!vigente || !res.success || !res.estado) return;
      setCierre(res.estado);
      setCobrado(res.estado.precioCobrado === null ? "" : String(res.estado.precioCobrado));
    });
    return () => {
      vigente = false;
    };
  }, [sesionId]);

  const sesion = cita.sesion;
  if (!sesion) return null;

  const marcarLlegada = () => {
    setAtrasoError("");
    setAtrasoOcupado(true);
    startTransition(async () => {
      const res = await marcarLlegadaAction(sesion.id);
      setAtrasoOcupado(false);
      // La llegada ya marcada devuelve el estado real junto al error: se
      // muestra el estado, que es más útil que insistir con el reclamo.
      if (res.estado) setAtraso(res.estado);
      if (!res.success && !res.estado) {
        setAtrasoError(res.error ?? "No se pudo marcar la llegada.");
      }
    });
  };

  const resolverRecargo = (cobrar: boolean) => {
    setAtrasoError("");
    setAtrasoOcupado(true);
    startTransition(async () => {
      const res = await resolverRecargoAction(sesion.id, cobrar);
      setAtrasoOcupado(false);
      if (!res.success) {
        setAtrasoError(res.error ?? "No se pudo guardar la decisión.");
        return;
      }
      if (res.estado) setAtraso(res.estado);
    });
  };

  const guardarCobrado = () => {
    setCierreError("");
    const limpio = cobrado.trim();
    if (limpio === "") {
      setCierreEstado("error");
      setCierreError("Escriba lo que se cobró. Si no cobró nada, ponga 0.");
      return;
    }
    /* Se valida acá para no gastar un viaje, pero el servidor vuelve a
       validar: esta comprobación es comodidad, no el control. */
    const monto = Number(limpio);
    if (!Number.isInteger(monto)) {
      setCierreEstado("error");
      setCierreError("Solo pesos enteros, sin puntos ni decimales.");
      return;
    }
    setCierreEstado("guardando");
    startTransition(async () => {
      const res = await registrarPrecioCobradoAction(sesion.id, monto);
      if (!res.success) {
        setCierreEstado("error");
        setCierreError(res.error ?? "No se pudo guardar el monto.");
        return;
      }
      setCierreEstado("ok");
      if (res.estado) {
        setCierre(res.estado);
        setCobrado(res.estado.precioCobrado === null ? "" : String(res.estado.precioCobrado));
      }
      // El dashboard y las analíticas leen `precio_final`: sin esto seguirían
      // mostrando el ingreso viejo detrás del panel.
      router.refresh();
    });
  };

  const asignarPeluquero = (peluqueroId: string) => {
    setCierreError("");
    setAsignando(true);
    startTransition(async () => {
      const res = await asignarPeluqueroAction(sesion.id, peluqueroId || null);
      setAsignando(false);
      if (!res.success) {
        setCierreError(res.error ?? "No se pudo asignar la cita.");
        return;
      }
      if (res.estado) setCierre(res.estado);
      router.refresh();
    });
  };

  const guardarNotas = () => {
    setNotasEstado("guardando");
    startTransition(async () => {
      const res = await guardarNotasEquipo(sesion.id, notas);
      setNotasEstado(res.success ? "ok" : "error");
    });
  };

  /* El correo lo arma y lo manda el servidor: acá solo viaja el id de la
     cita. Ni el correo ni el teléfono del cliente pasan por este navegador,
     que es justamente el del peluquero. */
  const avisarListo = () => {
    setAviso("enviando");
    setAvisoError("");
    startTransition(async () => {
      const res = await avisarPerroListoAction(sesion.id);
      if (!res.success) {
        setAviso("error");
        setAvisoError(res.error ?? "No se pudo enviar el aviso.");
        return;
      }
      setAviso("enviado");
    });
  };

  const accion = (nuevoEstado: "confirmada" | "cancelada" | "en_proceso" | "completada") => {
    setError(null);
    startTransition(async () => {
      const conHorario =
        nuevoEstado === "confirmada"
          ? { fechaCita: `${cita.fecha}T${hora}:00`, duracionHoras: parseFloat(duracion) }
          : undefined;
      const res = await cambiarEstadoCita(sesion.id, nuevoEstado, conHorario);
      if (!res.success) {
        setError(res.error ?? "Error desconocido.");
        return;
      }
      onCerrar();
      router.refresh();
    });
  };

  const detalle = sesion.detalle_form ?? {};

  return (
    <>
      <div className="fixed inset-0 z-40 bg-ink/30" onClick={onCerrar} aria-hidden="true" />
      <aside
        className="fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col overflow-y-auto bg-white p-6 shadow-2xl"
        role="dialog"
        aria-label={`Detalle de cita de ${cita.titulo}`}
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <span
              className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${ESTADO_COLOR[cita.estado]}`}
            >
              {ESTADO_LABEL[cita.estado]}
            </span>
            <h2 className="mt-2 font-display text-2xl font-extrabold text-ink">{cita.titulo}</h2>
            <p className="text-sm text-ink-soft">
              {cita.subtitulo} · {cita.fecha}
            </p>
          </div>
          <button
            type="button"
            onClick={onCerrar}
            aria-label="Cerrar panel"
            className="flex h-9 w-9 flex-none items-center justify-center rounded-full text-lg font-bold text-ink-soft hover:bg-ink/5"
          >
            ✕
          </button>
        </div>

        {/* Contacto del solicitante.

            El correo y el teléfono llegan en NULL cuando quien mira no es
            admin (migración 027): la vista `sesiones_equipo` los recorta en
            la base, no acá. Por eso este bloque no pregunta por el rol —
            simplemente no dibuja lo que no vino. Un dato ausente no se
            puede olvidar de esconder. */}
        <section className="mb-4 rounded-2xl bg-cream p-4">
          <h3 className="mb-2 text-xs font-extrabold uppercase tracking-wide text-teal-dark">
            Contacto
          </h3>
          <p className="font-semibold text-ink">{sesion.contacto_nombre ?? "—"}</p>
          {sesion.contacto_email && (
            <a href={`mailto:${sesion.contacto_email}`} className="block text-sm text-teal-dark underline underline-offset-2">
              {sesion.contacto_email}
            </a>
          )}
          {sesion.contacto_telefono && (
            <a
              href={`https://wa.me/${sesion.contacto_telefono.replace(/\D/g, "")}`}
              target="_blank"
              rel="noopener noreferrer"
              className="block text-sm text-teal-dark underline underline-offset-2"
            >
              WhatsApp {sesion.contacto_telefono}
            </a>
          )}
        </section>

        {/* Detalle del formulario */}
        <section className="mb-4 rounded-2xl border border-zinc-100 p-4">
          <h3 className="mb-2 text-xs font-extrabold uppercase tracking-wide text-teal-dark">
            Ficha de la mascota
          </h3>
          <dl className="space-y-1.5 text-sm">
            {Object.entries(detalle).map(([clave, valor]) =>
              valor ? (
                <div key={clave} className="flex justify-between gap-3">
                  <dt className="font-semibold text-ink-soft">{CAMPOS_DETALLE[clave] ?? clave}</dt>
                  <dd className="text-right font-semibold text-ink">{valor}</dd>
                </div>
              ) : null
            )}
            {sesion.precio_base != null && (
              <div className="flex justify-between gap-3 border-t border-zinc-100 pt-2">
                <dt className="font-semibold text-ink-soft">Precio estimado</dt>
                <dd className="font-extrabold text-teal-dark">{formatCLP(sesion.precio_base)}</dd>
              </div>
            )}
          </dl>
        </section>

        {/* Fotos de la visita: las del cliente y el resultado que sube el
            equipo. Antes esta sección solo mostraba lo que traía el cliente;
            desde PRP-002 F3 también se sube el "después" desde acá. */}
        {sesionId && <FotosCita sesionId={sesionId} estado={sesion.estado} />}

        {/* Historial del perrito: lo que dejaron los colegas en visitas previas */}
        {historial.length > 0 && (
          <section className="mb-4 rounded-2xl bg-sky/30 p-4">
            <h3 className="mb-2 text-xs font-extrabold uppercase tracking-wide text-teal-dark">
              Visitas anteriores
            </h3>
            <ul className="space-y-2 text-sm">
              {historial.map((h, i) => (
                <li key={i}>
                  <span className="font-bold text-ink-soft">{h.fecha}:</span>{" "}
                  <span className="text-ink">{h.notas}</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* ── Llegada y recargo por atraso (migración 035) ──────────────────

            El sistema PROPONE y el equipo CONFIRMA. Acá nunca se cobra solo:
            hay dos botones separados, cobrar y perdonar, justamente para dejar
            margen con el cliente de siempre o con el taco de verdad.

            No aparece en las canceladas: a nadie que no vino se le mide el
            atraso. */}
        {atraso && cita.estado !== "cancelada" && (
          <section className="mb-4 rounded-2xl border border-zinc-100 p-4">
            <h3 className="mb-2 text-xs font-extrabold uppercase tracking-wide text-teal-dark">
              Llegada del cliente
            </h3>

            {!atraso.llegadaEn ? (
              <>
                <p className="text-sm text-ink-soft">
                  Sin marcar. Sin la hora real de llegada no hay de dónde sacar
                  los minutos de atraso.
                </p>
                <button
                  type="button"
                  onClick={marcarLlegada}
                  disabled={pending || atrasoOcupado}
                  className="mt-3 w-full rounded-full border-2 border-teal px-5 py-2.5 font-display text-sm font-extrabold text-teal-dark transition-colors hover:bg-sky/40 disabled:opacity-50"
                >
                  {atrasoOcupado ? "Marcando…" : "Llegó 🐾"}
                </button>
              </>
            ) : (
              <>
                <p className="text-sm font-semibold text-ink">
                  Llegó a las{" "}
                  {new Date(atraso.llegadaEn).toLocaleTimeString("es-CL", {
                    timeZone: "America/Santiago",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </p>
                {/* La frase la redacta `lib/politica.ts`: el porqué del número
                    se cuenta en un solo lugar. */}
                <p className="mt-1 text-xs leading-relaxed text-ink-soft">
                  {atraso.explicacion}
                </p>

                {atraso.aceptado === null && atraso.recargo > 0 && (
                  <div className="mt-3 rounded-xl bg-cream px-3 py-3">
                    <p className="text-xs font-bold leading-relaxed text-ink">
                      Recargo propuesto: {formatCLP(atraso.recargo)}. Todavía no se
                      cobra nada — usted decide.
                    </p>
                    <div className="mt-3 flex gap-2">
                      <button
                        type="button"
                        onClick={() => resolverRecargo(true)}
                        disabled={pending || atrasoOcupado}
                        className="flex-1 rounded-full bg-teal px-4 py-2 text-xs font-extrabold text-white transition-colors hover:bg-teal-dark disabled:opacity-50"
                      >
                        Cobrar {formatCLP(atraso.recargo)}
                      </button>
                      <button
                        type="button"
                        onClick={() => resolverRecargo(false)}
                        disabled={pending || atrasoOcupado}
                        className="flex-1 rounded-full border-2 border-teal px-4 py-2 text-xs font-extrabold text-teal-dark transition-colors hover:bg-sky/40 disabled:opacity-50"
                      >
                        Perdonar
                      </button>
                    </div>
                  </div>
                )}

                {atraso.aceptado === null && atraso.recargo === 0 && (
                  <p className="mt-2 text-xs font-semibold text-ink-soft">
                    {atraso.politicaActiva
                      ? "Sin recargo que cobrar."
                      : "La política de atrasos está apagada: no se propone ningún monto."}
                  </p>
                )}

                {atraso.aceptado === true && (
                  <p className="mt-2 text-xs font-bold text-[#7a4d10]">
                    Se cobra el recargo de {formatCLP(atraso.recargo)}.
                  </p>
                )}
                {atraso.aceptado === false && (
                  <p className="mt-2 text-xs font-bold text-teal-dark">
                    Recargo perdonado. No se le cobra nada extra.
                  </p>
                )}
              </>
            )}

            {atrasoError && (
              <p role="alert" className="mt-2 text-xs font-semibold text-[#7a1030]">
                {atrasoError}
              </p>
            )}
          </section>
        )}

        {/* ── Cierre: lo que se cobró y quién atiende ───────────────────────

            Los dos datos que faltaban. `precio_final` no se escribía en
            ninguna parte, así que los ingresos del dashboard se calculaban
            sobre el estimado que armó el navegador; y `peluquero_id` estaba
            en la base desde la 035 sin que nadie la llenara.

            Los dos precios se muestran juntos y el estimado no se toca: la
            diferencia entre lo prometido y lo cobrado es el dato.

            No aparece en las canceladas: a una cita que no ocurrió no se le
            cobra ni se le asigna a nadie. */}
        {cierre && cita.estado !== "cancelada" && (
          <section className="mb-4 rounded-2xl border border-zinc-100 p-4">
            <h3 className="mb-2 text-xs font-extrabold uppercase tracking-wide text-teal-dark">
              Cierre de la cita
            </h3>

            <div className="flex items-baseline justify-between gap-3 text-sm">
              <span className="font-semibold text-ink-soft">Estimado al reservar</span>
              <span className="font-bold text-ink">
                {cierre.precioEstimado === null ? "—" : formatCLP(cierre.precioEstimado)}
              </span>
            </div>
            {cierre.recargoCobrado > 0 && (
              <div className="mt-1 flex items-baseline justify-between gap-3 text-sm">
                <span className="font-semibold text-ink-soft">Recargo por atraso aceptado</span>
                <span className="font-bold text-[#7a4d10]">
                  + {formatCLP(cierre.recargoCobrado)}
                </span>
              </div>
            )}

            <label className="mt-3 block text-xs font-bold text-ink-soft" htmlFor="monto-cobrado">
              Lo que se cobró de verdad
            </label>
            <div className="mt-1 flex gap-2">
              <input
                id="monto-cobrado"
                type="number"
                inputMode="numeric"
                step={1}
                min={0}
                value={cobrado}
                onChange={(e) => {
                  setCobrado(e.target.value);
                  setCierreEstado("idle");
                  setCierreError("");
                }}
                placeholder="Ej: 38000"
                className="w-full rounded-xl border border-zinc-200 px-3 py-2 text-sm font-semibold text-ink outline-none focus:border-teal"
              />
              <button
                type="button"
                disabled={pending || cierreEstado === "guardando"}
                onClick={guardarCobrado}
                className="flex-none rounded-full bg-teal px-4 py-2 text-xs font-extrabold text-white transition-colors hover:bg-teal-dark disabled:opacity-50"
              >
                {cierreEstado === "guardando" ? "Guardando…" : "Guardar"}
              </button>
            </div>

            {/* El sistema PROPONE. El botón solo escribe la cifra en el campo:
                todavía hay que apretar Guardar. Nada se cobra ni se fija solo,
                que es la regla del dueño para el recargo y vale igual acá. */}
            {cierre.sugerido !== null && String(cierre.sugerido) !== cobrado.trim() && (
              <button
                type="button"
                onClick={() => {
                  setCobrado(String(cierre.sugerido));
                  setCierreEstado("idle");
                  setCierreError("");
                }}
                className="mt-2 text-xs font-bold text-teal-dark underline underline-offset-2"
              >
                Usar el sugerido: {formatCLP(cierre.sugerido)}
                {cierre.recargoCobrado > 0 ? " (estimado + recargo)" : ""}
              </button>
            )}

            <p className="mt-2 text-xs leading-relaxed text-ink-soft">
              {cierre.precioCobrado === null
                ? "Todavía no se registra ningún cobro. El estimado no cuenta como plata que entró."
                : `Registrado: ${formatCLP(cierre.precioCobrado)}. El estimado queda tal cual, para poder comparar.`}
            </p>

            {cierreEstado === "ok" && (
              <p className="mt-1 text-xs font-bold text-teal-dark">✓ Cobro guardado.</p>
            )}

            {/* Asignación. Solo el admin elige (decisión del dueño, 4-ago);
                el trabajador ve a quién le tocó. */}
            <div className="mt-4 border-t border-zinc-100 pt-3">
              <label className="block text-xs font-bold text-ink-soft" htmlFor="peluquero-cita">
                Peluquero a cargo
              </label>
              {cierre.puedeAsignar ? (
                <select
                  id="peluquero-cita"
                  value={cierre.peluqueroId ?? ""}
                  disabled={pending || asignando}
                  onChange={(e) => asignarPeluquero(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-zinc-200 px-3 py-2 text-sm font-semibold text-ink outline-none focus:border-teal disabled:opacity-50"
                >
                  <option value="">Sin asignar</option>
                  {cierre.peluqueros.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.nombre}
                    </option>
                  ))}
                </select>
              ) : (
                <p className="mt-1 text-sm font-semibold text-ink">
                  {/* Sin id = sin asignar. Con id pero sin nombre = asignada a
                      alguien cuyo perfil esta sesión no puede leer; decirlo
                      así, y no "Sin asignar", que sería falso. */}
                  {cierre.peluqueroId === null
                    ? "Sin asignar"
                    : (cierre.peluqueroNombre ?? "Asignada (nombre no visible desde esta cuenta)")}
                  <span className="ml-2 text-xs font-semibold text-ink-soft">
                    (la asigna el administrador)
                  </span>
                </p>
              )}
              {cierre.puedeAsignar && cierre.peluqueros.length === 0 && (
                <p className="mt-1 text-xs font-semibold text-ink-soft">
                  No hay nadie marcado como peluquero todavía. Márquelo en Usuarios.
                </p>
              )}
              {asignando && (
                <p className="mt-1 text-xs font-semibold text-ink-soft">Asignando…</p>
              )}
            </div>

            {cierreError && (
              <p role="alert" className="mt-2 text-xs font-semibold text-[#7a1030]">
                {cierreError}
              </p>
            )}
          </section>
        )}

        {/* Notas del equipo sobre esta cita */}
        <section className="mb-4 rounded-2xl border border-zinc-100 p-4">
          <h3 className="mb-2 text-xs font-extrabold uppercase tracking-wide text-teal-dark">
            Notas del equipo
          </h3>
          <textarea
            value={notas}
            onChange={(e) => { setNotas(e.target.value); setNotasEstado("idle"); }}
            rows={3}
            maxLength={2000}
            placeholder="Detalles del servicio, tips para la próxima visita…"
            className="w-full rounded-xl border border-zinc-200 px-3 py-2 text-sm text-ink outline-none focus:border-teal"
          />
          <div className="mt-2 flex items-center justify-between">
            <span className="text-xs font-semibold text-ink-soft">
              {notasEstado === "ok" && "✓ Guardada"}
              {notasEstado === "error" && "No se pudo guardar"}
            </span>
            <button
              type="button"
              disabled={pending || notasEstado === "guardando"}
              onClick={guardarNotas}
              className="rounded-full border-2 border-teal px-4 py-1.5 text-xs font-extrabold text-teal-dark transition-colors hover:bg-sky/40 disabled:opacity-50"
            >
              {notasEstado === "guardando" ? "Guardando…" : "Guardar nota"}
            </button>
          </div>
        </section>

        {error && (
          <p className="mb-3 rounded-xl bg-red-50 px-4 py-2 text-sm font-semibold text-red-700">
            {error}
          </p>
        )}

        {/* Acciones según estado */}
        <div className="mt-auto space-y-3">
          {cita.estado === "pendiente" && (
            <>
              <div className="flex gap-3">
                <label className="flex-1 text-xs font-bold text-ink-soft">
                  Hora
                  <input
                    type="time"
                    value={hora}
                    min="09:00"
                    max="19:00"
                    onChange={(e) => setHora(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-zinc-200 px-3 py-2 text-sm font-semibold text-ink"
                  />
                </label>
                <label className="flex-1 text-xs font-bold text-ink-soft">
                  Duración (h)
                  <select
                    value={duracion}
                    onChange={(e) => setDuracion(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-zinc-200 px-3 py-2 text-sm font-semibold text-ink"
                  >
                    {["0.5", "1", "1.5", "2", "2.5", "3"].map((d) => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                </label>
              </div>
              <button
                type="button"
                disabled={pending}
                onClick={() => accion("confirmada")}
                className="w-full rounded-full bg-teal px-5 py-3 font-display text-sm font-extrabold text-white transition-colors hover:bg-teal-dark disabled:opacity-50"
              >
                {pending ? "Guardando…" : "Confirmar cita"}
              </button>
            </>
          )}
          {cita.estado === "confirmada" && (
            <button
              type="button"
              disabled={pending}
              onClick={() => accion("en_proceso")}
              className="w-full rounded-full bg-teal px-5 py-3 font-display text-sm font-extrabold text-white transition-colors hover:bg-teal-dark disabled:opacity-50"
            >
              Marcar en proceso
            </button>
          )}
          {/* Aviso al cliente. Aparece cuando el trabajo ya está en marcha o
              terminado — antes de eso no hay nada que avisar. Sirve para los
              dos roles: el peluquero avisa sin ver el contacto, y así no
              depende de que el admin esté disponible. */}
          {["en_proceso", "completada"].includes(cita.estado) && (
            <div>
              <button
                type="button"
                disabled={pending || aviso === "enviando" || aviso === "enviado"}
                onClick={avisarListo}
                className="w-full rounded-full border-2 border-teal px-5 py-3 font-display text-sm font-extrabold text-teal-dark transition-colors hover:bg-sky/40 disabled:opacity-50"
              >
                {aviso === "enviando" && "Enviando aviso…"}
                {aviso === "enviado" && "✓ Aviso enviado al cliente"}
                {(aviso === "idle" || aviso === "error") && "Avisar que está listo 🐾"}
              </button>
              {aviso === "error" && (
                <p role="alert" className="mt-2 text-xs font-semibold text-[#7a1030]">
                  {avisoError}
                </p>
              )}
              {aviso === "enviado" && (
                <p className="mt-2 text-xs font-semibold text-ink-soft">
                  {avisadoEn
                    ? /* Con la hora, quien retoma una cita ajena sabe si el
                         aviso salió recién o hace rato. Sin punto final: el
                         formato es-CL ya termina en "p. m.". */
                      `Avisado el ${new Date(avisadoEn).toLocaleString("es-CL", {
                        timeZone: "America/Santiago",
                      })}`
                    : "Le llegó un correo avisando que puede pasar a buscarlo."}
                </p>
              )}
            </div>
          )}

          {/* Registrar el cobro tiene que ser parte de cerrar la cita, no un
              trámite aparte que nadie hace. Se avisa acá, pegado al botón —
              pero no se bloquea: a veces se cobra después, y un candado haría
              que la cita quede abierta en vez de que el monto quede escrito. */}
          {cierre && cierre.precioCobrado === null &&
            ["en_proceso", "completada"].includes(cita.estado) && (
            <p className="rounded-xl bg-cream px-4 py-2 text-xs font-bold leading-relaxed text-ink">
              Falta registrar lo que se cobró. Sin ese dato, los ingresos del
              panel salen del precio estimado y no de la plata real.
            </p>
          )}

          {cita.estado === "en_proceso" && (
            <button
              type="button"
              disabled={pending}
              onClick={() => accion("completada")}
              className="w-full rounded-full bg-teal px-5 py-3 font-display text-sm font-extrabold text-white transition-colors hover:bg-teal-dark disabled:opacity-50"
            >
              Marcar completada
            </button>
          )}
          {["pendiente", "confirmada", "en_proceso"].includes(cita.estado) && (
            <button
              type="button"
              disabled={pending}
              onClick={() => accion("cancelada")}
              className="w-full rounded-full border-2 border-red-200 px-5 py-3 font-display text-sm font-extrabold text-red-600 transition-colors hover:bg-red-50 disabled:opacity-50"
            >
              Rechazar / cancelar
            </button>
          )}
        </div>
      </aside>
    </>
  );
}
