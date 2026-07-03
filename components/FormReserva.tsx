"use client";

import { useCallback, useState } from "react";
import {
  FORM_INITIAL,
  PELO_LABELS,
  RAZAS,
  SERVICIOS,
  TAMANO_LABELS,
  TEMP_LABELS,
  Temperamento,
  TamanoKey,
  TipoPelo,
  buildWhatsAppMessage,
  calcularPrecio,
  detectarTamanoPorPeso,
  formatCLP,
  hayConflicto,
  type FormData,
} from "@/lib/reserva";

const STEPS = ["Tu perro", "Tamaño y pelo", "Salud y carácter", "Tu cita"];
const WHATSAPP_BASE = "https://wa.me/4915237152283?text=";

// ─── UI helpers ────────────────────────────────────────────────────────────

function Label({ htmlFor, children }: { htmlFor?: string; children: React.ReactNode }) {
  return (
    <label htmlFor={htmlFor} className="mb-1 block text-sm font-bold text-ink">
      {children}
    </label>
  );
}

function Input({
  id, value, onChange, placeholder, type = "text", min, max,
}: {
  id?: string; value: string; onChange: (v: string) => void;
  placeholder?: string; type?: string; min?: string; max?: string;
}) {
  return (
    <input
      id={id}
      type={type}
      min={min}
      max={max}
      placeholder={placeholder}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full rounded-2xl border-2 border-ink/10 bg-white px-4 py-3 text-sm font-semibold text-ink placeholder:font-normal placeholder:text-ink/30 focus:border-teal focus:outline-none"
    />
  );
}

