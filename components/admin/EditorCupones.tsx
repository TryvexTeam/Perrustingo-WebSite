"use client";

import { useState } from "react";
import {
  condicionesLegibles,
  servicioReconocido,
  validarCupon,
  type Cupon,
} from "@/lib/cupones";
import { SERVICIOS } from "@/lib/reserva";
import {
  alternarCuponAction,
  crearCuponAction,
  guardarCuponAction,
} from "@/app/dashboard/cupones/actions";

/* Editor de cupones. La migración 035 agregó las 9 condiciones y lib/cupones.ts
   la regla que las lee, pero no había ninguna pantalla: el dueño tenía que
   escribir SQL para crear "20% reservando con 7 días de anticipación". Acá esa
   misma regla se configura en palabras.

   La validación es la del dominio (`validarCupon`), la misma que corre el
   servidor. Se ejecuta antes de guardar para que el dueño vea TODOS los
   problemas de una vez, no de a uno por viaje a la base. */

interface EditorCuponesProps {
  cuponesIniciales: Cupon[];
}

function cuponNuevo(): Cupon {
  return {
    codigo: "",
    descripcion: "",
    descuentoPct: 10,
    // Nace apagado a propósito: un cupón que se activa solo, con el código en
    // blanco y las condiciones sin revisar, es plata regalada sin que nadie lo
    // haya decidido.
    activo: false,
    vigenteDesde: null,
    vigenteHasta: null,
    maxUsos: null,
    usos: 0,
    diasAnticipacionMin: null,
    desdeVisita: null,
    hastaVisita: null,
    soloConCuenta: false,
    servicioSlug: null,
  };
}

/** Lee un campo numérico opcional: vacío significa "sin condición", no cero. */
function numeroOpcional(valor: string): number | null {
  if (valor.trim() === "") return null;
  const n = Number.parseInt(valor, 10);
  return Number.isFinite(n) ? n : null;
}

const ETIQUETA_CAMPO =
  "block text-[11px] font-extrabold uppercase tracking-wider text-ink-soft";
const AYUDA = "mt-1.5 text-[11px] leading-relaxed text-ink-soft";
const CAMPO =
  "mt-1 w-full rounded-xl border-2 border-white bg-white px-3 py-2 text-sm font-semibold text-ink focus:border-teal focus:outline-none disabled:opacity-50";

