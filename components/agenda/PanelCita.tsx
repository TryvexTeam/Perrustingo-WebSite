"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { CitaSemana } from "@/lib/agenda";
import { ESTADO_COLOR, ESTADO_LABEL, type FotoSesion } from "@/lib/citas";
import { formatCLP } from "@/lib/reserva";
import { cambiarEstadoCita, guardarNotasEquipo } from "@/app/dashboard/citas/actions";
import { createClient } from "@/lib/supabase/client";

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
  const [fotos, setFotos] = useState<FotoSesion[]>([]);
  const [notas, setNotas] = useState(cita.sesion?.notas_equipo ?? "");
  const [notasEstado, setNotasEstado] = useState<"idle" | "guardando" | "ok" | "error">("idle");
  const [historial, setHistorial] = useState<{ fecha: string; notas: string }[]>([]);

  const sesionId = cita.sesion?.id;
  const perroId = cita.sesion?.perro_id;

  /* Fotos de la cita + notas de visitas anteriores del mismo perrito
     (RLS: solo el equipo llega a este panel). */
  useEffect(() => {
    if (!sesionId) return;
    const supabase = createClient();
    supabase
      .from("fotos_sesion")
      .select("id, tipo, url, notas")
      .eq("sesion_id", sesionId)
      .then(({ data }) => setFotos((data as FotoSesion[]) ?? []));

    if (perroId) {
      supabase
        .from("sesiones")
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

  const sesion = cita.sesion;
  if (!sesion) return null;

  const guardarNotas = () => {
    setNotasEstado("guardando");
    startTransition(async () => {
      const res = await guardarNotasEquipo(sesion.id, notas);
      setNotasEstado(res.success ? "ok" : "error");
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

        {/* Contacto del solicitante */}
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
            Ficha del perro
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

        {/* Fotos que dejó el cliente (actual + referencia del corte) */}
        {fotos.length > 0 && (
          <section className="mb-4 rounded-2xl border border-zinc-100 p-4">
            <h3 className="mb-2 text-xs font-extrabold uppercase tracking-wide text-teal-dark">
              Fotos del cliente
            </h3>
            <div className="grid grid-cols-2 gap-2">
              {fotos.map((f) => (
                <a key={f.id} href={f.url} target="_blank" rel="noopener noreferrer">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={f.url}
                    alt={f.tipo === "referencia" ? "Referencia de corte" : `Foto ${f.tipo}`}
                    className="h-28 w-full rounded-xl object-cover"
                  />
                  <span className="mt-1 block text-[11px] font-bold capitalize text-ink-soft">
                    {f.tipo === "referencia" ? "✂️ Corte deseado" : `📷 ${f.tipo}`}
                  </span>
                </a>
              ))}
            </div>
          </section>
        )}

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