function RadioCard({
  checked, onClick, children,
}: {
  checked: boolean; onClick: () => void; children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-3 rounded-2xl border-2 px-4 py-3 text-left text-sm font-semibold transition-colors duration-150 ${
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

function SiNo({
  value, onChange,
}: {
  value: "si" | "no" | ""; onChange: (v: "si" | "no") => void;
}) {
  return (
    <div className="flex gap-3">
      <RadioCard checked={value === "si"} onClick={() => onChange("si")}>Sí</RadioCard>
      <RadioCard checked={value === "no"} onClick={() => onChange("no")}>No</RadioCard>
    </div>
  );
}

function TempRow({
  label, value, onChange,
}: {
  label: string; value: Temperamento | ""; onChange: (v: Temperamento) => void;
}) {
  return (
    <div>
      <p className="mb-1.5 text-xs font-bold uppercase tracking-wide text-ink-soft">{label}</p>
      <div className="flex flex-wrap gap-2">
        {(["se_deja", "no_se_deja", "no_lo_se"] as Temperamento[]).map((t) => (
          <RadioCard key={t} checked={value === t} onClick={() => onChange(t)}>
            {TEMP_LABELS[t]}
          </RadioCard>
        ))}
      </div>
    </div>
  );
}

// ─── Steps ─────────────────────────────────────────────────────────────────

function Step1({ data, upd }: { data: FormData; upd: (k: keyof FormData, v: string) => void }) {
  return (
    <div className="space-y-5">
      <div>
        <Label htmlFor="nombrePerro">Nombre de tu perro</Label>
        <Input id="nombrePerro" value={data.nombrePerro} onChange={(v) => upd("nombrePerro", v)} placeholder="Ej: Firulais" />
      </div>

      <div>
        <Label htmlFor="raza">Raza</Label>
        <select
          id="raza"
          value={data.raza}
          onChange={(e) => upd("raza", e.target.value)}
          className="w-full rounded-2xl border-2 border-ink/10 bg-white px-4 py-3 text-sm font-semibold text-ink focus:border-teal focus:outline-none"
        >
          <option value="">Selecciona una raza…</option>
          {RAZAS.map((r) => (
            <option key={r} value={r}>{r}</option>
          ))}
        </select>
        {data.raza === "Otro" && (
          <div className="mt-2">
            <Input value={data.razaOtro} onChange={(v) => upd("razaOtro", v)} placeholder="¿Cuál raza?" />
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="edadAnios">Edad — años</Label>
          <Input id="edadAnios" type="number" min="0" max="25" value={data.edadAnios} onChange={(v) => upd("edadAnios", v)} placeholder="0" />
        </div>
        <div>
          <Label htmlFor="edadMeses">Meses</Label>
          <Input id="edadMeses" type="number" min="0" max="11" value={data.edadMeses} onChange={(v) => upd("edadMeses", v)} placeholder="0" />
        </div>
      </div>
    </div>
  );
}

function Step2({ data, upd }: { data: FormData; upd: (k: keyof FormData, v: string) => void }) {
  const peso = parseFloat(data.pesoKg);
  const pesoValido = !isNaN(peso) && peso > 0;
  const tamanoAuto = pesoValido ? detectarTamanoPorPeso(peso) : null;
  const precio = pesoValido ? calcularPrecio(peso) : null;
  const conflicto = !!(data.tamanoDeclarado && pesoValido && hayConflicto(data.tamanoDeclarado as TamanoKey, peso));

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="pesoKg">Peso (kg)</Label>
          <Input id="pesoKg" type="number" min="0" max="120" value={data.pesoKg} onChange={(v) => upd("pesoKg", v)} placeholder="Ej: 8" />
        </div>
        <div>
          <Label htmlFor="alturaCmd">Altura (cm) <span className="font-normal text-ink/40">opcional</span></Label>
          <Input id="alturaCmd" type="number" min="0" max="100" value={data.alturaCmd} onChange={(v) => upd("alturaCmd", v)} placeholder="Ej: 30" />
        </div>
      </div>

      {/* Precio en tiempo real */}
      {precio !== null && (
        <div className={`rounded-2xl px-5 py-4 text-sm font-semibold ${conflicto ? "bg-[#fde4c8] text-[#a34d00]" : "bg-[#d8f0e3] text-teal-ink"}`}>
          {conflicto ? (
            <>⚠️ El tamaño declarado y el peso no coinciden — te derivaremos a <strong>atención personalizada</strong>.</>
          ) : (
            <>✅ Tamaño detectado: <strong>{TAMANO_LABELS[tamanoAuto!]}</strong> · Precio estimado: <strong>{formatCLP(precio)}</strong></>
          )}
        </div>
      )}

      <div>
        <Label>¿Cómo describirías su tamaño? <span className="font-normal text-ink/40">(opcional)</span></Label>
        <div className="mt-1 grid grid-cols-1 gap-2 sm:grid-cols-2">
          {(Object.keys(TAMANO_LABELS) as TamanoKey[]).map((k) => (
            <RadioCard key={k} checked={data.tamanoDeclarado === k} onClick={() => upd("tamanoDeclarado", k)}>
              {TAMANO_LABELS[k]}
            </RadioCard>
          ))}
        </div>
      </div>

      <div>
        <Label>Contextura</Label>
        <div className="mt-1 flex flex-wrap gap-2">
          {(["delgado", "normal", "robusto"] as const).map((c) => (
            <RadioCard key={c} checked={data.contextura === c} onClick={() => upd("contextura", c)}>
              {c.charAt(0).toUpperCase() + c.slice(1)}
            </RadioCard>
          ))}
        </div>
      </div>

      <div>
        <Label>Tipo de pelo</Label>
        <div className="mt-1 grid grid-cols-1 gap-2 sm:grid-cols-2">
          {(Object.keys(PELO_LABELS) as TipoPelo[]).map((k) => (
            <RadioCard key={k} checked={data.tipoPelo === k} onClick={() => upd("tipoPelo", k)}>
              {PELO_LABELS[k]}
            </RadioCard>
          ))}
        </div>
        {data.tipoPelo === "otro" && (
          <div className="mt-2">
            <Input value={data.tipoPeloOtro} onChange={(v) => upd("tipoPeloOtro", v)} placeholder="Describe el tipo de pelo…" />
          </div>
        )}
      </div>
    </div>
  );
}

function Step3({ data, upd }: { data: FormData; upd: (k: keyof FormData, v: string) => void }) {
  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm font-bold text-ink">Uñas encarnadas</p>
        <div className="mt-2">
          <SiNo value={data.unasEncarnadas} onChange={(v) => upd("unasEncarnadas", v)} />
        </div>
      </div>

      <div>
        <p className="text-sm font-bold text-ink">Secreción ocular</p>
        <div className="mt-2">
          <SiNo value={data.secrecionOcular} onChange={(v) => upd("secrecionOcular", v)} />
        </div>
      </div>

      <div>
        <p className="text-sm font-bold text-ink">¿Tiene enfermedad o alergia?</p>
        <div className="mt-2">
          <SiNo value={data.tieneAlergia} onChange={(v) => upd("tieneAlergia", v)} />
        </div>
        {data.tieneAlergia === "si" && (
          <div className="mt-2">
            <Input value={data.cualAlergia} onChange={(v) => upd("cualAlergia", v)} placeholder="¿Cuál enfermedad o alergia?" />
          </div>
        )}
      </div>

      <hr className="border-ink/10" />

      <div>
        <p className="mb-3 text-sm font-bold text-ink">Temperamento general</p>
        <div className="flex flex-wrap gap-2">
          {([
            ["se_deja", "Se deja"],
            ["no_se_deja", "No se deja"],
            ["no_lo_se", "No lo sé"],
            ["complicado", "Complicado / bravo"],
          ] as [string, string][]).map(([v, l]) => (
            <RadioCard key={v} checked={data.temperamentoGeneral === v} onClick={() => upd("temperamentoGeneral", v)}>
              {l}
            </RadioCard>
          ))}
        </div>
      </div>

      <div className="space-y-4">
        <p className="text-sm font-bold text-ink">¿Con qué partes o herramientas tiene problemas?</p>
        <TempRow label="Patitas" value={data.conPatitas} onChange={(v) => upd("conPatitas", v)} />
        <TempRow label="Hocico" value={data.conHocico} onChange={(v) => upd("conHocico", v)} />
        <TempRow label="Uñas" value={data.conUnas} onChange={(v) => upd("conUnas", v)} />
        <TempRow label="Cola" value={data.conCola} onChange={(v) => upd("conCola", v)} />
        <TempRow label="Baño" value={data.conBano} onChange={(v) => upd("conBano", v)} />
        <TempRow label="Secador" value={data.conSecador} onChange={(v) => upd("conSecador", v)} />
        <TempRow label="Máquina" value={data.conMaquina} onChange={(v) => upd("conMaquina", v)} />
        <TempRow label="Tijeras" value={data.conTijeras} onChange={(v) => upd("conTijeras", v)} />
      </div>
    </div>
  );
}

function Step4({ data, upd, esManual, precio }: {
  data: FormData; upd: (k: keyof FormData, v: string) => void;
  esManual: boolean; precio: number | null;
}) {
  const mensaje = buildWhatsAppMessage(data, esManual);
  const url = WHATSAPP_BASE + encodeURIComponent(mensaje);

  return (
    <div className="space-y-5">
      <div>
        <Label htmlFor="fechaDeseada">Fecha deseada</Label>
        <Input id="fechaDeseada" type="date" value={data.fechaDeseada} onChange={(v) => upd("fechaDeseada", v)} placeholder="" />
      </div>

      <div>
        <Label>Servicio</Label>
        <div className="mt-1 grid gap-2">
          {SERVICIOS.map((s) => (
            <RadioCard key={s} checked={data.servicio === s} onClick={() => upd("servicio", s)}>
              {s}
            </RadioCard>
          ))}
        </div>
      </div>

      {/* Resumen */}
      <div className={`rounded-3xl p-5 ${esManual ? "bg-[#fde4c8]" : "bg-[#d8f0e3]"}`}>
        <p className="font-display text-base font-extrabold text-ink">
          {esManual ? "⚠️ Atención personalizada" : "✅ Reserva lista"}
        </p>
        <p className="mt-1 text-sm leading-relaxed text-ink-soft">
          {esManual
            ? "El tamaño y el peso no coinciden. Rodolfo te atenderá directamente para evaluar a tu perro."
            : `Precio estimado: ${precio ? formatCLP(precio) : "—"} · Todo listo para enviar por WhatsApp.`}
        </p>
      </div>

      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
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
    </div>
  );
}

// ─── Main form orchestrator ─────────────────────────────────────────────────

export function FormReserva() {
  const [step, setStep] = useState(0);
  const [data, setData] = useState<FormData>(FORM_INITIAL);

  const upd = useCallback(<K extends keyof FormData>(key: K, value: FormData[K]) => {
    setData((prev) => ({ ...prev, [key]: value }));
  }, []);

  const updStr = useCallback((key: keyof FormData, value: string) => {
    setData((prev) => ({ ...prev, [key]: value }));
  }, []);

  const peso = parseFloat(data.pesoKg);
  const pesoValido = !isNaN(peso) && peso > 0;
  const esManual = !!(data.tamanoDeclarado && pesoValido && hayConflicto(data.tamanoDeclarado as TamanoKey, peso));
  const precio = pesoValido ? calcularPrecio(peso) : null;

  const pct = ((step + 1) / STEPS.length) * 100;

  return (
    <div className="mx-auto w-full max-w-xl">
      {/* Progreso */}
      <div className="mb-8">
        <div className="mb-3 flex justify-between">
          {STEPS.map((s, i) => (
            <span
              key={s}
              className={`text-xs font-bold transition-colors ${i === step ? "text-teal-dark" : i < step ? "text-teal/60" : "text-ink/30"}`}
            >
              {s}
            </span>
          ))}
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-ink/10">
          <div
            className="h-full rounded-full bg-teal transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)]"
            style={{ width: `${pct}%` }}
            role="progressbar"
            aria-valuenow={step + 1}
            aria-valuemin={1}
            aria-valuemax={STEPS.length}
            aria-label={`Paso ${step + 1} de ${STEPS.length}: ${STEPS[step]}`}
          />
        </div>
      </div>

      {/* Card del paso actual */}
      <div className="rounded-3xl bg-white p-7 shadow-sm">
        <h2 className="mb-6 font-display text-xl font-extrabold tracking-tight text-ink">
          {step === 0 && "Cuéntanos sobre tu perro"}
          {step === 1 && "Tamaño y tipo de pelo"}
          {step === 2 && "Salud y temperamento"}
          {step === 3 && "¿Cuándo agendamos?"}
        </h2>

        {step === 0 && <Step1 data={data} upd={updStr} />}
        {step === 1 && <Step2 data={data} upd={updStr} />}
        {step === 2 && <Step3 data={data} upd={updStr} />}
        {step === 3 && <Step4 data={data} upd={updStr} esManual={esManual} precio={precio} />}
      </div>

      {/* Navegación */}
      {step < STEPS.length - 1 && (
        <div className="mt-5 flex gap-3">
          {step > 0 && (
            <button
              type="button"
              onClick={() => setStep((s) => s - 1)}
              className="flex-1 rounded-full border-2 border-ink/15 py-3.5 font-display text-sm font-extrabold text-ink transition-colors hover:border-ink/30"
            >
              ← Anterior
            </button>
          )}
          <button
            type="button"
            onClick={() => setStep((s) => s + 1)}
            className="flex-1 rounded-full bg-teal py-3.5 font-display text-sm font-extrabold text-white shadow-[0_3px_0_rgba(6,58,64,.25)] transition-[background-color,box-shadow] hover:bg-teal-dark hover:shadow-[0_5px_0_rgba(6,58,64,.25)]"
          >
            Siguiente →
          </button>
        </div>
      )}

      {step === STEPS.length - 1 && step > 0 && (
        <button
          type="button"
          onClick={() => setStep((s) => s - 1)}
          className="mt-4 w-full rounded-full border-2 border-ink/15 py-3.5 font-display text-sm font-extrabold text-ink transition-colors hover:border-ink/30"
        >
          ← Anterior
        </button>
      )}
    </div>
  );
}
