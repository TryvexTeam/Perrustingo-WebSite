"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { subirFotoResultado } from "@/lib/fotos";
import { registrarFotoResultado } from "@/app/dashboard/citas/fotos-actions";

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
  url: string;
  notas: string | null;
  subida_por: string | null;
  created_at: string | null;
}

interface FotosCitaProps {
  sesionId: string;
  /** Una cita ya atendida sin foto del resultado es la que hay que reclamar. */
  estado: string;
}

const ETIQUETA: Record<string, string> = {
  antes: "📷 Al llegar",
  durante: "📷 Durante",
  despues: "✨ Resultado",
  referencia: "✂️ Corte deseado",
};

export function FotosCita({ sesionId, estado }: FotosCitaProps) {
  const [fotos, setFotos] = useState<FotoSesion[]>([]);
  const [subiendo, setSubiendo] = useState(false);
  const [error, setError] = useState("");
  const entrada = useRef<HTMLInputElement>(null);

  const cargar = useCallback(async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from("fotos_sesion")
      .select("id, tipo, url, notas, subida_por, created_at")
      .eq("sesion_id", sesionId)
      .order("created_at", { ascending: true });
    setFotos((data as FotoSesion[]) ?? []);
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
    const { url, error: errSubida } = await subirFotoResultado(supabase, user.id, sesionId, file);
    if (!url) {
      setSubiendo(false);
      setError(errSubida ?? "No se pudo subir la foto.");
      return;
    }

    const registro = await registrarFotoResultado(sesionId, url);
    setSubiendo(false);
    if (entrada.current) entrada.current.value = "";

    if (!registro.success) {
      setError(registro.error ?? "La foto se subió pero no quedó registrada.");
      return;
    }
    await cargar();
  };

  const delCliente = fotos.filter((f) => f.tipo !== "despues");
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
            {delCliente.map((f) => (
              <a key={f.id} href={f.url} target="_blank" rel="noopener noreferrer">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={f.url}
                  alt={ETIQUETA[f.tipo] ?? f.tipo}
                  width={200}
                  height={112}
                  className="h-28 w-full rounded-xl object-cover"
                />
                <span className="mt-1 block text-[11px] font-bold text-ink-soft">
                  {ETIQUETA[f.tipo] ?? f.tipo}
                </span>
              </a>
            ))}
          </div>
        </>
      )}

      <p className="mb-2 text-[11px] font-bold text-ink-soft">Después</p>

      {resultado.length > 0 ? (
        <div className="mb-3 grid grid-cols-2 gap-2">
          {resultado.map((f) => (
            <a key={f.id} href={f.url} target="_blank" rel="noopener noreferrer">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={f.url}
                alt="Resultado del servicio"
                width={200}
                height={112}
                className="h-28 w-full rounded-xl object-cover"
              />
              <span className="mt-1 block text-[11px] font-bold text-ink-soft">
                ✨ Resultado
                {f.created_at &&
                  ` · ${new Date(f.created_at).toLocaleDateString("es-CL", {
                    day: "numeric",
                    month: "short",
                  })}`}
              </span>
            </a>
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

      {error && (
        <p
          role="alert"
          className="mb-3 rounded-xl bg-[#fbdbe7] px-3 py-2 text-xs font-semibold text-[#7a1030]"
        >
          {error}
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
          : resultado.length > 0
            ? "Agregar otra foto del resultado"
            : "📸 Subir foto del resultado"}
      </label>
    </section>
  );
}
