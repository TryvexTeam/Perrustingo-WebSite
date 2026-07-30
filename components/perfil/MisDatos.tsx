"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { COMUNAS } from "@/lib/contacto";
import type { DatosEditables } from "@/lib/usuarios";
import { actualizarMisDatosAction } from "@/app/perfil/actions";

/* Datos de contacto de la propia cuenta (30-jul). El formulario de reserva
   toma el contacto de acá: un teléfono viejo era imposible de corregir sin
   escribirle al salón. */

export function MisDatos({
  inicial,
  email,
}: {
  inicial: DatosEditables;
  email: string;
}) {
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  const [datos, setDatos] = useState<DatosEditables>(inicial);
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState("");
  const [aviso, setAviso] = useState("");

  const upd = <K extends keyof DatosEditables>(k: K, v: string) =>
    setDatos((prev) => ({ ...prev, [k]: v }));

  const guardar = async () => {
    setError("");
    setAviso("");
    setOcupado(true);
    const resultado = await actualizarMisDatosAction(datos);
    setOcupado(false);

    if (!resultado.success) {
      setError(resultado.error ?? "No se pudo guardar.");
      return;
    }
    setAbierto(false);
    setAviso("Datos actualizados. Tus próximas reservas usarán estos datos.");
    router.refresh();
  };

  const campo =
    "w-full rounded-xl border-2 border-transparent bg-cream px-3 py-2 text-sm font-semibold text-ink focus:border-teal focus:outline-none";
  const etiqueta = "mb-1 block text-xs font-bold text-ink-soft";

  return (
    <div>
      {error && (
        <p role="alert" className="mb-3 text-xs font-semibold text-[#7a1030]">
          ⚠️ {error}
        </p>
      )}
      {aviso && !error && (
        <p role="status" className="mb-3 text-xs font-bold text-teal-dark">
          ✓ {aviso}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-0 flex-1 text-sm text-ink-soft">
          <p className="truncate">
            {email}
            {inicial.telefono && ` · ${inicial.telefono}`}
            {inicial.comuna && ` · ${inicial.comuna}`}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setAbierto((v) => !v)}
          disabled={ocupado}
          className="rounded-full bg-cream px-4 py-2 text-xs font-bold text-ink transition-colors hover:bg-sky/40 disabled:opacity-50"
        >
          {abierto ? "Cerrar" : "Editar mis datos"}
        </button>
      </div>

      {abierto && (
        <form
          className="mt-4 grid gap-3 border-t border-ink/10 pt-4 sm:grid-cols-2"
          onSubmit={(e) => {
            e.preventDefault();
            void guardar();
          }}
        >
          <div>
            <label htmlFor="mis-nombre" className={etiqueta}>
              Nombre
            </label>
            <input
              id="mis-nombre"
              value={datos.nombre}
              onChange={(e) => upd("nombre", e.target.value)}
              required
              maxLength={80}
              className={campo}
            />
          </div>
          <div>
            <label htmlFor="mis-apellido" className={etiqueta}>
              Apellido (opcional)
            </label>
            <input
              id="mis-apellido"
              value={datos.apellido}
              onChange={(e) => upd("apellido", e.target.value)}
              maxLength={80}
              className={campo}
            />
          </div>
          <div>
            <label htmlFor="mis-telefono" className={etiqueta}>
              Teléfono
            </label>
            <input
              id="mis-telefono"
              type="tel"
              value={datos.telefono}
              onChange={(e) => upd("telefono", e.target.value)}
              placeholder="+56 9 1234 5678"
              className={campo}
            />
            <p className="mt-1 text-[11px] text-ink-soft">
              A este número te contactamos para confirmar tus citas.
            </p>
          </div>
          <div>
            <label htmlFor="mis-comuna" className={etiqueta}>
              Comuna
            </label>
            <input
              id="mis-comuna"
              value={datos.comuna}
              onChange={(e) => upd("comuna", e.target.value)}
              maxLength={60}
              list="mis-comunas"
              className={campo}
            />
            <datalist id="mis-comunas">
              {COMUNAS.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </div>
          <div className="flex gap-2 sm:col-span-2">
            <button
              type="submit"
              disabled={ocupado}
              className="rounded-full bg-teal px-5 py-2 text-sm font-extrabold text-white transition-transform active:scale-95 disabled:opacity-50"
            >
              {ocupado ? "Guardando…" : "Guardar"}
            </button>
            <button
              type="button"
              onClick={() => {
                setDatos(inicial);
                setAbierto(false);
              }}
              disabled={ocupado}
              className="rounded-full bg-cream px-5 py-2 text-sm font-bold text-ink-soft"
            >
              Cancelar
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
