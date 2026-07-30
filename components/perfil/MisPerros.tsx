"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PELO_LABELS, RAZAS } from "@/lib/reserva";
import {
  crearPerroAction,
  eliminarPerroAction,
  guardarPerroAction,
  type FichaPerro,
} from "@/app/perfil/actions";

/* Los perros de la cuenta, ahora administrables (pedido del señor Adley,
   30-jul): editar la ficha, eliminarla o agregar uno nuevo. Importa porque
   la reserva reutiliza estos datos — un peso viejo cotiza mal.

   El estado local refleja al instante y `router.refresh()` trae la verdad
   del servidor después de cada acción, igual que el resto del panel. */

export interface PerroPerfil {
  id: string;
  nombre: string;
  raza: string | null;
  peso_kg: number | null;
  contextura: "delgado" | "normal" | "robusto" | null;
  tipo_pelo: string | null;
  temperamento: "se_deja" | "no_se_deja" | "complicado" | "no_lo_se" | null;
  alergias: string | null;
}

const TEMPERAMENTO_LABEL: Record<string, string> = {
  se_deja: "Se deja atender",
  no_se_deja: "No se deja con algunas cosas",
  complicado: "Complicado o bravo",
  no_lo_se: "No lo sé todavía",
};

const FICHA_VACIA: FichaPerro = {
  nombre: "",
  raza: null,
  pesoKg: null,
  contextura: null,
  tipoPelo: null,
  temperamento: null,
  alergias: null,
};

function aFicha(p: PerroPerfil): FichaPerro {
  return {
    nombre: p.nombre,
    raza: p.raza,
    pesoKg: p.peso_kg,
    contextura: p.contextura,
    tipoPelo: p.tipo_pelo,
    temperamento: p.temperamento,
    alergias: p.alergias,
  };
}

