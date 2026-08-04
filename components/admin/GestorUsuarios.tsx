"use client";

import { useState } from "react";
import {
  ROLES,
  ROL_COLOR,
  ROL_DESCRIPCION,
  ROL_LABEL,
  nombreCompleto,
  validarDatos,
  type DatosEditables,
  type PerfilAdmin,
  type Rol,
} from "@/lib/usuarios";
import {
  actualizarDatosPerfilAction,
  cambiarRolAction,
  marcarPeluqueroAction,
} from "@/app/dashboard/usuarios/actions";

/* Control de usuarios del panel (PRP-001 Fase 1). Antes asignar un rol
   era un UPDATE a mano en el SQL Editor.

   El estado vive acá y no en el servidor porque cada fila se guarda sola
   (no hay un "Guardar todo"): un cambio de rol es una acción puntual con
   consecuencias, no un borrador. Tras cada acción exitosa el server
   action hace revalidatePath, así que la lista del servidor también se
   refresca — el estado local es para que la fila responda al instante. */

interface GestorUsuariosProps {
  perfiles: PerfilAdmin[];
  /** Email por id, resuelto en el servidor (auth.users no es legible con anon). */
  emails: Record<string, string>;
  /** Id del admin en sesión — su propia fila se marca y no puede autodegradarse. */
  adminId: string;
}

type Filtro = "todos" | Rol;

