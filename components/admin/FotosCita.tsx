"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { subirFotoResultado, rutaDeFoto, firmarFotos } from "@/lib/fotos";
import { registrarFotoResultado } from "@/app/dashboard/citas/fotos-actions";
import type { TipoFoto } from "@/app/dashboard/citas/fotos-tipos";

/* Las fotos de una cita: lo que trajo el cliente y lo que dejó el equipo
   (PRP-002 F3).

   El "después" es el respaldo del trabajo hecho. Se sube desde acá, en el
   celular, con el perrito todavía en la mesa — por eso el botón es grande y
   abre la cámara directo, sin pasar por la galería.

   Lo que NO hace: bloquear el cierre de la cita. Decisión del señor Ignacio
   (26-jul): en un día cargado, trabar el trabajo del local por una foto es
   peor que quedarse sin ella. Avisa, y avisa fuerte, pero no traba. */

interface FotoSesion {
  id: string;
  tipo: string;
  /** Ruta dentro del bucket privado (lo normal desde PRP-002 F4). */
  ruta: string | null;
  /** URL pública de las filas viejas — se conserva para no perderlas. */
  url: string | null;
  notas: string | null;
  subida_por: string | null;
  created_at: string | null;
}

interface FotosCitaProps {
  sesionId: string;
  /** Una cita ya atendida sin foto del resultado es la que hay que reclamar. */
  estado: string;
}

/* Una miniatura que sabe qué hacer cuando el enlace todavía no llegó o no se
   pudo firmar: mostrar un hueco honesto en vez de un ícono de imagen rota. */
function Miniatura({ enlace, alt, pie }: { enlace: string | null; alt: string; pie: string }) {
  if (!enlace) {
    return (
      <div>
        <div className="flex h-28 w-full items-center justify-center rounded-xl bg-cream text-[11px] font-semibold text-ink-soft">
          Cargando…
        </div>
        <span className="mt-1 block text-[11px] font-bold text-ink-soft">{pie}</span>
      </div>
    );
  }
  return (
    <a href={enlace} target="_blank" rel="noopener noreferrer">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={enlace}
        alt={alt}
        width={200}
        height={112}
        className="h-28 w-full rounded-xl object-cover"
      />
      <span className="mt-1 block text-[11px] font-bold text-ink-soft">{pie}</span>
    </a>
  );
}

const ETIQUETA: Record<string, string> = {
  antes: "📷 Al llegar",
  durante: "📷 Durante",
  despues: "✨ Resultado",
  referencia: "✂️ Corte deseado",
  extra: "📷 Otra",
  comprobante: "🧾 Comprobante",
};

/* Lo que el equipo puede subir. Antes solo se podía "Resultado": una foto del
   antes o un detalle a mitad de trabajo no tenían dónde ir. */
const SUBIBLES: { tipo: TipoFoto; label: string }[] = [
  { tipo: "despues", label: "✨ Resultado" },
  { tipo: "antes", label: "📷 Al llegar" },
  { tipo: "durante", label: "📷 Durante" },
  { tipo: "extra", label: "📷 Otra" },
  { tipo: "comprobante", label: "🧾 Comprobante de pago" },
];

