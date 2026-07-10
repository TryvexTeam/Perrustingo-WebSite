"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  NOTA_PRECIOS,
  FORM_INITIAL,
  PELO_LABELS,
  SERVICIOS,
  TAMANO_LABELS,
  TamanoKey,
  TipoPelo,
  buildWhatsAppMessage,
  construirDetalle,
  detectarTamanoPorPeso,
  formatCLP,
  hayConflicto,
  type FormData,
} from "@/lib/reserva";
import { CATALOGO_RAZAS, razaImagen, TAMANO_IMAGEN } from "@/lib/razas";
import { useTarifas } from "@/lib/tarifas";
import { BreedAvatar } from "@/components/ui/BreedAvatar";

const WHATSAPP_BASE = "https://wa.me/4915237152283?text=";

/* Wizard progresivo — una pregunta por pantalla, avance automático en
   selecciones únicas y multiselección de chips para las zonas sensibles.
   Menos densidad = menos fatiga visual. */

const AUTO_ADVANCE_MS = 350;

// ─── UI helpers ────────────────────────────────────────────────────────────

function Input({
  id, value, onChange, placeholder, type = "text", min, max, autoFocus, onEnter,
}: {
  id?: string; value: string; onChange: (v: string) => void;
  placeholder?: string; type?: string; min?: string; max?: string;
  autoFocus?: boolean; onEnter?: () => void;
}) {
  return (
    <input
      id={id}
      type={type}
      min={min}
      max={max}
      placeholder={placeholder}
      value={value}
      autoFocus={autoFocus}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === "Enter" && onEnter) onEnter();
      }}
      className="w-full rounded-2xl border-2 border-ink/10 bg-white px-4 py-3.5 text-base font-semibold text-ink placeholder:font-normal placeholder:text-ink/30 focus:border-teal focus:outline-none"
    />
  );
}