export function EditorCupones({ cuponesIniciales }: EditorCuponesProps) {
  const [cupones, setCupones] = useState<Cupon[]>(cuponesIniciales);
  /* Los cupones nuevos todavía no tienen fila en la base. Se siguen por una
     clave temporal porque el código —su clave real— puede estar vacío o
     repetido mientras el dueño lo escribe. */
  const [nuevas, setNuevas] = useState<string[]>([]);
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [guardado, setGuardado] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [problemas, setProblemas] = useState<string[]>([]);

  /* Cada cupón se identifica en la lista por su posición: el código puede
     cambiar mientras se escribe uno nuevo, así que no sirve de key estable. */
  const actualizar = (indice: number, cambios: Partial<Cupon>) => {
    setCupones((prev) => prev.map((c, i) => (i === indice ? { ...c, ...cambios } : c)));
    setGuardado(null);
    setError("");
    setProblemas([]);
  };

  const idDe = (indice: number) => `cupon-${indice}`;

  const guardar = async (cupon: Cupon, indice: number) => {
    const esNueva = nuevas.includes(idDe(indice));
    const encontrados = validarCupon(cupon);
    if (encontrados.length > 0) {
      setProblemas(encontrados);
      setError("");
      return;
    }
    setOcupado(idDe(indice));
    setError("");
    setProblemas([]);

    const resultado = esNueva
      ? await crearCuponAction(cupon)
      : await guardarCuponAction(cupon);
    setOcupado(null);

    if (!resultado.success) {
      // Nunca un rechazo mudo: si el servidor devolvió problemas de
      // validación se listan todos; si fue la base, se dice por qué.
      setProblemas(resultado.problemas ?? []);
      setError(resultado.error ?? (resultado.problemas ? "" : "No se pudo guardar."));
      return;
    }

    if (esNueva) {
      setNuevas((prev) => prev.filter((n) => n !== idDe(indice)));
      // El código se guardó en mayúsculas: la lista tiene que mostrar lo
      // mismo que quedó en la base, no lo que se tecleó.
      actualizar(indice, { codigo: cupon.codigo.trim().toUpperCase() });
    }
    setGuardado(idDe(indice));
  };

  const alternar = async (cupon: Cupon, indice: number) => {
    if (nuevas.includes(idDe(indice))) {
      // Todavía no existe en la base: solo se marca la casilla.
      actualizar(indice, { activo: !cupon.activo });
      return;
    }
    setOcupado(idDe(indice));
    setError("");
    setProblemas([]);
    const resultado = await alternarCuponAction(cupon.codigo, !cupon.activo);
    setOcupado(null);
    if (!resultado.success) {
      setError(resultado.error ?? "No se pudo cambiar el estado.");
      return;
    }
    actualizar(indice, { activo: !cupon.activo });
  };

  const agregar = () => {
    setCupones((prev) => [...prev, cuponNuevo()]);
    setNuevas((prev) => [...prev, idDe(cupones.length)]);
    setGuardado(null);
    setError("");
    setProblemas([]);
  };

  const quitarSinGuardar = (indice: number) => {
    setCupones((prev) => prev.filter((_, i) => i !== indice));
    setNuevas((prev) => prev.filter((n) => n !== idDe(indice)));
  };

  return (
    <div className="space-y-5">
      {error && (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-2xl bg-[#fbdbe7] px-4 py-3 text-xs font-semibold text-[#7a1030]"
        >
          <span aria-hidden="true">⚠️</span>
          {error}
        </div>
      )}

      {problemas.length > 0 && (
        <div
          role="alert"
          className="rounded-2xl bg-[#fbdbe7] px-4 py-3 text-xs font-semibold text-[#7a1030]"
        >
          <p className="font-extrabold">Revise esto antes de guardar:</p>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            {problemas.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
        </div>
      )}

      {cupones.length === 0 && (
        <div className="rounded-3xl bg-white p-10 text-center shadow-sm">
          <p className="font-display text-lg font-extrabold text-ink">
            No hay ningún cupón creado
          </p>
          <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-ink-soft">
            Cree uno para premiar a quien reserve con tiempo o a quien vuelva
            por segunda vez.
          </p>
        </div>
      )}

      {cupones.map((cupon, indice) => {
        const id = idDe(indice);
        const esNueva = nuevas.includes(id);
        const trabajando = ocupado === id;

        return (
          <div key={id} className="rounded-3xl bg-white p-6 shadow-sm">
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={`rounded-full px-3 py-1 text-[11px] font-bold ${
                  cupon.activo ? "bg-[#d5efe2] text-teal-dark" : "bg-zinc-100 text-zinc-500"
                }`}
              >
                {cupon.activo ? "Activo" : "Apagado"}
              </span>
              <span className="rounded-full bg-[#fde4c8] px-3 py-1 text-[11px] font-bold text-[#7a4d10]">
                {cupon.descuentoPct}% de descuento
              </span>
              <span className="text-[11px] font-bold text-ink-soft">
                {cupon.maxUsos === null
                  ? `${cupon.usos} ${cupon.usos === 1 ? "uso" : "usos"} · sin tope`
                  : `${cupon.usos} de ${cupon.maxUsos} usados`}
              </span>
              {esNueva && <span className="text-[11px] font-bold text-orange">sin guardar</span>}
            </div>

            {/* Las condiciones en palabras, tal como las lee el dominio.
                Es la única forma de que el dueño confirme que lo que
                configuró es lo que va a pasar. */}
            <ul className="mt-3 flex flex-wrap gap-2">
              {condicionesLegibles(cupon).map((texto) => (
                <li
                  key={texto}
                  className="rounded-full bg-cream px-3 py-1 text-[11px] font-semibold text-ink-soft"
                >
                  {texto}
                </li>
              ))}
            </ul>

            <div className="mt-5 grid gap-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label htmlFor={`codigo-${id}`} className={ETIQUETA_CAMPO}>
                    Código
                  </label>
                  <input
                    id={`codigo-${id}`}
                    type="text"
                    value={cupon.codigo}
                    onChange={(e) => actualizar(indice, { codigo: e.target.value })}
                    // El código es la clave de la fila y además lo que la
                    // gente ya tiene anotado en el flyer: cambiarlo dejaría
                    // inservible el papel que anda circulando.
                    disabled={trabajando || !esNueva}
                    maxLength={40}
                    className={`${CAMPO} bg-cream uppercase`}
                  />
                  <p className={AYUDA}>
                    {esNueva
                      ? "Sin espacios. Es lo que el cliente escribe al reservar; se guarda en mayúsculas."
                      : "El código no se puede cambiar. Si necesita otro, cree un cupón nuevo y apague este."}
                  </p>
                </div>

                <div>
                  <label htmlFor={`descuento-${id}`} className={ETIQUETA_CAMPO}>
                    Descuento (%)
                  </label>
                  <input
                    id={`descuento-${id}`}
                    type="number"
                    min={1}
                    max={50}
                    value={cupon.descuentoPct}
                    onChange={(e) =>
                      actualizar(indice, {
                        descuentoPct: Number.parseInt(e.target.value, 10) || 0,
                      })
                    }
                    disabled={trabajando}
                    className={`${CAMPO} bg-cream`}
                  />
                  <p className={AYUDA}>Entre 1 y 50 por ciento.</p>
                </div>
              </div>

              <div>
                <label htmlFor={`descripcion-${id}`} className={ETIQUETA_CAMPO}>
                  Para qué es este cupón
                </label>
                <textarea
                  id={`descripcion-${id}`}
                  value={cupon.descripcion}
                  onChange={(e) => actualizar(indice, { descripcion: e.target.value })}
                  disabled={trabajando}
                  maxLength={200}
                  rows={2}
                  className={`${CAMPO} bg-cream font-normal`}
                />
                <p className={AYUDA}>
                  Es una nota suya para acordarse de para qué lo creó (el flyer
                  de agosto, la campaña de Instagram).
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl bg-cream px-4 py-3">
                  <label htmlFor={`anticipacion-${id}`} className={ETIQUETA_CAMPO}>
                    Días de anticipación
                  </label>
                  <input
                    id={`anticipacion-${id}`}
                    type="number"
                    min={0}
                    placeholder="sin exigencia"
                    value={cupon.diasAnticipacionMin ?? ""}
                    onChange={(e) =>
                      actualizar(indice, { diasAnticipacionMin: numeroOpcional(e.target.value) })
                    }
                    disabled={trabajando}
                    className={CAMPO}
                  />
                  <p className={AYUDA}>
                    {cupon.diasAnticipacionMin === null
                      ? "Déjelo vacío y el cupón sirve reserve cuando reserve."
                      : `Solo lo recibe quien pida hora con ${cupon.diasAnticipacionMin} ${
                          cupon.diasAnticipacionMin === 1 ? "día" : "días"
                        } de anticipación o más. Si hoy reserva para mañana, no le sirve.`}
                  </p>
                </div>

                <div className="rounded-2xl bg-cream px-4 py-3">
                  <label htmlFor={`maxusos-${id}`} className={ETIQUETA_CAMPO}>
                    Tope de usos
                  </label>
                  <input
                    id={`maxusos-${id}`}
                    type="number"
                    min={1}
                    placeholder="sin tope"
                    value={cupon.maxUsos ?? ""}
                    onChange={(e) => actualizar(indice, { maxUsos: numeroOpcional(e.target.value) })}
                    disabled={trabajando}
                    className={CAMPO}
                  />
                  <p className={AYUDA}>
                    Cuántas veces se puede canjear en total. Vacío = sin límite.
                    Lleva {cupon.usos} {cupon.usos === 1 ? "canje" : "canjes"}.
                  </p>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl bg-cream px-4 py-3">
                  <label htmlFor={`desde-visita-${id}`} className={ETIQUETA_CAMPO}>
                    Desde qué visita
                  </label>
                  <input
                    id={`desde-visita-${id}`}
                    type="number"
                    min={1}
                    placeholder="cualquiera"
                    value={cupon.desdeVisita ?? ""}
                    onChange={(e) =>
                      actualizar(indice, { desdeVisita: numeroOpcional(e.target.value) })
                    }
                    disabled={trabajando}
                    className={CAMPO}
                  />
                  <p className={AYUDA}>
                    {cupon.desdeVisita === null
                      ? "Vacío: le sirve a cualquiera, venga por primera vez o sea cliente de siempre."
                      : cupon.desdeVisita === 1
                        ? "La visita 1 es la primera vez que viene, así que esto no filtra a nadie."
                        : `Recién le sirve cuando venga por ${cupon.desdeVisita}ª vez. En sus visitas anteriores no aplica.`}
                  </p>
                </div>

                <div className="rounded-2xl bg-cream px-4 py-3">
                  <label htmlFor={`hasta-visita-${id}`} className={ETIQUETA_CAMPO}>
                    Hasta qué visita
                  </label>
                  <input
                    id={`hasta-visita-${id}`}
                    type="number"
                    min={1}
                    placeholder="sin techo"
                    value={cupon.hastaVisita ?? ""}
                    onChange={(e) =>
                      actualizar(indice, { hastaVisita: numeroOpcional(e.target.value) })
                    }
                    disabled={trabajando}
                    className={CAMPO}
                  />
                  <p className={AYUDA}>
                    {cupon.hastaVisita === null
                      ? "Vacío: le sigue sirviendo todas las veces que vuelva."
                      : cupon.hastaVisita === 1
                        ? "Solo en su primera visita: es un cupón de bienvenida."
                        : `Deja de servirle después de su visita número ${cupon.hastaVisita}.`}
                  </p>
                </div>
              </div>

              {/* Sin cuenta no se puede saber cuántas veces vino alguien:
                  contar por teléfono a cualquiera que lo pida permitiría
                  averiguar quién es cliente del local probando números. Se
                  avisa acá en vez de dejar que el cupón falle en silencio. */}
              {cupon.desdeVisita !== null && cupon.desdeVisita > 1 && !cupon.soloConCuenta && (
                <p className="rounded-2xl bg-[#fde4c8] px-4 py-2.5 text-[11px] leading-relaxed text-[#7a4d10]">
                  ⚠️ Este cupón empieza en la visita {cupon.desdeVisita} pero está
                  abierto a todos. A quien reserve <strong>sin cuenta</strong> no
                  se le puede contar el historial, así que no lo recibirá. Marque
                  &ldquo;solo para clientes con cuenta&rdquo; para que se entienda
                  como beneficio de registrarse.
                </p>
              )}

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl bg-cream px-4 py-3">
                  <label htmlFor={`vdesde-${id}`} className={ETIQUETA_CAMPO}>
                    Empieza a servir (opcional)
                  </label>
                  <input
                    id={`vdesde-${id}`}
                    type="date"
                    value={cupon.vigenteDesde ?? ""}
                    onChange={(e) => actualizar(indice, { vigenteDesde: e.target.value || null })}
                    disabled={trabajando}
                    className={CAMPO}
                  />
                </div>
                <div className="rounded-2xl bg-cream px-4 py-3">
                  <label htmlFor={`vhasta-${id}`} className={ETIQUETA_CAMPO}>
                    Vence (opcional)
                  </label>
                  <input
                    id={`vhasta-${id}`}
                    type="date"
                    value={cupon.vigenteHasta ?? ""}
                    onChange={(e) => actualizar(indice, { vigenteHasta: e.target.value || null })}
                    disabled={trabajando}
                    className={CAMPO}
                  />
                  <p className={AYUDA}>
                    Se mira el día en que el cliente reserva, no el día de la
                    cita.
                  </p>
                </div>
              </div>

              <div className="rounded-2xl bg-cream px-4 py-3">
                <label htmlFor={`servicio-${id}`} className={ETIQUETA_CAMPO}>
                  Solo para un servicio (opcional)
                </label>
                <select
                  id={`servicio-${id}`}
                  value={servicioReconocido(cupon.servicioSlug) ?? (cupon.servicioSlug ?? "")}
                  onChange={(e) => actualizar(indice, { servicioSlug: e.target.value || null })}
                  disabled={trabajando}
                  className={CAMPO}
                >
                  <option value="">Cualquier servicio</option>
                  {SERVICIOS.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                  {/* Un cupón viejo pudo quedar con texto escrito a mano que no
                      corresponde a ninguna opción. Se muestra tal cual para que
                      el dueño VEA que está roto y lo cambie, en vez de que el
                      desplegable lo reemplace en silencio por otra cosa. */}
                  {cupon.servicioSlug && !servicioReconocido(cupon.servicioSlug) && (
                    <option value={cupon.servicioSlug}>
                      {cupon.servicioSlug} — no existe, elija otro
                    </option>
                  )}
                </select>
                <p className={AYUDA}>
                  {cupon.servicioSlug && !servicioReconocido(cupon.servicioSlug)
                    ? "Este servicio no es ninguno de los que el cliente puede elegir al reservar, así que el cupón no se puede canjear. Elija uno de la lista."
                    : "Solo estos son los servicios que el cliente puede elegir al reservar. “Cualquier servicio” = el cupón sirve para todos."}
                </p>
              </div>

              <label className="flex items-center gap-2 text-xs font-bold text-ink-soft">
                <input
                  type="checkbox"
                  checked={cupon.soloConCuenta}
                  onChange={(e) => actualizar(indice, { soloConCuenta: e.target.checked })}
                  disabled={trabajando}
                  className="h-4 w-4 accent-teal-dark"
                />
                Solo para clientes con cuenta
              </label>
            </div>

            <div className="mt-5 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => guardar(cupon, indice)}
                disabled={trabajando}
                className="rounded-full bg-teal px-6 py-2.5 font-display text-sm font-extrabold text-white shadow-[0_3px_0_rgba(6,58,64,.25)] transition-[background-color,transform,box-shadow] duration-150 hover:bg-teal-dark active:translate-y-0.5 active:shadow-[0_1px_0_rgba(6,58,64,.25)] disabled:cursor-not-allowed disabled:opacity-60 disabled:active:translate-y-0"
              >
                {trabajando ? "Guardando…" : esNueva ? "Crear cupón" : "Guardar"}
              </button>
              {guardado === id && !trabajando && (
                <span className="text-sm font-bold text-teal-dark">✓ Guardado</span>
              )}

              <button
                type="button"
                onClick={() => alternar(cupon, indice)}
                disabled={trabajando}
                className="rounded-full border-2 border-ink/15 px-5 py-2 text-xs font-extrabold text-ink transition-colors hover:border-ink/30 disabled:opacity-50"
              >
                {cupon.activo ? "Apagar" : "Activar"}
              </button>

              {esNueva && (
                <button
                  type="button"
                  onClick={() => quitarSinGuardar(indice)}
                  disabled={trabajando}
                  className="ml-auto text-xs font-bold text-ink-soft underline underline-offset-2 hover:text-[#7a1030] disabled:opacity-50"
                >
                  Descartar
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
        + Cupón nuevo
      </button>
    </div>
  );
}