export function GestorUsuarios({ perfiles, emails, adminId }: GestorUsuariosProps) {
  const [filas, setFilas] = useState<PerfilAdmin[]>(perfiles);
  const [filtro, setFiltro] = useState<Filtro>("todos");
  const [busqueda, setBusqueda] = useState("");
  const [editando, setEditando] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [aviso, setAviso] = useState("");

  const aplicar = (id: string, cambios: Partial<PerfilAdmin>) =>
    setFilas((prev) => prev.map((p) => (p.id === id ? { ...p, ...cambios } : p)));

  const visibles = filas.filter((p) => {
    if (filtro !== "todos" && p.rol !== filtro) return false;
    const texto = busqueda.trim().toLowerCase();
    if (texto.length === 0) return true;
    return (
      nombreCompleto(p).toLowerCase().includes(texto) ||
      (emails[p.id] ?? "").toLowerCase().includes(texto) ||
      (p.telefono ?? "").includes(texto)
    );
  });

  const totalAdmins = filas.filter((p) => p.rol === "admin").length;

  const cambiarRol = async (perfil: PerfilAdmin, rol: Rol) => {
    const anterior = perfil.rol;
    setError("");
    setAviso("");
    setOcupado(perfil.id);
    aplicar(perfil.id, { rol });

    const resultado = await cambiarRolAction(perfil.id, rol);
    setOcupado(null);

    if (!resultado.success) {
      aplicar(perfil.id, { rol: anterior }); // revertir el optimismo
      setError(resultado.error ?? "No se pudo cambiar el rol.");
      return;
    }
    setAviso(`${nombreCompleto(perfil)} ahora es ${ROL_LABEL[rol].toLowerCase()}.`);
  };

  const cambiarPeluquero = async (perfil: PerfilAdmin, valor: boolean) => {
    setError("");
    setAviso("");
    setOcupado(perfil.id);
    aplicar(perfil.id, { es_peluquero: valor });

    const resultado = await marcarPeluqueroAction(perfil.id, valor);
    setOcupado(null);

    if (!resultado.success) {
      aplicar(perfil.id, { es_peluquero: !valor });
      setError(resultado.error ?? "No se pudo guardar.");
    }
  };

  const guardarDatos = async (perfil: PerfilAdmin, datos: DatosEditables) => {
    const problema = validarDatos(datos);
    if (problema) {
      setError(problema);
      return;
    }
    setError("");
    setAviso("");
    setOcupado(perfil.id);

    const resultado = await actualizarDatosPerfilAction(perfil.id, datos);
    setOcupado(null);

    if (!resultado.success) {
      setError(resultado.error ?? "No se pudo guardar.");
      return;
    }
    aplicar(perfil.id, {
      nombre: datos.nombre.trim(),
      apellido: datos.apellido.trim() || null,
      telefono: datos.telefono.trim() || null,
      comuna: datos.comuna.trim() || null,
    });
    setEditando(null);
    setAviso("Datos actualizados.");
  };

  return (
    <div className="rounded-3xl bg-white p-7 shadow-sm">
      <div className="mb-5 flex items-center gap-2 rounded-2xl bg-[#d5efe2] px-4 py-3 text-xs font-semibold text-teal-dark">
        <span aria-hidden="true">🔐</span>
        Los cambios de rol se aplican de inmediato y quedan protegidos por la
        base de datos: nadie puede subirse de rol a sí mismo.
      </div>

      {error && (
        <div
          role="alert"
          className="mb-5 flex items-center gap-2 rounded-2xl bg-[#fbdbe7] px-4 py-3 text-xs font-semibold text-[#7a1030]"
        >
          <span aria-hidden="true">⚠️</span>
          {error}
        </div>
      )}
      {aviso && !error && (
        <p role="status" className="mb-5 text-sm font-bold text-teal-dark">
          ✓ {aviso}
        </p>
      )}

      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="font-display text-lg font-extrabold text-ink">
            Personas con cuenta
          </h2>
          <p className="mt-1 text-xs text-ink-soft">
            {filas.length} {filas.length === 1 ? "cuenta" : "cuentas"} · {totalAdmins}{" "}
            {totalAdmins === 1 ? "admin" : "admins"}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <label htmlFor="buscar-usuario" className="sr-only">
            Buscar por nombre, correo o teléfono
          </label>
          <input
            id="buscar-usuario"
            type="search"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar…"
            className="w-44 rounded-xl border-2 border-transparent bg-cream px-3 py-2 text-sm font-semibold text-ink focus:border-teal focus:outline-none"
          />
          <label htmlFor="filtro-rol" className="sr-only">
            Filtrar por rol
          </label>
          <select
            id="filtro-rol"
            value={filtro}
            onChange={(e) => setFiltro(e.target.value as Filtro)}
            className="rounded-xl border-2 border-transparent bg-cream px-3 py-2 text-sm font-semibold text-ink focus:border-teal focus:outline-none"
          >
            <option value="todos">Todos los roles</option>
            {ROLES.map((rol) => (
              <option key={rol} value={rol}>
                {ROL_LABEL[rol]}
              </option>
            ))}
          </select>
        </div>
      </div>

      <ul className="mt-5 space-y-3">
        {visibles.length === 0 && (
          <li className="py-8 text-center text-sm text-ink-soft">
            No hay cuentas que coincidan con la búsqueda.
          </li>
        )}

        {visibles.map((perfil) => {
          const esYo = perfil.id === adminId;
          const bloqueado = ocupado === perfil.id;

          return (
            <li key={perfil.id} className="rounded-2xl bg-cream px-4 py-4">
              <div className="flex flex-wrap items-start gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-ink">{nombreCompleto(perfil)}</span>
                    <span
                      className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${ROL_COLOR[perfil.rol]}`}
                    >
                      {ROL_LABEL[perfil.rol]}
                    </span>
                    {esYo && (
                      <span className="rounded-full bg-white px-2.5 py-1 text-[11px] font-bold text-ink-soft">
                        usted
                      </span>
                    )}
                    {perfil.es_peluquero && (
                      <span className="rounded-full bg-white px-2.5 py-1 text-[11px] font-bold text-teal-dark">
                        ✂️ atiende
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 truncate text-xs text-ink-soft">
                    {emails[perfil.id] ?? "sin correo"}
                    {perfil.telefono && ` · ${perfil.telefono}`}
                    {perfil.comuna && ` · ${perfil.comuna}`}
                  </p>
                </div>

                <div className="ml-auto flex flex-wrap items-center gap-2">
                  <label htmlFor={`rol-${perfil.id}`} className="sr-only">
                    Rol de {nombreCompleto(perfil)}
                  </label>
                  <select
                    id={`rol-${perfil.id}`}
                    value={perfil.rol}
                    onChange={(e) => cambiarRol(perfil, e.target.value as Rol)}
                    disabled={bloqueado || esYo}
                    title={esYo ? "No puede cambiar su propio rol" : ROL_DESCRIPCION[perfil.rol]}
                    className="rounded-xl border-2 border-white bg-white px-3 py-2 text-sm font-bold text-ink focus:border-teal focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {ROLES.map((rol) => (
                      <option key={rol} value={rol}>
                        {ROL_LABEL[rol]}
                      </option>
                    ))}
                  </select>

                  <button
                    type="button"
                    onClick={() => setEditando(editando === perfil.id ? null : perfil.id)}
                    disabled={bloqueado}
                    className="rounded-full bg-white px-4 py-2 text-sm font-bold text-teal-dark transition-colors hover:bg-teal hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {editando === perfil.id ? "Cerrar" : "Editar"}
                  </button>
                </div>
              </div>

              <label className="mt-3 flex items-center gap-2 text-xs font-semibold text-ink-soft">
                <input
                  type="checkbox"
                  checked={perfil.es_peluquero}
                  onChange={(e) => cambiarPeluquero(perfil, e.target.checked)}
                  disabled={bloqueado}
                  className="h-4 w-4 accent-teal-dark"
                />
                Atiende citas (cuenta para los cupos simultáneos de la agenda)
              </label>

              {editando === perfil.id && (
                <FormDatos
                  perfil={perfil}
                  bloqueado={bloqueado}
                  onCancelar={() => setEditando(null)}
                  onGuardar={(datos) => guardarDatos(perfil, datos)}
                />
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

interface FormDatosProps {
  perfil: PerfilAdmin;
  bloqueado: boolean;
  onCancelar: () => void;
  onGuardar: (datos: DatosEditables) => void;
}

function FormDatos({ perfil, bloqueado, onCancelar, onGuardar }: FormDatosProps) {
  const [datos, setDatos] = useState<DatosEditables>({
    nombre: perfil.nombre ?? "",
    apellido: perfil.apellido ?? "",
    telefono: perfil.telefono ?? "",
    comuna: perfil.comuna ?? "",
  });

  const campos: { clave: keyof DatosEditables; etiqueta: string; tipo: string }[] = [
    { clave: "nombre", etiqueta: "Nombre", tipo: "text" },
    { clave: "apellido", etiqueta: "Apellido", tipo: "text" },
    { clave: "telefono", etiqueta: "Teléfono", tipo: "tel" },
    { clave: "comuna", etiqueta: "Comuna", tipo: "text" },
  ];

  return (
    <form
      className="mt-3 rounded-2xl bg-white p-4"
      onSubmit={(e) => {
        e.preventDefault();
        onGuardar(datos);
      }}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        {campos.map((campo) => (
          <div key={campo.clave}>
            <label
              htmlFor={`${campo.clave}-${perfil.id}`}
              className="block text-[11px] font-extrabold uppercase tracking-wider text-ink-soft"
            >
              {campo.etiqueta}
            </label>
            <input
              id={`${campo.clave}-${perfil.id}`}
              type={campo.tipo}
              value={datos[campo.clave]}
              onChange={(e) => setDatos((prev) => ({ ...prev, [campo.clave]: e.target.value }))}
              disabled={bloqueado}
              maxLength={campo.clave === "telefono" ? 20 : 60}
              className="mt-1 w-full rounded-xl border-2 border-transparent bg-cream px-3 py-2 text-sm font-semibold text-ink focus:border-teal focus:outline-none disabled:opacity-50"
            />
          </div>
        ))}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={bloqueado}
          className="rounded-full bg-teal px-6 py-2.5 font-display text-sm font-extrabold text-white shadow-[0_3px_0_rgba(6,58,64,.25)] transition-[background-color,transform,box-shadow] duration-150 hover:bg-teal-dark active:translate-y-0.5 active:shadow-[0_1px_0_rgba(6,58,64,.25)] disabled:cursor-not-allowed disabled:opacity-60 disabled:active:translate-y-0"
        >
          {bloqueado ? "Guardando…" : "Guardar datos"}
        </button>
        <button
          type="button"
          onClick={onCancelar}
          disabled={bloqueado}
          className="text-sm font-bold text-ink-soft underline underline-offset-2 disabled:opacity-50"
        >
          Cancelar
        </button>
      </div>
    </form>
  );
}
