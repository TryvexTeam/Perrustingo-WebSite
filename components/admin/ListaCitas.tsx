"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { CitaSemana } from "@/lib/agenda";
import { ESTADO_COLOR, ESTADO_LABEL, type EstadoCita } from "@/lib/citas";
import { formatCLP } from "@/lib/reserva";
import { PanelCita } from "@/components/agenda/PanelCita";
import { eliminarCitasEnBloque } from "@/app/dashboard/citas/actions";

interface ListaCitasProps {
  citas: CitaSemana[];
  /** Cita que debe abrirse sola al entrar, si la URL trae `?cita=<id>`. */
  citaInicial?: string;
  /** Habilita el modo de borrado. Solo la página lo activa para rol admin;
      la acción del servidor lo vuelve a exigir por su cuenta. */
  esAdmin?: boolean;
}

const FILTROS: (EstadoCita | "todas")[] = [
  "todas",
  "pendiente",
  "confirmada",
  "en_proceso",
  "completada",
  "cancelada",
];

/** Lista de citas del equipo con filtro por estado y panel de gestión. */
export function ListaCitas({ citas, citaInicial, esAdmin = false }: ListaCitasProps) {
  const router = useRouter();
  const [filtro, setFiltro] = useState<EstadoCita | "todas">("todas");
  const [citaAbierta, setCitaAbierta] = useState<CitaSemana | null>(null);
  /* Modo borrado (solo admin). En este modo tocar una tarjeta la selecciona
     en vez de abrirla — mezclar ambos gestos en la misma tarjeta era una
     receta para abrir fichas sin querer mientras se marca qué borrar. */
  const [modoBorrado, setModoBorrado] = useState(false);
  const [seleccion, setSeleccion] = useState<Set<string>>(new Set());
  const [confirmando, setConfirmando] = useState(false);
  const [borrando, setBorrando] = useState(false);
  const [avisoBorrado, setAvisoBorrado] = useState("");

  const alternarSeleccion = (id: string) =>
    setSeleccion((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const salirModoBorrado = () => {
    setModoBorrado(false);
    setSeleccion(new Set());
    setConfirmando(false);
  };

  const borrarSeleccion = async () => {
    setBorrando(true);
    setAvisoBorrado("");
    const resultado = await eliminarCitasEnBloque([...seleccion]);
    setBorrando(false);

    if (!resultado.success) {
      setAvisoBorrado(resultado.error ?? "No se pudo borrar.");
      setConfirmando(false);
      return;
    }
    setAvisoBorrado(
      resultado.error ??
        `Se ${resultado.eliminadas === 1 ? "borró 1 cita" : `borraron ${resultado.eliminadas} citas`} del registro.`
    );
    salirModoBorrado();
    /* La lista viene del servidor: refrescar trae la versión sin las
       borradas, en vez de fingirlo filtrando en memoria. */
    router.refresh();
  };

  /* Abrir directo la ficha que pide la URL (PRP-002 F6).

     Sin esto, `/dashboard/citas?cita=<id>` mostraba la lista completa y el
     equipo tenía que buscar a mano — que es lo que hacía el enlace "Ver
     ficha" de la vista de hoy y lo que iba a hacer el enlace del mensaje de
     WhatsApp: prometer una ficha y entregar una lista. */
  useEffect(() => {
    if (!citaInicial) return;
    const encontrada = citas.find((c) => c.sesion?.id === citaInicial);
    if (encontrada) setCitaAbierta(encontrada);
    // Solo al entrar: si el equipo cierra el panel, no debe reabrirse solo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [citaInicial]);

  const visibles =
    filtro === "todas" ? citas : citas.filter((c) => c.estado === filtro);

  const borrables = new Set(
    citas
      .filter((c) => ["cancelada", "completada"].includes(c.estado) && c.sesion?.id)
      .map((c) => c.sesion!.id)
  );

  return (
    <>
      <div className="mb-5 flex flex-wrap gap-2">
        {FILTROS.map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFiltro(f)}
            className={`rounded-full px-4 py-1.5 text-sm font-bold transition-colors ${
              filtro === f
                ? "bg-teal text-white"
                : "border-2 border-ink/10 text-ink-soft hover:border-teal/40"
            }`}
          >
            {f === "todas" ? "Todas" : ESTADO_LABEL[f]}
            {f !== "todas" && (
              <span className="ml-1.5 opacity-70">
                {citas.filter((c) => c.estado === f).length}
              </span>
            )}
          </button>
        ))}

        {esAdmin && borrables.size > 0 && !modoBorrado && (
          <button
            type="button"
            onClick={() => setModoBorrado(true)}
            className="ml-auto rounded-full border-2 border-[#7a1030]/30 px-4 py-1.5 text-sm font-bold text-[#7a1030] transition-colors hover:border-[#7a1030]"
          >
            Borrar citas…
          </button>
        )}
      </div>

      {avisoBorrado && (
        <p role="status" className="mb-4 text-sm font-bold text-teal-dark">
          {avisoBorrado}
        </p>
      )}

      {modoBorrado && (
        <div className="mb-4 rounded-2xl bg-[#fbeff3] px-4 py-3">
          <p className="text-xs font-semibold text-[#7a1030]">
            Toque las citas canceladas o completadas que quiera borrar del
            registro. Las pendientes y confirmadas no se pueden borrar — hay
            que cancelarlas primero, una por una.
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {confirmando ? (
              <>
                <span className="text-xs font-bold text-[#7a1030]">
                  Se borran {seleccion.size} {seleccion.size === 1 ? "cita" : "citas"} con sus
                  fotos. No se puede deshacer.
                </span>
                <button
                  type="button"
                  onClick={borrarSeleccion}
                  disabled={borrando}
                  className="rounded-full bg-[#7a1030] px-4 py-2 text-xs font-bold text-white hover:opacity-90 disabled:opacity-50"
                >
                  {borrando ? "Borrando…" : "Sí, borrar definitivamente"}
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmando(false)}
                  disabled={borrando}
                  className="rounded-full bg-white px-4 py-2 text-xs font-bold text-ink-soft"
                >
                  Volver
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => setConfirmando(true)}
                  disabled={seleccion.size === 0}
                  className="rounded-full bg-[#7a1030] px-4 py-2 text-xs font-bold text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Borrar {seleccion.size > 0 ? `(${seleccion.size})` : ""}
                </button>
                <button
                  type="button"
                  onClick={salirModoBorrado}
                  className="rounded-full bg-white px-4 py-2 text-xs font-bold text-ink-soft"
                >
                  Cancelar
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {visibles.length === 0 ? (
        <p className="rounded-3xl bg-white py-10 text-center text-sm text-ink-soft shadow-sm">
          No hay citas {filtro === "todas" ? "registradas" : `en estado ${ESTADO_LABEL[filtro].toLowerCase()}`}.
        </p>
      ) : (
        <div className="space-y-3">
          {visibles.map((cita) => {
            const idSesion = cita.sesion?.id;
            const esBorrable = Boolean(idSesion && borrables.has(idSesion));
            const marcada = Boolean(idSesion && seleccion.has(idSesion));
            return (
            <button
              key={cita.id}
              type="button"
              onClick={() =>
                modoBorrado
                  ? esBorrable && idSesion && alternarSeleccion(idSesion)
                  : setCitaAbierta(cita)
              }
              aria-pressed={modoBorrado ? marcada : undefined}
              disabled={modoBorrado && !esBorrable}
              className={`flex w-full flex-wrap items-center gap-3 rounded-2xl bg-white p-4 text-left shadow-sm transition-transform hover:-translate-y-0.5 ${
                modoBorrado
                  ? marcada
                    ? "ring-2 ring-[#7a1030]"
                    : esBorrable
                      ? "ring-1 ring-ink/10"
                      : "opacity-40"
                  : ""
              }`}
            >
              {modoBorrado && esBorrable && (
                <span
                  aria-hidden="true"
                  className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md border-2 text-xs font-bold ${
                    marcada ? "border-[#7a1030] bg-[#7a1030] text-white" : "border-ink/20 bg-white"
                  }`}
                >
                  {marcada ? "✓" : ""}
                </span>
              )}
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-ink">{cita.titulo}</p>
                <p className="mt-0.5 text-xs text-ink-soft">
                  {cita.subtitulo || "Servicio sin definir"} · {cita.fecha}
                </p>
                {cita.sesion?.contacto_nombre && (
                  <p className="mt-0.5 text-xs text-ink-soft">
                    Contacto: {cita.sesion.contacto_nombre}
                  </p>
                )}
              </div>
              <div className="flex flex-col items-end gap-1">
                <span
                  className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${ESTADO_COLOR[cita.estado]}`}
                >
                  {ESTADO_LABEL[cita.estado]}
                </span>
                {cita.sesion?.precio_base != null && (
                  <span className="text-xs font-semibold text-teal-dark">
                    {formatCLP(cita.sesion.precio_base)}
                  </span>
                )}
              </div>
            </button>
            );
          })}
        </div>
      )}

      {citaAbierta && (
        <PanelCita cita={citaAbierta} onCerrar={() => setCitaAbierta(null)} />
      )}
    </>
  );
}