export function FotosCita({ sesionId, estado }: FotosCitaProps) {
  const [fotos, setFotos] = useState<FotoSesion[]>([]);
  /* ruta -> enlace firmado. El bucket es privado: sin esto no se ve nada. */
  const [enlaces, setEnlaces] = useState<Record<string, string>>({});
  const [subiendo, setSubiendo] = useState(false);
  const [error, setError] = useState("");
  /* Qué se está subiendo. Se elige ANTES de abrir el explorador: preguntarlo
     después, con el archivo ya elegido, es un paso más para alguien que tiene
     al perrito en la mesa. */
  const [tipoASubir, setTipoASubir] = useState<TipoFoto>("despues");
  const entrada = useRef<HTMLInputElement>(null);

  const cargar = useCallback(async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from("fotos_sesion")
      .select("id, tipo, ruta, url, notas, subida_por, created_at")
      .eq("sesion_id", sesionId)
      .order("created_at", { ascending: true });

    const filas = (data as FotoSesion[]) ?? [];
    setFotos(filas);

    // Un solo viaje para firmar todas: una ficha con seis fotos no puede
    // hacer seis idas y vueltas con el perrito esperando en la mesa.
    const rutas = filas.map((f) => rutaDeFoto(f)).filter(Boolean) as string[];
    setEnlaces(await firmarFotos(supabase, rutas));
  }, [sesionId]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  const alElegir = async (file: File | undefined) => {
    if (!file) return;
    setSubiendo(true);
    setError("");

    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setSubiendo(false);
      setError("Sesión expirada. Vuelva a entrar.");
      return;
    }

    // Primero el archivo a Storage (comprimido), después la fila. Si la fila
    // falla queda un objeto huérfano — molesto, pero preferible al revés:
    // una fila que promete una foto que no existe sí rompe la evidencia.
    const { ruta, error: errSubida } = await subirFotoResultado(supabase, user.id, sesionId, file);
    if (!ruta) {
      setSubiendo(false);
      setError(errSubida ?? "No se pudo subir la foto.");
      return;
    }

    const registro = await registrarFotoResultado(sesionId, ruta, tipoASubir);
    setSubiendo(false);
    if (entrada.current) entrada.current.value = "";

    if (!registro.success) {
      setError(registro.error ?? "La foto se subió pero no quedó registrada.");
      return;
    }
    await cargar();
  };

  /* El enlace firmado de esa foto, si se pudo firmar. */
  const enlaceDe = (f: FotoSesion): string | null => {
    const ruta = rutaDeFoto(f);
    return ruta ? enlaces[ruta] ?? null : null;
  };

  /* El comprobante va aparte de las fotos del perrito: lleva datos de pago y
     no tiene nada que hacer entre el antes y el después. */
  const comprobantes = fotos.filter((f) => f.tipo === "comprobante");
  const delCliente = fotos.filter((f) => f.tipo !== "despues" && f.tipo !== "comprobante");
  const resultado = fotos.filter((f) => f.tipo === "despues");
  const faltaResultado = resultado.length === 0;
  const yaSeAtendio = estado === "completada" || estado === "en_proceso";

  return (
    <section className="mb-4 rounded-2xl border border-zinc-100 p-4">
      <h3 className="mb-3 text-xs font-extrabold uppercase tracking-wide text-teal-dark">
        Fotos de la visita
      </h3>

      {delCliente.length > 0 && (
        <>
          <p className="mb-2 text-[11px] font-bold text-ink-soft">Antes</p>
          <div className="mb-4 grid grid-cols-2 gap-2">
            {delCliente.map((f) => {
              const enlace = enlaceDe(f);
              return (
                <Miniatura
                  key={f.id}
                  enlace={enlace}
                  alt={ETIQUETA[f.tipo] ?? f.tipo}
                  pie={ETIQUETA[f.tipo] ?? f.tipo}
                />
              );
            })}
          </div>
        </>
      )}

      <p className="mb-2 text-[11px] font-bold text-ink-soft">Después</p>

      {resultado.length > 0 ? (
        <div className="mb-3 grid grid-cols-2 gap-2">
          {resultado.map((f) => (
            <Miniatura
              key={f.id}
              enlace={enlaceDe(f)}
              alt="Resultado del servicio"
              pie={`✨ Resultado${
                f.created_at
                  ? ` · ${new Date(f.created_at).toLocaleDateString("es-CL", {
                      day: "numeric",
                      month: "short",
                    })}`
                  : ""
              }`}
            />
          ))}
        </div>
      ) : (
        /* El aviso sube de tono si la cita ya se atendió: antes de eso, que
           falte el "después" es lo normal, no un descuido. */
        <p
          className={`mb-3 rounded-xl px-3 py-2.5 text-xs leading-relaxed ${
            yaSeAtendio
              ? "bg-[#fde4c8] font-semibold text-[#7a4d10]"
              : "bg-cream text-ink-soft"
          }`}
        >
          {yaSeAtendio
            ? "⚠️ Falta la foto del resultado. Es el respaldo del trabajo si después hay un reclamo."
            : "Todavía no hay foto del resultado — se toma al terminar el servicio."}
        </p>
      )}

      {/* Comprobantes de pago — sección propia, con su marca visual, para que
          nadie los confunda con las fotos del perrito ni los mande al cliente
          por error. */}
      {comprobantes.length > 0 && (
        <>
          <p className="mb-2 mt-4 text-[11px] font-bold text-ink-soft">
            🧾 Comprobantes de pago{" "}
            <span className="font-normal">— uso interno, no se le muestran al cliente</span>
          </p>
          <div className="mb-3 grid grid-cols-2 gap-2">
            {comprobantes.map((f) => (
              <Miniatura
                key={f.id}
                enlace={enlaceDe(f)}
                alt="Comprobante de pago"
                pie={`🧾 Comprobante${
                  f.created_at
                    ? ` · ${new Date(f.created_at).toLocaleDateString("es-CL", {
                        day: "numeric",
                        month: "short",
                      })}`
                    : ""
                }`}
              />
            ))}
          </div>
        </>
      )}

      {error && (
        <p
          role="alert"
          className="mb-3 rounded-xl bg-[#fbdbe7] px-3 py-2 text-xs font-semibold text-[#7a1030]"
        >
          {error}
        </p>
      )}

      {/* Qué se va a subir. Se elige ANTES de abrir la cámara: preguntarlo
          después, con la foto ya tomada, es un paso más para alguien que tiene
          al perrito en la mesa. */}
      <label
        htmlFor={`tipo-foto-${sesionId}`}
        className="mb-1.5 block text-[11px] font-bold text-ink-soft"
      >
        Qué vas a subir
      </label>
      <select
        id={`tipo-foto-${sesionId}`}
        value={tipoASubir}
        onChange={(e) => setTipoASubir(e.target.value as TipoFoto)}
        disabled={subiendo}
        className="mb-2 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs font-bold text-ink focus:border-teal focus:outline-none disabled:opacity-50"
      >
        {SUBIBLES.map((s) => (
          <option key={s.tipo} value={s.tipo}>
            {s.label}
          </option>
        ))}
      </select>

      {tipoASubir === "comprobante" && (
        <p className="mb-2 rounded-xl bg-cream px-3 py-2 text-[11px] leading-relaxed text-ink-soft">
          🔒 El comprobante queda para uso interno: no aparece en la galería que
          ve el cliente.
        </p>
      )}

      <input
        ref={entrada}
        type="file"
        accept="image/*"
        // Abre la cámara directo en el celular, que es donde se usa esto.
        // En un computador el navegador lo ignora y ofrece el explorador:
        // no se rompe nada, simplemente no fuerza la cámara.
        capture="environment"
        className="hidden"
        id={`foto-resultado-${sesionId}`}
        onChange={(e) => void alElegir(e.target.files?.[0])}
        disabled={subiendo}
      />
      <label
        htmlFor={`foto-resultado-${sesionId}`}
        className={`block cursor-pointer rounded-full bg-teal px-5 py-2.5 text-center text-xs font-extrabold text-white shadow-[0_2px_0_rgba(6,58,64,.25)] transition-[background-color,transform] duration-150 hover:bg-teal-dark active:translate-y-0.5 ${
          subiendo ? "pointer-events-none opacity-60" : ""
        }`}
      >
        {subiendo
          ? "Subiendo…"
          : `📸 Subir ${SUBIBLES.find((s) => s.tipo === tipoASubir)?.label.replace(/^\S+\s/, "").toLowerCase() ?? "foto"}`}
      </label>
    </section>
  );
}