function ChoiceCard({
  checked, onClick, children,
}: {
  checked: boolean; onClick: () => void; children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-3 rounded-2xl border-2 px-4 py-3.5 text-left text-sm font-semibold transition-[border-color,background-color,transform] duration-150 active:scale-[0.98] ${
        checked
          ? "border-teal bg-sky/40 text-teal-ink"
          : "border-ink/10 bg-white text-ink hover:border-teal/30"
      }`}
    >
      <span
        className={`h-4 w-4 flex-none rounded-full border-2 transition-colors ${
          checked ? "border-teal bg-teal" : "border-ink/30"
        }`}
        aria-hidden="true"
      />
      {children}
    </button>
  );
}

function Chip({
  active, onClick, children,
}: {
  active: boolean; onClick: () => void; children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`rounded-full border-2 px-4 py-2.5 text-sm font-bold transition-[border-color,background-color,color,transform] duration-150 active:scale-95 ${
        active
          ? "border-coral bg-coral text-white"
          : "border-ink/15 bg-white text-ink hover:border-coral/50"
      }`}
    >
      {children}
    </button>
  );
}

/* Mini-calendario de fechas disponibles — domingos y días pasados
   deshabilitados. Cuando exista la agenda real, este componente marcará la
   disponibilidad verdadera del equipo. */
function MiniCalendario({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const [mesOffset, setMesOffset] = useState(0);

  const base = new Date(hoy.getFullYear(), hoy.getMonth() + mesOffset, 1);
  const diasEnMes = new Date(base.getFullYear(), base.getMonth() + 1, 0).getDate();
  const offset = (base.getDay() + 6) % 7; // lunes = 0
  const celdas: (Date | null)[] = [
    ...Array.from({ length: offset }, () => null),
    ...Array.from({ length: diasEnMes }, (_, i) => new Date(base.getFullYear(), base.getMonth(), i + 1)),
  ];
  const iso = (d: Date) =>
    `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, "0")}-${d.getDate().toString().padStart(2, "0")}`;
  const nombreMes = base.toLocaleDateString("es-CL", { month: "long", year: "numeric" });

  return (
    <div className="rounded-2xl bg-cream/70 p-4">
      <div className="mb-2 flex items-center justify-between">
        <button
          type="button"
          aria-label="Mes anterior"
          onClick={() => setMesOffset((m) => Math.max(m - 1, 0))}
          disabled={mesOffset === 0}
          className="flex h-8 w-8 items-center justify-center rounded-full text-lg font-bold text-ink-soft transition-colors hover:bg-ink/5 disabled:opacity-30"
        >
          ‹
        </button>
        <p className="text-sm font-extrabold capitalize text-ink">{nombreMes}</p>
        <button
          type="button"
          aria-label="Mes siguiente"
          onClick={() => setMesOffset((m) => Math.min(m + 1, 2))}
          disabled={mesOffset === 2}
          className="flex h-8 w-8 items-center justify-center rounded-full text-lg font-bold text-ink-soft transition-colors hover:bg-ink/5 disabled:opacity-30"
        >
          ›
        </button>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center">
        {["L", "M", "M", "J", "V", "S", "D"].map((d, i) => (
          <span key={i} className="text-[11px] font-bold text-ink/40">{d}</span>
        ))}
        {celdas.map((dia, i) => {
          if (!dia) return <span key={i} />;
          const esDomingo = dia.getDay() === 0;
          const esPasado = dia < hoy;
          const deshabilitado = esDomingo || esPasado;
          const seleccionado = value === iso(dia);
          return (
            <button
              key={i}
              type="button"
              disabled={deshabilitado}
              onClick={() => onChange(iso(dia))}
              aria-pressed={seleccionado}
              className={`mx-auto flex h-9 w-9 items-center justify-center rounded-full text-sm font-bold transition-[background-color,color,transform] duration-150 active:scale-90 ${
                seleccionado
                  ? "bg-teal text-white"
                  : deshabilitado
                    ? "cursor-not-allowed text-ink/20"
                    : "text-ink hover:bg-sky/60"
              }`}
            >
              {dia.getDate()}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── Definición de micro-pasos ─────────────────────────────────────────────

type PasoId =
  | "nombre" | "raza" | "edad" | "primera" | "peso" | "tamano" | "contextura"
  | "pelo" | "salud" | "temperamento" | "zonas" | "contacto" | "cita";

const PASOS: { id: PasoId; pregunta: string; hint?: string }[] = [
  { id: "nombre", pregunta: "¿Cómo se llama tu perro?" },
  { id: "raza", pregunta: "¿Qué raza es?" },
  { id: "edad", pregunta: "¿Qué edad tiene?", hint: "Aproximada está bien" },
  { id: "primera", pregunta: "¿Es su primera peluquería? ✨", hint: "En Perrustingo las primeras visitas son especiales: presentamos todo con calma para que crezca sin miedo" },
  { id: "peso", pregunta: "¿Cuánto pesa?", hint: "Con el peso calculamos el precio al instante" },
  { id: "tamano", pregunta: "¿Cómo describirías su tamaño?", hint: "Opcional — toca el que más se parezca" },
  { id: "contextura", pregunta: "¿Y su contextura?" },
  { id: "pelo", pregunta: "¿Cómo es su pelito?" },
  { id: "salud", pregunta: "Un chequeo rápido de salud", hint: "Nos ayuda a preparar su sesión" },
  { id: "temperamento", pregunta: "¿Cómo se porta en la peluquería?" },
  { id: "zonas", pregunta: "¿Con qué NO se deja tocar?", hint: "Marca todas las que apliquen — o ninguna" },
  { id: "contacto", pregunta: "¿Cómo te contactamos?", hint: "Para confirmarte la cita" },
  { id: "cita", pregunta: "¡Último paso! Tu cita" },
];

const ZONAS: { key: keyof FormData; label: string; emoji: string }[] = [
  { key: "conPatitas", label: "Patitas", emoji: "🐾" },
  { key: "conHocico", label: "Hocico", emoji: "👃" },
  { key: "conUnas", label: "Uñas", emoji: "💅" },
  { key: "conCola", label: "Cola", emoji: "🌀" },
  { key: "conBano", label: "Baño", emoji: "🚿" },
  { key: "conSecador", label: "Secador", emoji: "💨" },
  { key: "conMaquina", label: "Máquina", emoji: "✂️" },
  { key: "conTijeras", label: "Tijeras", emoji: "✄" },
];

// ─── Main ──────────────────────────────────────────────────────────────────

export function FormReserva({
  initialServicio = "",
  initialFecha = "",
}: {
  initialServicio?: string;
  initialFecha?: string;
}) {
  const [step, setStep] = useState(0);
  const [solicitudEstado, setSolicitudEstado] = useState<"idle" | "registrada" | "error">("idle");
  const [data, setData] = useState<FormData>(() => ({
    ...FORM_INITIAL,
    servicio: SERVICIOS.includes(initialServicio) ? initialServicio : "",
    fechaDeseada: /^\d{4}-\d{2}-\d{2}$/.test(initialFecha) ? initialFecha : "",
  }));
  const tarifas = useTarifas();
  const autoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (autoTimer.current) clearTimeout(autoTimer.current);
  }, []);

  const upd = useCallback((key: keyof FormData, value: string) => {
    setData((prev) => ({ ...prev, [key]: value }));
  }, []);

  const avanzar = useCallback(() => {
    setStep((s) => Math.min(s + 1, PASOS.length - 1));
  }, []);

  /** Actualiza y avanza solo tras una pausa breve (feedback visual primero) */
  const updYAvanzar = useCallback((key: keyof FormData, value: string) => {
    setData((prev) => ({ ...prev, [key]: value }));
    if (autoTimer.current) clearTimeout(autoTimer.current);
    autoTimer.current = setTimeout(avanzar, AUTO_ADVANCE_MS);
  }, [avanzar]);

  const precioDe = useCallback(
    (p: number) => tarifas.base[detectarTamanoPorPeso(p)],
    [tarifas]
  );

  const peso = parseFloat(data.pesoKg);
  const pesoValido = !isNaN(peso) && peso > 0.4 && peso <= 120;
  const pesoInvalido = data.pesoKg !== "" && !pesoValido;
  const tamanoAuto = pesoValido ? detectarTamanoPorPeso(peso) : null;
  const esManual = !!(data.tamanoDeclarado && pesoValido && hayConflicto(data.tamanoDeclarado as TamanoKey, peso));
  const edadMesesTotal = (parseInt(data.edadAnios) || 0) * 12 + (parseInt(data.edadMeses) || 0);
  const razaJoven =
    edadMesesTotal > 0 && edadMesesTotal <= 18
      ? CATALOGO_RAZAS.find((r) => r.nombre === data.raza) ?? null
      : null;
  const precio = pesoValido ? precioDe(peso) : null;

  const paso = PASOS[step];
  const pct = ((step + 1) / PASOS.length) * 100;
  const esUltimo = step === PASOS.length - 1;
  const emailValido = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.contactoEmail.trim());
  const telefonoValido = /^\+?[\d\s]{8,15}$/.test(data.contactoTelefono.trim());
  const contactoIncompleto =
    data.contactoNombre.trim().length < 2 || !emailValido || !telefonoValido;
  const bloqueaAvance =
    (paso.id === "peso" && pesoInvalido) ||
    (paso.id === "contacto" && contactoIncompleto);

  /* Guarda la solicitud en la base (pendiente) sin bloquear la navegación
     a WhatsApp: keepalive mantiene viva la petición al abrir la otra pestaña. */
  const registrarSolicitud = useCallback(() => {
    if (!data.fechaDeseada || !data.servicio) return;
    setSolicitudEstado("registrada");
    fetch("/api/reservas", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      keepalive: true,
      body: JSON.stringify({
        contacto: {
          nombre: data.contactoNombre.trim(),
          email: data.contactoEmail.trim(),
          telefono: data.contactoTelefono.trim(),
        },
        fechaDeseada: data.fechaDeseada,
        servicio: data.servicio,
        precioEstimado: precio,
        detalle: construirDetalle(data),
      }),
    })
      .then((r) => {
        if (!r.ok && r.status !== 503) setSolicitudEstado("error");
      })
      .catch(() => setSolicitudEstado("error"));
  }, [data, precio]);

  /* El perrito acompaña todo el formulario: raza elegida > tamaño declarado */
  const razaSel = CATALOGO_RAZAS.find((r) => r.nombre === data.raza);
  const acompanante = razaSel
    ? { src: razaImagen(razaSel.slug), nombre: razaSel.nombre }
    : data.tamanoDeclarado
      ? { src: TAMANO_IMAGEN[data.tamanoDeclarado as TamanoKey], nombre: TAMANO_LABELS[data.tamanoDeclarado as TamanoKey] }
      : null;

  return (
    <div className="mx-auto w-full max-w-lg">
      {/* Progreso minimalista — con tu perrito acompañando */}
      <div className="mb-6 flex items-center gap-3">
        {acompanante && step > 0 && (
          <BreedAvatar src={acompanante.src} nombre={acompanante.nombre} size="sm" />
        )}
        <div className="h-2 flex-1 overflow-hidden rounded-full bg-ink/10">
          <div
            className="h-full rounded-full bg-teal transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)]"
            style={{ width: `${pct}%` }}
            role="progressbar"
            aria-valuenow={step + 1}
            aria-valuemin={1}
            aria-valuemax={PASOS.length}
            aria-label={`Paso ${step + 1} de ${PASOS.length}`}
          />
        </div>
        <span className="text-xs font-bold text-ink-soft">
          {step + 1}/{PASOS.length}
        </span>
      </div>

      {/* Servicio preseleccionado */}
      {data.servicio && !esUltimo && step === 0 && (
        <div className="mb-5 flex items-center gap-2 rounded-2xl bg-sky/50 px-4 py-3 text-sm font-semibold text-teal-ink">
          <span aria-hidden="true">🛁</span>
          <span>Servicio elegido: <strong>{data.servicio}</strong></span>
        </div>
      )}

      {/* Pantalla del paso — key fuerza re-animación de entrada */}
      <div key={paso.id} className="rise-in rounded-3xl bg-white p-7 shadow-sm">
        <h2 className="font-display text-2xl font-extrabold leading-snug tracking-tight text-ink">
          {paso.pregunta}
        </h2>
        {paso.hint && (
          <p className="mt-1 text-sm text-ink-soft">{paso.hint}</p>
        )}

        <div className="mt-6">
          {paso.id === "nombre" && (
            <Input
              id="nombrePerro"
              value={data.nombrePerro}
              onChange={(v) => upd("nombrePerro", v)}
              placeholder="Ej: Firulais"
              autoFocus
              onEnter={avanzar}
            />
          )}

          {paso.id === "raza" && (
            <div className="space-y-4">
              {/* Picker visual de razas — sin auto-avance para que puedas
                  ver a tu perrito antes de continuar */}
              <div className="grid max-h-72 grid-cols-3 gap-2 overflow-y-auto rounded-2xl bg-cream/60 p-3 sm:grid-cols-4">
                {CATALOGO_RAZAS.map((r) => (
                  <button
                    key={r.slug}
                    type="button"
                    onClick={() => upd("raza", r.nombre)}
                    aria-pressed={data.raza === r.nombre}
                    className={`flex flex-col items-center gap-1.5 rounded-2xl border-2 px-1.5 py-2.5 transition-[border-color,background-color,transform] duration-150 active:scale-95 ${
                      data.raza === r.nombre
                        ? "border-teal bg-sky/50"
                        : "border-transparent bg-white hover:border-teal/30"
                    }`}
                  >
                    <BreedAvatar src={razaImagen(r.slug)} nombre={r.nombre} size="md" />
                    <span className="text-center text-[10.5px] font-semibold leading-tight text-ink">
                      {r.nombre}
                    </span>
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => upd("raza", "Otro")}
                  aria-pressed={data.raza === "Otro"}
                  className={`flex flex-col items-center justify-center gap-1.5 rounded-2xl border-2 px-1.5 py-2.5 transition-[border-color,background-color,transform] duration-150 active:scale-95 ${
                    data.raza === "Otro"
                      ? "border-teal bg-sky/50"
                      : "border-transparent bg-white hover:border-teal/30"
                  }`}
                >
                  <span className="flex h-14 w-14 items-center justify-center rounded-full border-[3px] border-white bg-white/70 text-xl shadow-sm" aria-hidden="true">
                    ✨
                  </span>
                  <span className="text-[10.5px] font-semibold text-ink">Otra raza</span>
                </button>
              </div>

              {data.raza === "Otro" && (
                <Input
                  value={data.razaOtro}
                  onChange={(v) => upd("razaOtro", v)}
                  placeholder="¿Cuál raza?"
                  autoFocus
                  onEnter={avanzar}
                />
              )}

              {/* Tu perrito, en grande */}
              {data.raza && data.raza !== "Otro" && (
                <div className="rise-in flex items-center gap-4 rounded-2xl bg-sky/40 px-5 py-4">
                  {(() => {
                    const razaSel = CATALOGO_RAZAS.find((r) => r.nombre === data.raza);
                    return razaSel ? (
                      <BreedAvatar src={razaImagen(razaSel.slug)} nombre={razaSel.nombre} size="lg" />
                    ) : null;
                  })()}
                  <p className="text-sm font-semibold text-teal-ink">
                    ¡Un{" "}
                    <strong>{data.raza}</strong>
                    {data.nombrePerro ? ` como ${data.nombrePerro}` : ""}! Nos
                    encantan. Cuando estés listo, sigue con el botón de abajo.
                  </p>
                </div>
              )}
            </div>
          )}

          {paso.id === "edad" && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="edadAnios" className="mb-1 block text-sm font-bold text-ink">Años</label>
                <Input id="edadAnios" type="number" min="0" max="25" value={data.edadAnios} onChange={(v) => upd("edadAnios", v)} placeholder="0" autoFocus onEnter={avanzar} />
              </div>
              <div>
                <label htmlFor="edadMeses" className="mb-1 block text-sm font-bold text-ink">Meses</label>
                <Input id="edadMeses" type="number" min="0" max="11" value={data.edadMeses} onChange={(v) => upd("edadMeses", v)} placeholder="0" onEnter={avanzar} />
              </div>
            </div>
          )}

          {paso.id === "primera" && (
            <div className="grid gap-2">
              {([
                ["si", "🎀 Sí, ¡es su primera vez!"],
                ["no", "🐾 Ya ha ido a peluquería antes"],
                ["no_lo_se", "🤷 No lo sé"],
              ] as [string, string][]).map(([v, l]) => (
                <ChoiceCard key={v} checked={data.esPrimeraVez === v} onClick={() => updYAvanzar("esPrimeraVez", v)}>
                  {l}
                </ChoiceCard>
              ))}
              {data.esPrimeraVez === "si" && (
                <div className="rise-in mt-2 rounded-2xl bg-sky/40 px-5 py-4 text-sm font-semibold text-teal-ink">
                  🌟 ¡Qué emoción! Las primeras visitas las hacemos con juego y
                  paciencia extra — es nuestro sello.
                </div>
              )}
            </div>
          )}

          {paso.id === "peso" && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="pesoKg" className="mb-1 block text-sm font-bold text-ink">Peso (kg)</label>
                  <Input id="pesoKg" type="number" min="0" max="120" value={data.pesoKg} onChange={(v) => upd("pesoKg", v)} placeholder="Ej: 8" autoFocus onEnter={avanzar} />
                </div>
                <div>
                  <label htmlFor="alturaCmd" className="mb-1 block text-sm font-bold text-ink">
                    Altura (cm) <span className="font-normal text-ink/40">opcional</span>
                  </label>
                  <Input id="alturaCmd" type="number" min="0" max="100" value={data.alturaCmd} onChange={(v) => upd("alturaCmd", v)} placeholder="Ej: 30" onEnter={avanzar} />
                </div>
              </div>
              {pesoInvalido && (
                <div className="rise-in flex items-center gap-3 rounded-2xl bg-[#fde4c8] px-5 py-4 text-sm font-semibold text-[#a34d00]">
                  <span aria-hidden="true">⚠</span>
                  <span>
                    Ese peso no parece válido — usa un valor entre 0,5 y 120 kg
                    para poder estimar el precio.
                  </span>
                </div>
              )}
              {precio !== null && tamanoAuto && !pesoInvalido && (
                <div className="rise-in flex items-center gap-4 rounded-2xl bg-[#d8f0e3] px-5 py-4 text-sm font-semibold text-teal-ink">
                  <BreedAvatar src={TAMANO_IMAGEN[tamanoAuto]} nombre={TAMANO_LABELS[tamanoAuto]} size="lg" />
                  <span>
                    ✅ <strong>{TAMANO_LABELS[tamanoAuto]}</strong>
                    <span className="block">Precio estimado: <strong>{formatCLP(precio)}</strong></span>
                    <span className="mt-1 block text-xs font-normal opacity-80">{NOTA_PRECIOS}</span>
                  </span>
                </div>
              )}
              {razaJoven && tamanoAuto && razaJoven.tamano !== tamanoAuto && !pesoInvalido && (
                <div className="rise-in rounded-2xl bg-[#fde4c8] px-5 py-3 text-xs font-semibold leading-relaxed text-[#7a4d10]">
                  🐶 Un {razaJoven.nombre} joven sigue creciendo: por su raza es de
                  tamaño <strong>{TAMANO_LABELS[razaJoven.tamano]}</strong> adulto, así
                  que el valor se ajusta en puerta según su desarrollo.
                </div>
              )}
            </div>
          )}

          {paso.id === "tamano" && (
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {(Object.keys(TAMANO_LABELS) as TamanoKey[]).map((k) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => updYAvanzar("tamanoDeclarado", k)}
                  className={`flex items-center gap-3 rounded-2xl border-2 px-3 py-2.5 text-left text-sm font-semibold transition-[border-color,background-color,transform] duration-150 active:scale-[0.98] ${
                    data.tamanoDeclarado === k
                      ? "border-teal bg-sky/40 text-teal-ink"
                      : "border-ink/10 bg-white text-ink hover:border-teal/30"
                  }`}
                >
                  <BreedAvatar src={TAMANO_IMAGEN[k]} nombre={TAMANO_LABELS[k]} size="md" />
                  <span className="leading-tight">{TAMANO_LABELS[k]}</span>
                </button>
              ))}
            </div>
          )}

          {paso.id === "contextura" && (
            <div className="grid gap-2">
              {(["delgado", "normal", "robusto"] as const).map((c) => (
                <ChoiceCard key={c} checked={data.contextura === c} onClick={() => updYAvanzar("contextura", c)}>
                  {c.charAt(0).toUpperCase() + c.slice(1)}
                </ChoiceCard>
              ))}
            </div>
          )}

          {paso.id === "pelo" && (
            <div className="space-y-3">
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {(Object.keys(PELO_LABELS) as TipoPelo[]).map((k) => (
                  <ChoiceCard
                    key={k}
                    checked={data.tipoPelo === k}
                    onClick={() => (k === "otro" ? upd("tipoPelo", k) : updYAvanzar("tipoPelo", k))}
                  >
                    {PELO_LABELS[k]}
                  </ChoiceCard>
                ))}
              </div>
              {data.tipoPelo === "otro" && (
                <Input value={data.tipoPeloOtro} onChange={(v) => upd("tipoPeloOtro", v)} placeholder="Describe el tipo de pelo…" autoFocus onEnter={avanzar} />
              )}
            </div>
          )}

          {paso.id === "salud" && (
            <div className="space-y-5">
              {([
                ["unasEncarnadas", "Uñas encarnadas"],
                ["secrecionOcular", "Secreción ocular"],
                ["tieneAlergia", "¿Enfermedad o alergia?"],
              ] as [keyof FormData, string][]).map(([key, label]) => (
                <div key={key} className="flex items-center justify-between gap-3">
                  <p className="text-sm font-bold text-ink">{label}</p>
                  <div className="flex gap-2">
                    {(["si", "no"] as const).map((v) => (
                      <Chip key={v} active={data[key] === v} onClick={() => upd(key, v)}>
                        {v === "si" ? "Sí" : "No"}
                      </Chip>
                    ))}
                  </div>
                </div>
              ))}
              {data.tieneAlergia === "si" && (
                <Input value={data.cualAlergia} onChange={(v) => upd("cualAlergia", v)} placeholder="¿Cuál enfermedad o alergia?" onEnter={avanzar} />
              )}
            </div>
          )}

          {paso.id === "temperamento" && (
            <div className="grid gap-2">
              {([
                ["se_deja", "😊 Se deja — es un pan de Dios"],
                ["no_se_deja", "😬 No se deja"],
                ["complicado", "🌪️ Complicado o bravo"],
                ["no_lo_se", "🤷 No lo sé, es su primera vez"],
              ] as [string, string][]).map(([v, l]) => (
                <ChoiceCard key={v} checked={data.temperamentoGeneral === v} onClick={() => updYAvanzar("temperamentoGeneral", v)}>
                  {l}
                </ChoiceCard>
              ))}
            </div>
          )}

          {paso.id === "zonas" && (
            <div className="flex flex-wrap gap-2.5">
              {ZONAS.map(({ key, label, emoji }) => {
                const activo = data[key] === "no_se_deja";
                return (
                  <Chip
                    key={key}
                    active={activo}
                    onClick={() => upd(key, activo ? "" : "no_se_deja")}
                  >
                    <span aria-hidden="true" className="mr-1">{emoji}</span>
                    {label}
                  </Chip>
                );
              })}
            </div>
          )}

          {paso.id === "contacto" && (
            <div className="space-y-4">
              <div>
                <label htmlFor="contactoNombre" className="mb-1 block text-sm font-bold text-ink">Tu nombre</label>
                <Input id="contactoNombre" value={data.contactoNombre} onChange={(v) => upd("contactoNombre", v)} placeholder="Ej: Camila Rojas" autoFocus onEnter={avanzar} />
              </div>
              <div>
                <label htmlFor="contactoTelefono" className="mb-1 block text-sm font-bold text-ink">Teléfono / WhatsApp</label>
                <Input id="contactoTelefono" type="tel" value={data.contactoTelefono} onChange={(v) => upd("contactoTelefono", v)} placeholder="+56 9 1234 5678" onEnter={avanzar} />
              </div>
              <div>
                <label htmlFor="contactoEmail" className="mb-1 block text-sm font-bold text-ink">Correo</label>
                <Input id="contactoEmail" type="email" value={data.contactoEmail} onChange={(v) => upd("contactoEmail", v)} placeholder="tu@correo.cl" onEnter={avanzar} />
              </div>
              {contactoIncompleto && (data.contactoNombre || data.contactoEmail || data.contactoTelefono) && (
                <p className="text-xs font-semibold text-ink-soft">
                  Completa nombre, teléfono válido y correo para continuar.
                </p>
              )}
            </div>
          )}

          {paso.id === "cita" && (
            <div className="space-y-5">
              <div>
                <p className="mb-1 text-sm font-bold text-ink">Fechas disponibles</p>
                <p className="mb-2 text-xs text-ink-soft">
                  Referencial — confirmamos la hora exacta por WhatsApp.{" "}
                  <a href="/agenda" className="font-bold text-teal-dark underline-offset-2 hover:underline">
                    Ver agenda semanal →
                  </a>
                </p>
                <MiniCalendario value={data.fechaDeseada} onChange={(v) => upd("fechaDeseada", v)} />
              </div>

              <div>
                <p className="mb-1 text-sm font-bold text-ink">Servicio</p>
                <div className="grid gap-2">
                  {SERVICIOS.map((s) => (
                    <ChoiceCard key={s} checked={data.servicio === s} onClick={() => upd("servicio", s)}>
                      {s}
                    </ChoiceCard>
                  ))}
                </div>
              </div>

              <div className={`rounded-3xl p-5 ${esManual ? "bg-[#fde4c8]" : "bg-[#d8f0e3]"}`}>
                <p className="font-display text-base font-extrabold text-ink">
                  {esManual ? "⚠️ Atención personalizada" : "✅ Reserva lista"}
                </p>
                <p className="mt-1 text-sm leading-relaxed text-ink-soft">
                  {esManual
                    ? "El tamaño y el peso no coinciden. Rodolfo te atenderá directamente para evaluar a tu perro."
                    : `${data.nombrePerro ? data.nombrePerro + " · " : ""}Precio estimado: ${precio ? formatCLP(precio) : "—"} · Todo listo para enviar por WhatsApp.`}
                </p>
                <p className="mt-2 text-xs leading-relaxed text-ink-soft">{NOTA_PRECIOS}</p>
              </div>

              <a
                href={WHATSAPP_BASE + encodeURIComponent(buildWhatsAppMessage(data, esManual, precio))}
                target="_blank"
                rel="noopener noreferrer"
                onClick={registrarSolicitud}
                className={`flex w-full items-center justify-center gap-2 rounded-full py-4 font-display text-base font-extrabold shadow-[0_3px_0_rgba(6,58,64,.25)] transition-[background-color,transform,box-shadow] duration-150 hover:shadow-[0_5px_0_rgba(6,58,64,.25)] active:translate-y-0.5 active:shadow-[0_1px_0_rgba(6,58,64,.25)] ${
                  esManual
                    ? "bg-orange text-teal-ink hover:bg-[#f7ab52]"
                    : "bg-teal text-white hover:bg-teal-dark"
                }`}
              >
                <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current" aria-hidden="true">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
                  <path d="M12 0C5.373 0 0 5.373 0 12c0 2.125.555 4.122 1.528 5.858L0 24l6.335-1.652A11.954 11.954 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.818a9.818 9.818 0 01-5.007-1.37l-.36-.213-3.727.977.994-3.634-.234-.373A9.818 9.818 0 0112 2.182c5.426 0 9.818 4.392 9.818 9.818S17.426 21.818 12 21.818z"/>
                </svg>
                {esManual ? "Solicitar evaluación personalizada" : "Confirmar reserva por WhatsApp"}
              </a>

              {solicitudEstado === "registrada" && (
                <p className="rise-in rounded-2xl bg-[#d8f0e3] px-5 py-3 text-center text-sm font-semibold text-teal-ink">
                  🐾 Tu solicitud quedó registrada como <strong>pendiente</strong> —
                  el equipo la confirmará pronto.
                </p>
              )}
              {solicitudEstado === "error" && (
                <p className="rise-in rounded-2xl bg-[#fde4c8] px-5 py-3 text-center text-sm font-semibold text-[#a34d00]">
                  No pudimos registrar la solicitud en línea, pero tu mensaje de
                  WhatsApp salió igual — el equipo te responderá por ahí.
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Navegación */}
      <div className="mt-5 flex items-center gap-3">
        {step > 0 && (
          <button
            type="button"
            onClick={() => setStep((s) => s - 1)}
            className="rounded-full border-2 border-ink/15 px-6 py-3 font-display text-sm font-extrabold text-ink transition-colors hover:border-ink/30"
          >
            ←
          </button>
        )}
        {!esUltimo && (
          <button
            type="button"
            onClick={avanzar}
            disabled={bloqueaAvance}
            className="flex-1 rounded-full bg-teal py-3.5 font-display text-sm font-extrabold text-white shadow-[0_3px_0_rgba(6,58,64,.25)] transition-[background-color,box-shadow,opacity] hover:bg-teal-dark hover:shadow-[0_5px_0_rgba(6,58,64,.25)] disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-teal"
          >
            {paso.id === "zonas" || paso.id === "salud" ? "Continuar →" : "Siguiente →"}
          </button>
        )}
      </div>
    </div>
  );
}