export function MisPerros({ perros }: { perros: PerroPerfil[] }) {
  const router = useRouter();
  const [editando, setEditando] = useState<string | null>(null);
  const [agregando, setAgregando] = useState(false);
  const [confirmandoBorrado, setConfirmandoBorrado] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState("");
  const [aviso, setAviso] = useState("");

  const cerrarTodo = () => {
    setEditando(null);
    setAgregando(false);
    setConfirmandoBorrado(null);
  };

  const guardar = async (perroId: string | null, ficha: FichaPerro) => {
    setError("");
    setAviso("");
    setOcupado(true);
    const resultado = perroId
      ? await guardarPerroAction(perroId, ficha)
      : await crearPerroAction(ficha);
    setOcupado(false);

    if (!resultado.success) {
      setError(resultado.error ?? "No se pudo guardar.");
      return;
    }
    cerrarTodo();
    setAviso(perroId ? "Ficha actualizada." : `${ficha.nombre.trim()} quedó en tu cuenta.`);
    router.refresh();
  };

  const eliminar = async (perro: PerroPerfil) => {
    setError("");
    setAviso("");
    setOcupado(true);
    const resultado = await eliminarPerroAction(perro.id);
    setOcupado(false);
    setConfirmandoBorrado(null);

    if (!resultado.success) {
      setError(resultado.error ?? "No se pudo eliminar.");
      return;
    }
    setAviso(`${perro.nombre} ya no está en tu cuenta. Sus citas pasadas quedan en el historial.`);
    router.refresh();
  };

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

      {perros.length === 0 && !agregando && (
        <p className="text-sm text-ink-soft">
          Aún no tienes perros guardados.{" "}
          <a href="/reserva" className="font-semibold text-teal-dark underline underline-offset-2">
            Agenda tu primera cita →
          </a>
        </p>
      )}

      <div className="space-y-2">
        {perros.map((p) => (
          <div key={p.id} className="rounded-2xl border border-zinc-100 px-4 py-3">
            <div className="flex items-center gap-3">
              <span className="text-2xl" aria-hidden="true">
                🐶
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-ink">{p.nombre}</p>
                <p className="text-xs text-ink-soft">
                  {[p.raza, p.peso_kg != null ? `${p.peso_kg} kg` : null]
                    .filter(Boolean)
                    .join(" · ") || "Sin datos todavía"}
                </p>
              </div>
              <a href="/reserva" className="text-xs font-bold text-teal-dark hover:underline">
                Agendar cita →
              </a>
              <button
                type="button"
                onClick={() => {
                  cerrarTodo();
                  setEditando(editando === p.id ? null : p.id);
                }}
                disabled={ocupado}
                className="rounded-full bg-cream px-3 py-1.5 text-xs font-bold text-ink transition-colors hover:bg-sky/40 disabled:opacity-50"
              >
                {editando === p.id ? "Cerrar" : "Editar"}
              </button>
            </div>

            {editando === p.id && (
              <FormFicha
                inicial={aFicha(p)}
                ocupado={ocupado}
                onGuardar={(ficha) => guardar(p.id, ficha)}
                onCancelar={cerrarTodo}
              />
            )}

            {editando === p.id && (
              <div className="mt-3 border-t border-ink/10 pt-3">
                {confirmandoBorrado === p.id ? (
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-xs font-semibold text-[#7a1030]">
                      Se quita a {p.nombre} de tu cuenta. Sus citas pasadas
                      quedan en el historial. Esto no se puede deshacer.
                    </p>
                    <button
                      type="button"
                      onClick={() => eliminar(p)}
                      disabled={ocupado}
                      className="rounded-full bg-[#7a1030] px-4 py-2 text-xs font-bold text-white hover:opacity-90 disabled:opacity-50"
                    >
                      Sí, eliminar a {p.nombre}
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmandoBorrado(null)}
                      disabled={ocupado}
                      className="rounded-full bg-cream px-4 py-2 text-xs font-bold text-ink-soft"
                    >
                      Cancelar
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setConfirmandoBorrado(p.id)}
                    disabled={ocupado}
                    className="text-xs font-bold text-[#7a1030] underline-offset-2 hover:underline disabled:opacity-50"
                  >
                    Eliminar a {p.nombre} de mi cuenta…
                  </button>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="mt-4">
        {agregando ? (
          <div className="rounded-2xl border border-zinc-100 px-4 py-3">
            <p className="font-semibold text-ink">Nuevo perro</p>
            <FormFicha
              inicial={FICHA_VACIA}
              ocupado={ocupado}
              onGuardar={(ficha) => guardar(null, ficha)}
              onCancelar={cerrarTodo}
            />
          </div>
        ) : (
          <button
            type="button"
            onClick={() => {
              cerrarTodo();
              setAgregando(true);
            }}
            disabled={ocupado}
            className="rounded-full border-2 border-teal/40 px-4 py-2 text-xs font-bold text-teal-dark transition-colors hover:border-teal disabled:opacity-50"
          >
            + Agregar un perro
          </button>
        )}
      </div>
    </div>
  );
}

function FormFicha({
  inicial,
  ocupado,
  onGuardar,
  onCancelar,
}: {
  inicial: FichaPerro;
  ocupado: boolean;
  onGuardar: (ficha: FichaPerro) => void;
  onCancelar: () => void;
}) {
  const [ficha, setFicha] = useState<FichaPerro>(inicial);
  const upd = <K extends keyof FichaPerro>(k: K, v: FichaPerro[K]) =>
    setFicha((prev) => ({ ...prev, [k]: v }));

  const campo =
    "w-full rounded-xl border-2 border-transparent bg-cream px-3 py-2 text-sm font-semibold text-ink focus:border-teal focus:outline-none";
  const etiqueta = "mb-1 block text-xs font-bold text-ink-soft";

  return (
    <form
      className="mt-3 grid gap-3 border-t border-ink/10 pt-3 sm:grid-cols-2"
      onSubmit={(e) => {
        e.preventDefault();
        onGuardar(ficha);
      }}
    >
      <div>
        <label htmlFor="perro-nombre" className={etiqueta}>
          Nombre
        </label>
        <input
          id="perro-nombre"
          value={ficha.nombre}
          onChange={(e) => upd("nombre", e.target.value)}
          required
          maxLength={60}
          className={campo}
        />
      </div>
      <div>
        <label htmlFor="perro-raza" className={etiqueta}>
          Raza
        </label>
        <input
          id="perro-raza"
          value={ficha.raza ?? ""}
          onChange={(e) => upd("raza", e.target.value || null)}
          maxLength={60}
          list="perfil-razas"
          className={campo}
        />
        <datalist id="perfil-razas">
          {RAZAS.map((r) => (
            <option key={r} value={r} />
          ))}
        </datalist>
      </div>
      <div>
        <label htmlFor="perro-peso" className={etiqueta}>
          Peso (kg)
        </label>
        <input
          id="perro-peso"
          type="number"
          min={0}
          max={120}
          step={0.1}
          value={ficha.pesoKg ?? ""}
          onChange={(e) => upd("pesoKg", e.target.value === "" ? null : Number(e.target.value))}
          className={campo}
        />
      </div>
      <div>
        <label htmlFor="perro-contextura" className={etiqueta}>
          Contextura
        </label>
        <select
          id="perro-contextura"
          value={ficha.contextura ?? ""}
          onChange={(e) =>
            upd("contextura", (e.target.value || null) as FichaPerro["contextura"])
          }
          className={campo}
        >
          <option value="">Sin indicar</option>
          <option value="delgado">Delgado</option>
          <option value="normal">Normal</option>
          <option value="robusto">Robusto</option>
        </select>
      </div>
      <div>
        <label htmlFor="perro-pelo" className={etiqueta}>
          Tipo de pelo
        </label>
        <select
          id="perro-pelo"
          value={ficha.tipoPelo ?? ""}
          onChange={(e) => upd("tipoPelo", e.target.value || null)}
          className={campo}
        >
          <option value="">Sin indicar</option>
          {Object.entries(PELO_LABELS).map(([valor, texto]) => (
            <option key={valor} value={valor}>
              {texto}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor="perro-temperamento" className={etiqueta}>
          Temperamento
        </label>
        <select
          id="perro-temperamento"
          value={ficha.temperamento ?? ""}
          onChange={(e) =>
            upd("temperamento", (e.target.value || null) as FichaPerro["temperamento"])
          }
          className={campo}
        >
          <option value="">Sin indicar</option>
          {Object.entries(TEMPERAMENTO_LABEL).map(([valor, texto]) => (
            <option key={valor} value={valor}>
              {texto}
            </option>
          ))}
        </select>
      </div>
      <div className="sm:col-span-2">
        <label htmlFor="perro-alergias" className={etiqueta}>
          Alergias o condiciones (opcional)
        </label>
        <input
          id="perro-alergias"
          value={ficha.alergias ?? ""}
          onChange={(e) => upd("alergias", e.target.value || null)}
          maxLength={200}
          placeholder="Ej: alergia al pollo, piel sensible…"
          className={campo}
        />
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
          onClick={onCancelar}
          disabled={ocupado}
          className="rounded-full bg-cream px-5 py-2 text-sm font-bold text-ink-soft"
        >
          Cancelar
        </button>
      </div>
    </form>
  );
}
