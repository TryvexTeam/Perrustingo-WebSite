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
  EDAD_CACHORRO_MESES,
  buildWhatsAppMessageMulti,
  calcularEstimado,
  construirDetalle,
  detectarTamanoPorPeso,
  formatCLP,
  formatRangoCLP,
  conEnlaceFicha,
  conEnlacesFoto,
  type FotoEnMensaje,
  montoDeAjuste,
  textoDeAjuste,
  hayConflicto,
  type AjustePrecio,
  type EstimadoVivo,
  type FormData,
  faltaEnPaso,
  capitalizarNombre,
  capitalizarFrase,
  RAZAS,
} from "@/lib/reserva";
import { CATALOGO_RAZAS, razaImagen, TAMANO_IMAGEN } from "@/lib/razas";
import { useTarifas } from "@/lib/tarifas";
import { useTramos } from "@/lib/tramosDatos";
import { precioDe } from "@/lib/tramos";
import { useTramosAltura } from "@/lib/tramosAlturaDatos";
import { ajusteDeAltura } from "@/lib/tramosAltura";
import { useAjustesPorTamano } from "@/lib/ajustesPrecio";
import { fotoValida, subirFotoReserva } from "@/lib/fotos";
import { WHATSAPP_NUMBER, hayWhatsAppConfigurado } from "@/lib/site";
import { createClient } from "@/lib/supabase/client";
import { compartirFotos, puedeCompartirFotos } from "@/lib/compartir";
import {
  COMUNAS,
  CONTACTO_VACIO,
  validarContacto,
  type DatosContacto,
} from "@/lib/contacto";
import { comoAjuste, mejorOferta, type Oferta } from "@/lib/ofertas";
import { obtenerOfertasActivas } from "@/lib/ofertasDatos";
import { hoyEnSantiago, primeraFechaReservable } from "@/lib/disponibilidad";
import { obtenerDisponibilidad } from "@/lib/disponibilidadDatos";
import { SelectorHorario } from "@/components/reserva/SelectorHorario";
import { BreedAvatar } from "@/components/ui/BreedAvatar";

const WHATSAPP_BASE = `https://wa.me/${WHATSAPP_NUMBER}?text=`;

/* ── Perritos guardados (pedido del señor Adley, 30-jul) ────────
   Quien ya reservó antes tiene la ficha de su perro en la base; obligarlo a
   escribirla de nuevo era la queja, y de paso cada reserva creaba una ficha
   duplicada. Con esto el cliente toca a su perro, la ficha se precarga, y
   el servidor REUTILIZA la existente en vez de duplicar. */

interface PerroGuardado {
  id: string;
  nombre: string;
  raza: string | null;
  peso_kg: number | null;
  contextura: string | null;
  tipo_pelo: string | null;
  temperamento: string | null;
  alergias: string | null;
}

/** La ficha guardada, traducida a los campos del formulario. Cada valor se
    valida contra las opciones vigentes: una ficha vieja con un dato que ya
    no existe deja el campo vacío en vez de romper el paso. */
function perroAFormData(p: PerroGuardado): Partial<FormData> {
  const razaConocida = Boolean(p.raza && (RAZAS as readonly string[]).includes(p.raza));
  const contexturas = ["delgado", "normal", "robusto"] as const;
  const temperamentos = ["se_deja", "no_se_deja", "complicado", "no_lo_se"] as const;
  return {
    nombrePerro: p.nombre,
    raza: p.raza ? (razaConocida ? p.raza : "Otro") : "",
    razaOtro: p.raza && !razaConocida ? p.raza : "",
    pesoKg: p.peso_kg != null ? String(p.peso_kg) : "",
    contextura: (contexturas as readonly string[]).includes(p.contextura ?? "")
      ? (p.contextura as FormData["contextura"])
      : "",
    tipoPelo:
      p.tipo_pelo && p.tipo_pelo in PELO_LABELS ? (p.tipo_pelo as FormData["tipoPelo"]) : "",
    temperamentoGeneral: (temperamentos as readonly string[]).includes(p.temperamento ?? "")
      ? (p.temperamento as FormData["temperamentoGeneral"])
      : "",
    tieneAlergia: p.alergias ? "si" : "",
    cualAlergia: p.alergias && p.alergias !== "sí" ? p.alergias : "",
    /* Ya nos conoce: no es su primera peluquería con nosotros. */
    esPrimeraVez: "no",
  };
}

/* Cuánto se espera a que el servidor confirme la reserva antes de abrir
   WhatsApp igual. Seis segundos: suficiente para una respuesta normal
   (incluso con la subida de fotos ya hecha antes), y poco para quien está
   mirando una pestaña en blanco con el pulgar sobre el botón. */
const ESPERA_RESERVA_MS = 6000;

/* Wizard progresivo v2 — reserva multi-perrito (pedido de Rodolfo 19-jul):
   se pregunta cuántos perritos vienen y el bloque de preguntas se repite
   por cada uno; las fotos (actual + referencia de corte) van por perrito;
   Se puede reservar CON o SIN cuenta (PRP-003 F1): sin cuenta, el último
   paso pide los datos de contacto que con cuenta salen del perfil. */

const AUTO_ADVANCE_MS = 350;
const MAX_PERROS = 3;

// ─── UI helpers ────────────────────────────────────────────────────────────

function Input({
  id, value, onChange, placeholder, type = "text", min, max, autoFocus, onEnter, onBlur,
}: {
  id?: string; value: string; onChange: (v: string) => void;
  placeholder?: string; type?: string; min?: string; max?: string;
  autoFocus?: boolean; onEnter?: () => void; onBlur?: () => void;
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
      onBlur={onBlur}
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

function FotoPicker({
  id, label, hint, file, onFile, requerida, soloCamara, disabled,
}: {
  id: string; label: string; hint: string; file: File | null;
  onFile: (f: File | null) => void; requerida?: boolean; soloCamara?: boolean;
  disabled?: boolean;
}) {
  const [error, setError] = useState("");
  const [preview, setPreview] = useState<string | null>(null);

  useEffect(() => {
    if (!file) {
      setPreview(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  return (
    <div className={disabled ? "opacity-50" : undefined}>
      <p className="mb-1 text-sm font-bold text-ink">
        {label}{" "}
        {!requerida && <span className="font-normal text-ink/40">opcional</span>}
      </p>
      <p className="mb-2 text-xs text-ink-soft">{hint}</p>
      <label
        htmlFor={id}
        className={`flex items-center gap-4 rounded-2xl border-2 border-dashed px-4 py-4 transition-colors ${
          disabled ? "pointer-events-none cursor-not-allowed border-ink/10 bg-cream/60" : "cursor-pointer"
        } ${file ? "border-teal bg-sky/30" : "border-ink/15 bg-white hover:border-teal/40"}`}
      >
        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={preview}
            alt=""
            className="h-16 w-16 flex-none rounded-xl object-cover"
          />
        ) : (
          <span
            className="flex h-16 w-16 flex-none items-center justify-center rounded-xl bg-cream text-2xl"
            aria-hidden="true"
          >
            📷
          </span>
        )}
        <span className="text-sm font-semibold text-ink">
          {file ? file.name : soloCamara ? "Toca para tomar la foto" : "Toca para elegir una foto"}
          <span className="block text-xs font-normal text-ink-soft">
            {soloCamara ? "Foto en vivo con tu cámara · JPG, PNG o WebP" : "JPG, PNG o WebP · máx 8 MB"}
          </span>
        </span>
      </label>
      <input
        id={id}
        type="file"
        accept="image/*"
        capture={soloCamara ? "environment" : undefined}
        disabled={disabled}
        className="sr-only"
        onChange={(e) => {
          const f = e.target.files?.[0] ?? null;
          if (!f) return;
          const err = fotoValida(f);
          if (err) {
            setError(err);
            onFile(null);
            return;
          }
          setError("");
          onFile(f);
        }}
      />
      {error && (
        <p className="mt-1.5 text-xs font-semibold text-[#a34d00]">{error}</p>
      )}
    </div>
  );
}

/* Mini-calendario — domingos y días pasados deshabilitados. */
function MiniCalendario({
  value,
  onChange,
  minima,
}: {
  value: string;
  onChange: (v: string) => void;
  /** Primera fecha reservable (YYYY-MM-DD) según el lead time del local. */
  minima: string;
}) {
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
          // Lead time: los días anteriores al mínimo no se pueden pedir.
          const muyPronto = iso(dia) < minima;
          const deshabilitado = esDomingo || esPasado || muyPronto;
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
  | "cuantos" | "nombre" | "raza" | "edad" | "primera" | "peso" | "tamano"
  | "contextura" | "pelo" | "salud" | "temperamento" | "zonas" | "fotos" | "cita";

/** Pasos que se repiten por perrito, en orden. */
const PASOS_PERRO: { id: PasoId; pregunta: string; hint?: string }[] = [
  { id: "nombre", pregunta: "¿Cómo se llama tu perro o perra?" },
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
  { id: "fotos", pregunta: "Una fotito 📸", hint: "Así el equipo llega preparado y tu descuento queda validado" },
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

interface FotosPerro {
  actual: File | null;
  referencia: File | null;
  /** El cliente no tiene al perrito cerca ahora — el equipo toma antes/después en el local. */
  sinPerroCerca: boolean;
}

interface CuponAplicado {
  codigo: string;
  pct: number;
  etiqueta: string;
}

// ─── Main ──────────────────────────────────────────────────────────────────

export function FormReserva({
  initialServicio = "",
  initialFecha = "",
  contacto,
}: {
  initialServicio?: string;
  initialFecha?: string;
  /** Datos del perfil, o null si reserva sin cuenta: en ese caso se piden
      en el último paso (PRP-003 F1). */
  contacto: { nombre: string; email: string; telefono: string; comuna: string } | null;
}) {
  /* Posición global: paso "cuantos" → perros[i] × PASOS_PERRO → "cita" */
  const [fase, setFase] = useState<"cuantos" | "perro" | "cita">("cuantos");
  const [dogIdx, setDogIdx] = useState(0);
  const [step, setStep] = useState(0);
  const [cantidad, setCantidad] = useState(1);

  const tieneCuenta = contacto !== null;

  /* Con cuenta el contacto viene del perfil y no se pregunta; sin cuenta se
     completa en el paso final y vive en este estado. */
  const [datosContacto, setDatosContacto] = useState<DatosContacto>(() =>
    contacto
      ? {
          nombre: contacto.nombre,
          telefono: contacto.telefono,
          email: contacto.email,
          comuna: contacto.comuna,
        }
      : CONTACTO_VACIO
  );
  const [errorContacto, setErrorContacto] = useState("");
  /** Ofertas vigentes y cuántas visitas lleva quien reserva (PRP-003 F3). */
  const [ofertas, setOfertas] = useState<Oferta[]>([]);
  const [visitasPrevias, setVisitasPrevias] = useState(0);

  const contactoData = {
    contactoNombre: datosContacto.nombre,
    contactoEmail: datosContacto.email,
    contactoTelefono: datosContacto.telefono,
  };

  const [perros, setPerros] = useState<FormData[]>([
    { ...FORM_INITIAL, ...contactoData },
  ]);
  const [fotos, setFotos] = useState<FotosPerro[]>([
    { actual: null, referencia: null, sinPerroCerca: false },
  ]);
  /* Perritos guardados de la cuenta y qué ficha existente ocupa cada slot
     del formulario (null = perrito nuevo, se crea al reservar). */
  const [misPerros, setMisPerros] = useState<PerroGuardado[]>([]);
  const [perroIds, setPerroIds] = useState<(string | null)[]>([null]);
  const [fechaDeseada, setFechaDeseada] = useState(
    /^\d{4}-\d{2}-\d{2}$/.test(initialFecha) ? initialFecha : ""
  );
  const [servicio, setServicio] = useState(
    SERVICIOS.includes(initialServicio) ? initialServicio : ""
  );

  const [esPrimeraCita, setEsPrimeraCita] = useState(false);
  /** Bloque horario elegido (Fase 5). Sin él no se puede enviar. */
  const [inicioElegido, setInicioElegido] = useState<string | null>(null);
  const [fechaMinima, setFechaMinima] = useState<string>(() => hoyEnSantiago());
  const [cuponInput, setCuponInput] = useState("");
  const [cupon, setCupon] = useState<CuponAplicado | null>(null);
  const [cuponError, setCuponError] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [solicitudEstado, setSolicitudEstado] = useState<"idle" | "registrada" | "error">("idle");

  // Lead time real del local: hasta que llegue, el calendario usa hoy (no
  // se adelanta a bloquear días que quizá sí se pueden pedir).
  useEffect(() => {
    let cancelado = false;
    obtenerDisponibilidad(createClient())
      .then(({ config }) => {
        if (!cancelado) setFechaMinima(primeraFechaReservable(config));
      })
      .catch(() => {
        /* Sin config, queda el valor de hoy: el servidor igual valida. */
      });
    return () => {
      cancelado = true;
    };
  }, []);

  /* Los perros guardados de quien reserva. RLS ya limita la consulta a los
     propios; el `tieneCuenta` evita el viaje inútil del visitante anónimo.
     Se deduplican por nombre —la versión anterior del sistema creaba una
     ficha por reserva, así que "Filu" puede existir cinco veces— quedándose
     con la más reciente, que es la que tiene los datos al día. */
  useEffect(() => {
    if (!tieneCuenta) return;
    let cancelado = false;
    createClient()
      .from("perros")
      .select("id, nombre, raza, peso_kg, contextura, tipo_pelo, temperamento, alergias")
      .order("created_at", { ascending: false })
      .then(({ data }) => {
        if (cancelado || !data) return;
        const vistos = new Set<string>();
        const unicos: PerroGuardado[] = [];
        for (const p of data as PerroGuardado[]) {
          const clave = p.nombre.trim().toLowerCase();
          if (!clave || vistos.has(clave)) continue;
          vistos.add(clave);
          unicos.push(p);
        }
        setMisPerros(unicos.slice(0, 6));
      });
    return () => {
      cancelado = true;
    };
  }, [tieneCuenta]);

  const tarifas = useTarifas();
  const tramos = useTramos();
  const tramosAltura = useTramosAltura();
  const ajustes = useAjustesPorTamano();
  // Los descuentos globales (cupón, primera cita) NO son por tamaño: se
  // muestran una sola vez para toda la reserva, que puede tener perritos
  // de portes distintos. Lo que sí varía por tamaño son los agregados del
  // perro (pelo, temperamento, zonas, cachorro) — ver `cfg` más abajo.
  const ajustesPrecio = ajustes.general;
  const autoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (autoTimer.current) clearTimeout(autoTimer.current);
  }, []);

  /* Ofertas vigentes: el texto y el descuento salen de la misma tabla, así
     que lo que se promete es lo que se cobra (PRP-003 F2). */
  useEffect(() => {
    let cancelado = false;
    obtenerOfertasActivas(createClient())
      .then((o) => {
        if (!cancelado) setOfertas(o);
      })
      .catch(() => {
        /* Sin ofertas se cotiza sin descuento; nunca se inventa uno. */
      });
    return () => {
      cancelado = true;
    };
  }, []);

  /* Descuento de bienvenida: primera cita de la CUENTA.

     El guard de `tieneCuenta` no es un detalle: sin sesión esta consulta
     devuelve 0 por RLS —no porque sea su primera visita—, así que sin él
     todo visitante anónimo se llevaría el descuento de bienvenida. Es el
     beneficio de registrarse; quien no se registra reserva igual, pero sin
     él (decisión del señor Ignacio, 26-jul). */
  useEffect(() => {
    if (!tieneCuenta) return;
    const supabase = createClient();
    supabase
      .from("sesiones")
      .select("id", { count: "exact", head: true })
      .then(({ count, error }) => {
        if (error) return;
        setVisitasPrevias(count ?? 0);
        if (count === 0) setEsPrimeraCita(true);
      });
  }, [tieneCuenta]);

  const data = perros[dogIdx];

  const upd = useCallback((key: keyof FormData, value: string) => {
    setPerros((prev) =>
      prev.map((p, i) => (i === dogIdx ? { ...p, [key]: value } : p))
    );
  }, [dogIdx]);

  const totalPasosPerro = PASOS_PERRO.length;
  const pasoGlobal =
    fase === "cuantos"
      ? 0
      : fase === "perro"
        ? 1 + dogIdx * totalPasosPerro + step
        : 1 + cantidad * totalPasosPerro;
  const totalGlobal = 1 + cantidad * totalPasosPerro + 1;

  /* Se enciende cuando el cliente pulsa "Siguiente" con algo sin llenar.
     Mientras esté apagado no se le reclama nada. */
  const [intentoAvanzar, setIntentoAvanzar] = useState(false);

  /* Si por lo que sea no se logró abrir WhatsApp, el cliente NO puede
     quedarse sin manera de mandar su mensaje: se guarda el enlace y se le
     ofrece un botón. Le pasó al señor Ignacio probando en el celular —vio
     "tu mensaje salió igual" y no había salido nada—. */
  const [urlWhatsApp, setUrlWhatsApp] = useState("");

  /* Compartir la foto por la hoja del sistema (PRP-002 F6, vía B). */
  const [avisoCompartir, setAvisoCompartir] = useState("");
  const [puedeCompartir, setPuedeCompartir] = useState(false);

  const avanzar = useCallback(() => {
    if (fase === "cuantos") {
      setFase("perro");
      return;
    }
    if (fase === "perro") {
      if (step < totalPasosPerro - 1) {
        setStep((s) => s + 1);
      } else if (dogIdx < cantidad - 1) {
        setDogIdx((i) => i + 1);
        setStep(0);
      } else {
        setFase("cita");
      }
    }
  }, [fase, step, dogIdx, cantidad, totalPasosPerro]);

  /* Deja prolijo lo que el cliente escribió a mano. Se hace al cambiar de
     paso y no en cada tecla: corregir mientras alguien escribe le mueve el
     cursor y se siente como pelear con el teclado. */
  const ordenarTextos = useCallback(() => {
    setPerros((prev) =>
      prev.map((p, i) =>
        i === dogIdx
          ? {
              ...p,
              nombrePerro: capitalizarNombre(p.nombrePerro),
              razaOtro: capitalizarNombre(p.razaOtro),
              tipoPeloOtro: capitalizarFrase(p.tipoPeloOtro),
              cualAlergia: capitalizarFrase(p.cualAlergia),
            }
          : p
      )
    );
  }, [dogIdx]);

  const retroceder = useCallback(() => {
    setIntentoAvanzar(false);
    if (fase === "cita") {
      setFase("perro");
      setDogIdx(cantidad - 1);
      setStep(totalPasosPerro - 1);
      return;
    }
    if (fase === "perro") {
      if (step > 0) {
        setStep((s) => s - 1);
      } else if (dogIdx > 0) {
        setDogIdx((i) => i - 1);
        setStep(totalPasosPerro - 1);
      } else {
        setFase("cuantos");
      }
    }
  }, [fase, step, dogIdx, cantidad, totalPasosPerro]);

  const updYAvanzar = useCallback((key: keyof FormData, value: string) => {
    upd(key, value);
    if (autoTimer.current) clearTimeout(autoTimer.current);
    autoTimer.current = setTimeout(avanzar, AUTO_ADVANCE_MS);
  }, [upd, avanzar]);

  const elegirCantidad = useCallback((n: number) => {
    setCantidad(n);
    setPerros((prev) => {
      const next = [...prev];
      while (next.length < n) next.push({ ...FORM_INITIAL, ...contactoData });
      return next.slice(0, Math.max(n, 1));
    });
    setFotos((prev) => {
      const next = [...prev];
      while (next.length < n) next.push({ actual: null, referencia: null, sinPerroCerca: false });
      return next.slice(0, Math.max(n, 1));
    });
    /* Mismo resize que `perros`: cada slot recuerda qué ficha guardada lo
       llenó. Sin esto, achicar y volver a agrandar desalinearía los ids y
       la reserva actualizaría la ficha del perro equivocado. */
    setPerroIds((prev) => {
      const next = [...prev];
      while (next.length < n) next.push(null);
      return next.slice(0, Math.max(n, 1));
    });
    if (autoTimer.current) clearTimeout(autoTimer.current);
    autoTimer.current = setTimeout(() => setFase("perro"), AUTO_ADVANCE_MS);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* Tocar un perrito guardado lo incluye (o lo saca) de la reserva. La
     selección arma los primeros slots del formulario con la ficha
     precargada; los botones 1/2/3 siguen sirviendo para sumar un perrito
     nuevo además de los guardados. */
  const alternarPerroGuardado = useCallback(
    (elegido: PerroGuardado) => {
      if (autoTimer.current) clearTimeout(autoTimer.current);
      const yaIds = perroIds.filter((id): id is string => id !== null);
      const ids = yaIds.includes(elegido.id)
        ? yaIds.filter((id) => id !== elegido.id)
        : [...yaIds, elegido.id];
      if (ids.length > MAX_PERROS) return;

      const seleccion = ids
        .map((id) => misPerros.find((m) => m.id === id))
        .filter((m): m is PerroGuardado => Boolean(m));
      const n = Math.max(1, seleccion.length);

      setCantidad(n);
      setPerros(() => {
        const next = seleccion.map((pg) => ({
          ...FORM_INITIAL,
          ...contactoData,
          ...perroAFormData(pg),
        }));
        while (next.length < n) next.push({ ...FORM_INITIAL, ...contactoData });
        return next;
      });
      setPerroIds(() => {
        const next: (string | null)[] = seleccion.map((pg) => pg.id);
        while (next.length < n) next.push(null);
        return next;
      });
      setFotos(() => {
        const next: FotosPerro[] = seleccion.map(() => ({
          actual: null,
          referencia: null,
          sinPerroCerca: false,
        }));
        while (next.length < n) next.push({ actual: null, referencia: null, sinPerroCerca: false });
        return next;
      });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [perroIds, misPerros]
  );

  // ── Cálculos por perrito ────────────────────────────────────────────────
  /* Descuento global: cupón u oferta, NUNCA los dos (PRP-003 F3).
     Acumularlos puede dejar el precio bajo el costo, así que gana el mayor.
     La oferta sale de la tabla `ofertas` — el mismo dato que ve el cliente
     en la invitación, así que lo prometido es lo que se cobra. */
  /* Se compara contra el mismo precio que se va a cobrar (el del tramo), no
     contra el de la tabla vieja: si difieren, un porcentaje de descuento se
     calcularía sobre una base que el cliente nunca ve. */
  const pesoParaComparar = parseFloat(data.pesoKg) || 10;
  const baseParaComparar =
    precioDe(tramos, pesoParaComparar) ?? tarifas.base[detectarTamanoPorPeso(pesoParaComparar)];
  const ofertaVigente = mejorOferta(
    ofertas,
    { conCuenta: tieneCuenta, visitasPrevias },
    baseParaComparar
  );

  const descuentoDeOferta: AjustePrecio | null = ofertaVigente
    ? comoAjuste(ofertaVigente)
    : null;
  const descuentoDeCupon: AjustePrecio | null = cupon
    ? { etiqueta: cupon.etiqueta, pct: -Math.abs(cupon.pct) }
    : null;

  const descuentoGlobal: AjustePrecio | null =
    descuentoDeCupon && descuentoDeOferta
      ? // Ambos disponibles: gana el que más descuenta sobre esta base.
        Math.abs(montoDeAjuste(descuentoDeCupon, baseParaComparar)) >=
        Math.abs(montoDeAjuste(descuentoDeOferta, baseParaComparar))
        ? descuentoDeCupon
        : descuentoDeOferta
      : (descuentoDeCupon ?? descuentoDeOferta);

  const estimadoDe = useCallback(
    (d: FormData): { estimado: EstimadoVivo | null; esManual: boolean } => {
      const peso = parseFloat(d.pesoKg);
      const pesoOk = !isNaN(peso) && peso > 0.4 && peso <= 120;
      const esManual = !!(
        d.tamanoDeclarado && pesoOk && hayConflicto(d.tamanoDeclarado as TamanoKey, peso)
      );
      if (!pesoOk) return { estimado: null, esManual };

      const edadMeses = (parseInt(d.edadAnios) || 0) * 12 + (parseInt(d.edadMeses) || 0);
      const razaJoven =
        edadMeses > 0 && edadMeses <= EDAD_CACHORRO_MESES
          ? CATALOGO_RAZAS.find((r) => r.nombre === d.raza) ?? null
          : null;
      const tamanoAuto = detectarTamanoPorPeso(peso);
      const baseCachorro =
        razaJoven && razaJoven.tamano !== tamanoAuto ? tarifas.base[razaJoven.tamano] : null;

      // Tamaño con el que se cobra: el de la raza adulta si es cachorro de
      // raza conocida, si no el detectado por peso. Los agregados salen de
      // ESE tamaño (migración 009) — heredan el general si no hay excepción.
      const tamanoCobrado = razaJoven && razaJoven.tamano !== tamanoAuto ? razaJoven.tamano : tamanoAuto;
      const cfg = ajustes.porTamano[tamanoCobrado] ?? ajustes.general;

      const extra: AjustePrecio[] = [];
      if (baseCachorro) extra.push(cfg.descuentoCachorro);
      if (descuentoGlobal) extra.push(descuentoGlobal);

      /* Ajuste por altura (migración 033). Se resuelve acá y no dentro de
         `calcularEstimado` porque depende de los tramos que vienen de la base.
         La altura es opcional en el formulario: si no la pusieron, o si el
         tramo está en 0%, `ajusteDeAltura` devuelve null y no se cobra nada. */
      const ajusteAltura = ajusteDeAltura(tramosAltura, parseFloat(d.alturaCmd));
      if (ajusteAltura) extra.push(ajusteAltura);

      return {
        /* El precio base sale del TRAMO por peso (migración 026), no del tamaño.
           Ése era el defecto que encontró el cliente probando la página: un
           perrito de 8 kg caía en "Pequeño (6–10 kg)" y cobraba $20.000 cuando
           corresponden $25.000–$30.000. Con cinco escalones, los bordes siempre
           cobran de menos.

           El orden de los `??` importa y no es casual:
           1. `baseCachorro` manda cuando es cachorro de raza conocida — se cobra
              por el tamaño que va a tener de adulto, no por lo que pesa hoy.
           2. si no, el tramo que corresponde a su peso real.
           3. si no hay tramos (base caída), la tabla por tamaño. Cobrar de menos
              es mejor que no poder cotizar, pero nunca es la primera opción. */
        estimado: calcularEstimado(
          d,
          baseCachorro ?? precioDe(tramos, peso) ?? tarifas.base[tamanoAuto],
          extra,
          cfg
        ),
        esManual,
      };
    },
    // `tramos` va en las dependencias o el estimado se queda con la tabla que
    // había al montar: el admin cambiaría un precio y el formulario seguiría
    // cotizando el viejo hasta recargar. Lo mismo para `tramosAltura`.
    [tarifas, tramos, tramosAltura, ajustes, descuentoGlobal]
  );

  const actual = estimadoDe(data);
  const peso = parseFloat(data.pesoKg);
  const pesoValido = !isNaN(peso) && peso > 0.4 && peso <= 120;
  const pesoInvalido = data.pesoKg !== "" && !pesoValido;
  const tamanoAuto = pesoValido ? detectarTamanoPorPeso(peso) : null;

  const resumen = perros.slice(0, cantidad).map((p) => estimadoDe(p));
  const totalEstimado = resumen.reduce((acc, r) => acc + (r.estimado?.total ?? 0), 0);
  const algunoManual = resumen.some((r) => r.esManual);

  const paso = fase === "perro" ? PASOS_PERRO[step] : null;
  const fotoActualFalta =
    fase === "perro" &&
    paso?.id === "fotos" &&
    !fotos[dogIdx]?.actual &&
    !fotos[dogIdx]?.sinPerroCerca;
  /* Qué falta en este paso, dicho con palabras. El botón apagado sin
     explicación se siente como una página rota: hay que decir por qué. */
  const faltaAqui = paso ? faltaEnPaso(paso.id, data) : null;
  const bloqueaAvance = Boolean(faltaAqui) || fotoActualFalta;

  /* ── Compartir la foto (PRP-002 F6, vía B) ─────────────────────────
     La pregunta se hace en un efecto y no durante el render porque
     `navigator.canShare` es una API del navegador: en el servidor no
     existe, y consultarla al renderizar rompería la hidratación. */
  const fotosParaCompartir = fotos
    .slice(0, cantidad)
    .flatMap((f) => [f?.actual, f?.referencia])
    .filter((f): f is File => Boolean(f));

  useEffect(() => {
    setPuedeCompartir(puedeCompartirFotos(fotosParaCompartir));
    // La lista se recalcula en cada render; lo que importa es cuántas hay.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fotosParaCompartir.length]);

  const compartirLaFoto = async () => {
    setAvisoCompartir("");
    /* Se llama DENTRO del click, no dentro de un `then`: los navegadores
       exigen que la hoja de compartir salga de un gesto del usuario. */
    const r = await compartirFotos(
      fotosParaCompartir,
      `Foto de ${perros[0]?.nombrePerro || "mi perrito"} para la cita en Perrustingo 🐾`
    );
    if (!r.ok && r.error) setAvisoCompartir(r.error);
  };

  /* Un solo lugar decide si se puede pasar de paso. Va acá y no más arriba
     porque necesita `bloqueaAvance`, que depende del paso actual. */
  const intentarAvanzar = () => {
    if (bloqueaAvance) {
      setIntentoAvanzar(true);
      return;
    }
    setIntentoAvanzar(false);
    ordenarTextos();
    avanzar();
  };

  // ── Cupón ───────────────────────────────────────────────────────────────
  const validarCupon = useCallback(async () => {
    const codigo = cuponInput.trim().toUpperCase();
    if (!codigo) return;
    setCuponError("");
    try {
      const supabase = createClient();
      const { data: fila, error } = await supabase
        .from("cupones")
        .select("codigo, descripcion, descuento_pct")
        .eq("codigo", codigo)
        .maybeSingle();
      if (error || !fila) {
        setCuponError("Ese cupón no existe o ya no está activo.");
        return;
      }
      setCupon({
        codigo: fila.codigo,
        pct: fila.descuento_pct,
        etiqueta: fila.descripcion || `Cupón ${fila.codigo}`,
      });
    } catch {
      setCuponError("No pudimos validar el cupón. Intenta de nuevo.");
    }
  }, [cuponInput]);

  // ── Confirmar: sube fotos, registra en DB y abre WhatsApp ───────────────
  const confirmarReserva = useCallback(() => {
    // Sin bloque elegido no se envía: mandar solo el día volvería al
    // problema que la Fase 5 vino a resolver (nadie sabe a qué hora es).
    if (!fechaDeseada || !inicioElegido || !servicio || enviando) return;

    // Sin cuenta, el contacto lo escribe la persona: hay que validarlo antes
    // de crear la cita (el servidor vuelve a validarlo igual).
    if (!tieneCuenta) {
      const problema = validarContacto(datosContacto);
      if (problema) {
        setErrorContacto(problema);
        return;
      }
      setErrorContacto("");
    }
    setEnviando(true);

    /* ── Primero el destinatario correcto, después la foto ─────────────

       El 27-jul se probó desde el celular del señor Ignacio y apareció el
       problema que manda en este diseño: la hoja de compartir del teléfono
       —el único camino por el que una web puede meter una imagen dentro de
       un chat— NO permite fijar a quién se le manda. Abre WhatsApp y pide
       elegir un contacto. Si Perrustingo no está en la agenda del cliente,
       no lo encuentra, y el mensaje se pierde o le llega a otra persona.

       `wa.me/<numero>` sí fija el destinatario: abre el chat del salón
       aunque el cliente nunca lo haya agendado. Lo que no puede es llevar
       archivos.

       Entre "llega con foto pero quizá a nadie" y "llega seguro al salón,
       con la foto a un clic de distancia", manda lo segundo. La foto no se
       pierde: se sube al servidor y queda en la ficha de la cita, que es
       donde el equipo la mira para preparar el corte. El mensaje lleva el
       enlace a esa ficha, y después de enviarlo queda el botón para adjuntar
       la imagen al chat si el cliente quiere. */

    /* Sin número configurado no se abre nada. Antes había uno de prueba
       escrito en el código y las reservas se le mandaban a un desconocido:
       preferible que el cliente vea "no pudimos abrir WhatsApp" —su reserva
       queda igual en el panel— a que sus datos salgan hacia cualquier lado. */
    const win = hayWhatsAppConfigurado() ? window.open("about:blank", "_blank") : null;

    void (async () => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      const perrosPayload = await Promise.all(
        perros.slice(0, cantidad).map(async (p, i) => {
          const { estimado, esManual } = estimadoDe(p);
          const f = fotos[i];
          /* Rutas del bucket, no URLs: desde PRP-002 F4 las fotos son
             privadas y el enlace se firma al mirarlas. */
          /* Se sube haya o no sesión. Antes esto era `user ? ... : [null,null]`
             y el resultado fue que la foto del cliente NO se guardaba nunca
             en el camino sin cuenta —que es el camino normal—. Lo descubrió
             el señor Ignacio probando desde el celular: adjuntó la foto, la
             reserva se creó, y en la base había cero fotos. */
          const [fotoActualRuta, fotoReferenciaRuta] = await Promise.all([
            f?.actual ? subirFotoReserva(supabase, user?.id ?? null, f.actual, i, "actual") : null,
            f?.referencia
              ? subirFotoReserva(supabase, user?.id ?? null, f.referencia, i, "referencia")
              : null,
          ]);
          return {
            detalle: construirDetalle(p),
            precioEstimado: estimado?.total ?? null,
            esManual,
            fotoActualRuta,
            fotoReferenciaRuta,
            /* La ficha guardada que este slot reutiliza: el servidor la
               ACTUALIZA en vez de crear un duplicado. */
            perroId: perroIds[i] ?? null,
            ficha: {
              nombre: p.nombrePerro,
              raza: p.raza === "Otro" ? p.razaOtro || "Otro" : p.raza,
              pesoKg: pesoDe(p),
              contextura: p.contextura || null,
              tipoPelo: p.tipoPelo || null,
              temperamento: normalizarTemperamento(p.temperamentoGeneral),
              alergias: p.tieneAlergia === "si" ? p.cualAlergia || "sí" : null,
            },
          };
        })
      );

      /* Antes este POST no se esperaba: el mensaje de WhatsApp se armaba en
         paralelo. Ahora hay que esperar la respuesta para poder incluir el
         enlace a la ficha (PRP-002 F6), y eso trae un riesgo que hay que
         tratar con cuidado: si el servidor tarda o falla, el cliente se
         queda mirando una pestaña en blanco.

         Por eso la espera tiene tope. Pasado ese tope el mensaje SALE IGUAL,
         solo que sin enlace. El WhatsApp es el canal real del negocio:
         perder la conversación es mucho peor que perder un enlace. */
      const peticion = fetch("/api/reservas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        keepalive: true,
        body: JSON.stringify({
          contacto: {
            nombre: datosContacto.nombre,
            email: datosContacto.email,
            telefono: datosContacto.telefono,
            comuna: datosContacto.comuna,
          },
          fechaDeseada,
          inicio: inicioElegido,
          servicio,
          ofertaId: ofertaVigente?.id ?? null,
          cupon: descuentoGlobal
            ? {
                codigo: cupon?.codigo ?? "PRIMERA_CITA",
                pct: Math.abs(descuentoGlobal.pct),
              }
            : null,
          perros: perrosPayload,
        }),
      });

      let idsCreadas: string[] = [];
      try {
        const r = await Promise.race([
          peticion,
          new Promise<null>((resolve) => setTimeout(() => resolve(null), ESPERA_RESERVA_MS)),
        ]);

        if (r) {
          setSolicitudEstado(r.ok || r.status === 503 ? "registrada" : "error");
          if (r.ok) {
            const cuerpo = await r.json().catch(() => null);
            idsCreadas = cuerpo?.data?.ids ?? [];
          }
        } else {
          /* Se acabó la espera. La reserva puede estar creándose igual
             (keepalive), así que no se declara error: se sigue sin enlace. */
          void peticion.then((tardia) =>
            setSolicitudEstado(tardia.ok || tardia.status === 503 ? "registrada" : "error")
          );
        }
      } catch {
        setSolicitudEstado("error");
      }

      /* "Hay fotos" = se subió alguna DE VERDAD, no que el cliente eligió un
         archivo. Sin cuenta la subida no ocurre (la policy de storage exige
         un uid), así que mirar el File del formulario haría que el mensaje
         prometiera fotos que el equipo no va a encontrar en la ficha. */
      const hayFotos = perrosPayload.some(
        (p) => p.fotoActualRuta || p.fotoReferenciaRuta
      );

      /* Las fotos van DENTRO del mensaje, como enlaces con vista previa. Es
         lo más cerca del adjunto que permite `wa.me`, y a diferencia de la
         hoja de compartir no depende de que el cliente elija bien el chat.

         Solo se enlaza lo que existe de verdad: cada entrada se arma con la
         ruta que volvió de la subida y con el id que devolvió el servidor.
         Un enlace a una foto que no se guardó le muestra al equipo un 404 y
         le enseña a no abrirlos más. */
      const fotosDelMensaje: FotoEnMensaje[] = idsCreadas
        .map((sesionId, i) => {
          const p = perrosPayload[i];
          const tipos: ("antes" | "referencia")[] = [];
          if (p?.fotoActualRuta) tipos.push("antes");
          if (p?.fotoReferenciaRuta) tipos.push("referencia");
          return {
            sesionId,
            nombre: perros[i]?.nombrePerro?.trim() || `perrito ${i + 1}`,
            tipos,
          };
        })
        .filter((f) => f.tipos.length > 0);

      const mensaje = conEnlacesFoto(
        conEnlaceFicha(
          buildWhatsAppMessageMulti(
            perros.slice(0, cantidad).map((p) => {
              const { estimado, esManual } = estimadoDe(p);
              return { data: p, esManual, estimado };
            }),
            { fechaDeseada, servicio, contactoNombre: datosContacto.nombre }
          ),
          idsCreadas.length > 0
            ? { origen: window.location.origin, ids: idsCreadas, conFotos: hayFotos }
            : null
        ),
        window.location.origin,
        fotosDelMensaje
      );
      if (!hayWhatsAppConfigurado()) {
        setAvisoCompartir(
          "Tu solicitud quedó registrada, pero no pudimos abrir WhatsApp desde el sitio. El equipo la ve en su panel y te contactará."
        );
        setEnviando(false);
        return;
      }

      const waUrl = WHATSAPP_BASE + encodeURIComponent(mensaje);
      // Se guarda SIEMPRE, antes de intentar abrir nada.
      setUrlWhatsApp(waUrl);
      if (win) {
        win.location.href = waUrl;
      } else {
        /* El navegador bloqueó la pestaña (pasa en iOS cuando el clic quedó
           lejos en el tiempo). Se navega en la misma: perder la pestaña es
           molesto, perder el mensaje es perder la reserva. */
        window.location.href = waUrl;
      }
      setEnviando(false);
    })();
    /* Las dependencias tienen que estar TODAS.

       Faltaban `inicioElegido`, `datosContacto`, `tieneCuenta` y
       `ofertaVigente`, y eso no era cosmético: el callback se quedaba con
       el valor viejo de `inicioElegido` (null), entraba al guard de la
       primera línea y salía sin hacer nada. El botón se veía habilitado
       —porque el render sí tenía el valor nuevo—, no aparecía ningún error
       en consola, y la reserva simplemente no ocurría.

       Lo encontré probando F6: la primera reserva funcionó y las siguientes
       "no hacían nada". En manos de un cliente eso es apretar Confirmar,
       ver que no pasa nada, y cerrar la página. */
  }, [
    fechaDeseada,
    inicioElegido,
    servicio,
    enviando,
    perros,
    cantidad,
    fotos,
    /* `perroIds` va acá por la MISMA razón que cuenta el comentario de
       arriba: sin él, el callback capturaría la selección vieja y la
       reserva crearía un duplicado en vez de reutilizar la ficha. */
    perroIds,
    estimadoDe,
    tieneCuenta,
    datosContacto,
    ofertaVigente,
    cupon,
    descuentoGlobal,
  ]);

  /* El perrito acompaña el formulario */
  const razaSel = CATALOGO_RAZAS.find((r) => r.nombre === data.raza);
  const acompanante = razaSel
    ? { src: razaImagen(razaSel.slug), nombre: razaSel.nombre }
    : data.tamanoDeclarado
      ? { src: TAMANO_IMAGEN[data.tamanoDeclarado as TamanoKey], nombre: TAMANO_LABELS[data.tamanoDeclarado as TamanoKey] }
      : null;

  const tituloPerro = cantidad > 1 ? `Perrito ${dogIdx + 1} de ${cantidad}` : null;

  return (
    <div className="mx-auto w-full max-w-lg">
      {/* Progreso */}
      <div className="mb-6 flex items-center gap-3">
        {acompanante && fase === "perro" && (
          <BreedAvatar src={acompanante.src} nombre={acompanante.nombre} size="sm" />
        )}
        <div className="h-2 flex-1 overflow-hidden rounded-full bg-ink/10">
          <div
            className="h-full rounded-full bg-teal transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)]"
            style={{ width: `${((pasoGlobal + 1) / totalGlobal) * 100}%` }}
            role="progressbar"
            aria-valuenow={pasoGlobal + 1}
            aria-valuemin={1}
            aria-valuemax={totalGlobal}
            aria-label={`Paso ${pasoGlobal + 1} de ${totalGlobal}`}
          />
        </div>
        <span className="text-xs font-bold text-ink-soft">
          {pasoGlobal + 1}/{totalGlobal}
        </span>
      </div>

      {/* Descuento activo */}
      {descuentoGlobal && fase !== "cuantos" && (
        <div className="mb-4 flex items-center gap-2 rounded-2xl bg-[#d8f0e3] px-4 py-2.5 text-sm font-bold text-teal-ink">
          <span aria-hidden="true">🎁</span>
          {descuentoGlobal.pct}% — {descuentoGlobal.etiqueta}
        </div>
      )}

      {/* Estimado en vivo del perrito activo */}
      {actual.estimado && fase === "perro" && step > 0 && (
        <div
          aria-live="polite"
          className="sticky top-20 z-30 mb-5 rounded-2xl bg-teal-ink px-5 py-3.5 text-white shadow-lg"
        >
          <div className="flex items-center justify-between gap-3">
            <span className="text-xs font-bold uppercase tracking-wide opacity-80">
              💰 Estimado {cantidad > 1 ? `· ${data.nombrePerro || `perrito ${dogIdx + 1}`}` : "en vivo"}
            </span>
            <span className="font-display text-xl font-extrabold">
              {formatRangoCLP(actual.estimado.total)}
            </span>
          </div>
          {actual.estimado.ajustes.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              <span className="rounded-full bg-white/15 px-2.5 py-0.5 text-[11px] font-semibold">
                Base {formatCLP(actual.estimado.base)}
              </span>
              {actual.estimado.ajustes.map((a) => (
                <span
                  key={a.etiqueta}
                  className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold text-teal-ink ${
                    (a.monto ?? a.pct) < 0 ? "bg-[#b8e4cd]" : "bg-orange/90"
                  }`}
                >
                  {textoDeAjuste(a)} {a.etiqueta}
                </span>
              ))}
            </div>
          )}
          <p className="mt-1.5 text-[11px] leading-snug opacity-70">
            Referencial — el valor final se confirma en la puerta.
          </p>
        </div>
      )}

      {/* Pantalla del paso */}
      <div key={`${fase}-${dogIdx}-${step}`} className="rise-in rounded-3xl bg-white p-7 shadow-sm">
        {tituloPerro && fase === "perro" && (
          <p className="mb-1 text-xs font-extrabold uppercase tracking-[0.18em] text-teal-dark">
            {tituloPerro}
          </p>
        )}
        <h2 className="font-display text-2xl font-extrabold leading-snug tracking-tight text-ink">
          {fase === "cuantos"
            ? "¿Cuántos perritos vienen? 🐶"
            : fase === "cita"
              ? "¡Último paso! Tu cita"
              : paso!.pregunta}
        </h2>
        {fase === "cuantos" && (
          <p className="mt-1 text-sm text-ink-soft">
            Llenamos una ficha por cada uno — así el equipo los recibe listos.
          </p>
        )}
        {fase === "perro" && paso!.hint && (
          /* El paso de fotos prometía "tu descuento queda validado" a todo el
             mundo — incluido quien acaba de elegir reservar SIN cuenta, que
             es justamente quien no tiene ese descuento. Prometer un beneficio
             que no va a llegar se paga en la puerta del local. */
          <p className="mt-1 text-sm text-ink-soft">
            {paso!.id === "fotos" && !tieneCuenta
              ? "Así el equipo llega preparado y sabe qué esperar"
              : paso!.hint}
          </p>
        )}

        <div className="mt-6">
          {fase === "cuantos" && misPerros.length > 0 && (
            <div className="mb-6">
              <p className="text-sm font-bold text-ink">
                ¿Viene alguno de tus perros guardados? Tócalo y su ficha queda
                lista — solo revisas y confirmas.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {misPerros.map((pg) => {
                  const elegido = perroIds.includes(pg.id);
                  return (
                    <button
                      key={pg.id}
                      type="button"
                      onClick={() => alternarPerroGuardado(pg)}
                      aria-pressed={elegido}
                      className={`rounded-full border-2 px-4 py-2 text-sm font-bold transition-colors ${
                        elegido
                          ? "border-teal bg-sky/40 text-teal-ink"
                          : "border-ink/10 bg-white text-ink hover:border-teal/30"
                      }`}
                    >
                      🐶 {pg.nombre}
                      {pg.raza ? ` · ${pg.raza}` : ""}
                      {elegido ? " ✓" : ""}
                    </button>
                  );
                })}
              </div>
              {perroIds.some((id) => id !== null) && (
                <button
                  type="button"
                  onClick={() => setFase("perro")}
                  className="mt-3 rounded-full bg-teal px-6 py-2.5 text-sm font-extrabold text-white transition-transform active:scale-95"
                >
                  Continuar con {perroIds.filter((id) => id !== null).length === 1 ? "1 perrito" : `${perroIds.filter((id) => id !== null).length} perritos`} →
                </button>
              )}
              <p className="mt-3 text-xs text-ink-soft">
                ¿Viene también uno nuevo? Elige el total acá abajo — los
                guardados se conservan.
              </p>
            </div>
          )}

          {fase === "cuantos" && (
            <div className="grid grid-cols-3 gap-3">
              {[1, 2, 3].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => elegirCantidad(n)}
                  aria-pressed={cantidad === n}
                  className={`flex flex-col items-center gap-1 rounded-2xl border-2 py-5 font-display text-2xl font-extrabold transition-[border-color,background-color,transform] duration-150 active:scale-95 ${
                    cantidad === n
                      ? "border-teal bg-sky/40 text-teal-ink"
                      : "border-ink/10 bg-white text-ink hover:border-teal/30"
                  }`}
                >
                  {n}
                  <span className="text-xs font-bold text-ink-soft">
                    {n === 1 ? "perrito" : "perritos"}
                  </span>
                </button>
              ))}
              <p className="col-span-3 text-center text-xs text-ink-soft">
                ¿Más de {MAX_PERROS}? Reserva por acá y lo coordinamos al contactarte.
              </p>
            </div>
          )}

          {fase === "perro" && paso!.id === "nombre" && (
            <Input
              id="nombrePerro"
              value={data.nombrePerro}
              onChange={(v) => upd("nombrePerro", v)}
              placeholder="Ej: Firulais"
              autoFocus
              onEnter={avanzar}
            />
          )}

          {fase === "perro" && paso!.id === "raza" && (
            <div className="space-y-4">
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

              {data.raza && data.raza !== "Otro" && razaSel && (
                <div className="rise-in flex items-center gap-4 rounded-2xl bg-sky/40 px-5 py-4">
                  <BreedAvatar src={razaImagen(razaSel.slug)} nombre={razaSel.nombre} size="lg" />
                  <p className="text-sm font-semibold text-teal-ink">
                    ¡Un <strong>{data.raza}</strong>
                    {data.nombrePerro ? ` como ${data.nombrePerro}` : ""}! Nos
                    encantan. Cuando estés listo, sigue con el botón de abajo.
                  </p>
                </div>
              )}
            </div>
          )}

          {fase === "perro" && paso!.id === "edad" && (
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

          {fase === "perro" && paso!.id === "primera" && (
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

          {fase === "perro" && paso!.id === "peso" && (
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
              {actual.estimado && tamanoAuto && !pesoInvalido && (
                <div className="rise-in flex items-center gap-4 rounded-2xl bg-[#d8f0e3] px-5 py-4 text-sm font-semibold text-teal-ink">
                  <BreedAvatar src={TAMANO_IMAGEN[tamanoAuto]} nombre={TAMANO_LABELS[tamanoAuto]} size="lg" />
                  <span>
                    ✅ <strong>{TAMANO_LABELS[tamanoAuto]}</strong>
                    <span className="block">
                      Precio estimado:{" "}
                      <strong>{formatRangoCLP(actual.estimado.total)}</strong>
                    </span>
                    <span className="mt-1 block text-xs font-normal opacity-80">{NOTA_PRECIOS}</span>
                  </span>
                </div>
              )}
            </div>
          )}

          {fase === "perro" && paso!.id === "tamano" && (
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

          {fase === "perro" && paso!.id === "contextura" && (
            <div className="grid gap-2">
              {(["delgado", "normal", "robusto"] as const).map((c) => (
                <ChoiceCard key={c} checked={data.contextura === c} onClick={() => updYAvanzar("contextura", c)}>
                  {c.charAt(0).toUpperCase() + c.slice(1)}
                </ChoiceCard>
              ))}
            </div>
          )}

          {fase === "perro" && paso!.id === "pelo" && (
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

          {fase === "perro" && paso!.id === "salud" && (
            <div className="space-y-5">
              {([
                ["unasEncarnadas", "Uñas encarnadas"],
                ["secrecionOcular", "Secreción ocular"],
                ["tieneAlergia", "¿Enfermedad o alergia?"],
              ] as [keyof FormData, string][]).map(([key, label]) => (
                /* "No lo sé" es una respuesta real (pedido del señor Ignacio,
                   27-jul): poca gente le ha revisado las uñas o los ojos a su
                   perro. Sin esa opción, quien no sabe marca "No" para poder
                   seguir — y ese "No" falso hace que el equipo no revise. */
                <div key={key} className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-bold text-ink">{label}</p>
                  <div className="flex gap-2">
                    {([
                      ["si", "Sí"],
                      ["no", "No"],
                      ["no_lo_se", "No lo sé"],
                    ] as const).map(([v, etiqueta]) => (
                      <Chip key={v} active={data[key] === v} onClick={() => upd(key, v)}>
                        {etiqueta}
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

          {fase === "perro" && paso!.id === "temperamento" && (
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

          {fase === "perro" && paso!.id === "zonas" && (
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

          {fase === "perro" && paso!.id === "fotos" && (
            <div className="space-y-5">
              {/* PRP-002 F2 — el aviso va SIEMPRE, no solo cuando el cliente
                  marca que no tiene al perrito cerca.

                  Es una cortesía y también una protección: en el local se
                  toman fotos del antes y el después como respaldo, y avisarlo
                  antes de reservar evita la conversación incómoda de después.
                  Se dice además qué NO se hace con ellas — quien deja una foto
                  de su perrita quiere saber que no va a terminar en redes. */}
              <div className="rounded-2xl bg-sky/30 px-4 py-3.5 text-xs leading-relaxed text-ink-soft">
                <p className="font-bold text-ink">📸 Cómo usamos las fotos</p>
                <p className="mt-1.5">
                  En el local tomamos una foto al llegar y otra al terminar. Es
                  el respaldo del trabajo hecho, para ti y para nosotros.
                </p>
                <p className="mt-1.5">
                  Son de uso interno del equipo: <strong>no se publican</strong>{" "}
                  ni se comparten con nadie más.
                </p>
              </div>

              <FotoPicker
                id={`foto-actual-${dogIdx}`}
                label={`Foto de ${data.nombrePerro || "tu perrito"} hoy`}
                hint="Cómo está su pelito ahora — nos ayuda a preparar la sesión"
                file={fotos[dogIdx]?.actual ?? null}
                onFile={(f) =>
                  setFotos((prev) =>
                    prev.map((x, i) => (i === dogIdx ? { ...x, actual: f } : x))
                  )
                }
                requerida
                soloCamara
                disabled={fotos[dogIdx]?.sinPerroCerca}
              />
              <label className="flex items-start gap-2.5 text-xs text-ink-soft">
                <input
                  type="checkbox"
                  className="mt-0.5 h-4 w-4 flex-none accent-teal-dark"
                  checked={fotos[dogIdx]?.sinPerroCerca ?? false}
                  onChange={(e) =>
                    setFotos((prev) =>
                      prev.map((x, i) =>
                        i === dogIdx
                          ? { ...x, sinPerroCerca: e.target.checked, actual: e.target.checked ? null : x.actual }
                          : x
                      )
                    )
                  }
                />
                No tengo a {data.nombrePerro || "mi perrito"} cerca ahora mismo
              </label>
              {fotos[dogIdx]?.sinPerroCerca && (
                <p className="rounded-2xl bg-sky/30 px-4 py-3 text-xs leading-relaxed text-ink-soft">
                  Sin problema, no es obligatoria. Igual le tomaremos una foto a{" "}
                  {data.nombrePerro || "tu perrito"} apenas llegue al local y
                  otra al terminar, para que quede el registro de la visita.
                </p>
              )}
              <FotoPicker
                id={`foto-ref-${dogIdx}`}
                label="Referencia del corte"
                hint="Una foto o idea del corte que te gustaría"
                file={fotos[dogIdx]?.referencia ?? null}
                onFile={(f) =>
                  setFotos((prev) =>
                    prev.map((x, i) => (i === dogIdx ? { ...x, referencia: f } : x))
                  )
                }
              />
              {fotoActualFalta && (
                <p className="text-xs font-semibold text-ink-soft">
                  Sube la foto o marca la casilla de arriba si no lo tienes
                  cerca{tieneCuenta ? " (la foto valida tu descuento de bienvenida)" : ""}.
                </p>
              )}
            </div>
          )}

          {fase === "cita" && (
            <div className="space-y-5">
              <div>
                <p className="mb-1 text-sm font-bold text-ink">Fechas disponibles</p>
                <p className="mb-2 text-xs text-ink-soft">
                  {/* Antes acá decía "confirmamos la hora exacta por
                      WhatsApp": desde la Fase 5 la hora la elige el
                      cliente y queda tomada, así que ese texto mentía. */}
                  Elija el día y la hora — el cupo queda reservado al enviar.{" "}
                  <a href="/agenda" className="font-bold text-teal-dark underline-offset-2 hover:underline">
                    Ver agenda semanal →
                  </a>
                </p>
                <MiniCalendario
                  value={fechaDeseada}
                  onChange={(v) => {
                    setFechaDeseada(v);
                    setInicioElegido(null);
                  }}
                  minima={fechaMinima}
                />
                <SelectorHorario
                  fecha={fechaDeseada}
                  valor={inicioElegido}
                  onChange={setInicioElegido}
                />
              </div>

              {/* Sin cuenta: los datos que con cuenta salen del perfil.
                  El equipo los necesita para confirmar por WhatsApp, y la
                  comuna alimenta las analíticas del negocio. */}
              {!tieneCuenta && (
                <div>
                  <p className="mb-1 text-sm font-bold text-ink">Tus datos</p>
                  <p className="mb-2 text-xs text-ink-soft">
                    Para confirmarte la hora por WhatsApp.{" "}
                    <a
                      href="/registro"
                      className="font-bold text-teal-dark underline-offset-2 hover:underline"
                    >
                      Crear una cuenta →
                    </a>
                  </p>

                  <div className="grid gap-2">
                    <div>
                      <label htmlFor="contacto-nombre" className="sr-only">
                        Tu nombre
                      </label>
                      <Input
                        id="contacto-nombre"
                        value={datosContacto.nombre}
                        onChange={(v) => {
                          setDatosContacto((d) => ({ ...d, nombre: v }));
                          setErrorContacto("");
                        }}
                        /* Se ordena al salir del campo, no mientras escribe:
                           corregirlo tecla a tecla le mueve el cursor. */
                        onBlur={() =>
                          setDatosContacto((d) => ({
                            ...d,
                            nombre: capitalizarNombre(d.nombre),
                          }))
                        }
                        placeholder="Tu nombre"
                      />
                    </div>

                    <div>
                      <label htmlFor="contacto-telefono" className="sr-only">
                        Tu teléfono
                      </label>
                      <Input
                        id="contacto-telefono"
                        type="tel"
                        value={datosContacto.telefono}
                        onChange={(v) => {
                          setDatosContacto((d) => ({ ...d, telefono: v }));
                          setErrorContacto("");
                        }}
                        placeholder="+56 9 1234 5678"
                      />
                    </div>

                    <div>
                      <label htmlFor="contacto-email" className="sr-only">
                        Tu correo
                      </label>
                      <Input
                        id="contacto-email"
                        type="email"
                        value={datosContacto.email}
                        onChange={(v) => {
                          setDatosContacto((d) => ({ ...d, email: v }));
                          setErrorContacto("");
                        }}
                        placeholder="tu@correo.com"
                      />
                    </div>

                    <div>
                      <label htmlFor="contacto-comuna" className="sr-only">
                        Tu comuna
                      </label>
                      <select
                        id="contacto-comuna"
                        value={datosContacto.comuna}
                        onChange={(e) => {
                          setDatosContacto((d) => ({ ...d, comuna: e.target.value }));
                          setErrorContacto("");
                        }}
                        className="w-full rounded-2xl border-2 border-ink/10 bg-white px-4 py-3.5 text-base font-semibold text-ink focus:border-teal focus:outline-none"
                      >
                        <option value="">¿De qué comuna eres?</option>
                        {COMUNAS.map((c) => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {errorContacto && (
                    <p
                      role="alert"
                      className="mt-2 rounded-xl bg-[#fbdbe7] px-4 py-2 text-xs font-semibold text-[#7a1030]"
                    >
                      {errorContacto}
                    </p>
                  )}
                </div>
              )}

              <div>
                <p className="mb-1 text-sm font-bold text-ink">Servicio</p>
                <div className="grid gap-2">
                  {SERVICIOS.map((s) => (
                    <ChoiceCard key={s} checked={servicio === s} onClick={() => setServicio(s)}>
                      {s}
                    </ChoiceCard>
                  ))}
                </div>
              </div>

              {/* Cupón */}
              <div>
                <p className="mb-1 text-sm font-bold text-ink">
                  ¿Tienes un cupón?{" "}
                  <span className="font-normal text-ink/40">opcional</span>
                </p>
                {cupon ? (
                  <div className="flex items-center justify-between rounded-2xl bg-[#d8f0e3] px-4 py-3 text-sm font-bold text-teal-ink">
                    <span>🎟️ {cupon.codigo} — {cupon.pct}% dcto</span>
                    <button
                      type="button"
                      onClick={() => { setCupon(null); setCuponInput(""); }}
                      className="text-xs font-semibold underline underline-offset-2"
                    >
                      Quitar
                    </button>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <Input
                      value={cuponInput}
                      onChange={setCuponInput}
                      placeholder="Ej: LANZAMIENTO"
                      onEnter={validarCupon}
                    />
                    <button
                      type="button"
                      onClick={validarCupon}
                      className="rounded-2xl border-2 border-ink/15 px-5 text-sm font-extrabold text-ink transition-colors hover:border-ink/30"
                    >
                      Aplicar
                    </button>
                  </div>
                )}
                {cuponError && (
                  <p className="mt-1.5 text-xs font-semibold text-[#a34d00]">{cuponError}</p>
                )}
                {cupon && esPrimeraCita && (
                  <p className="mt-1.5 text-xs text-ink-soft">
                    Los descuentos no se suman — aplicamos el del cupón.
                  </p>
                )}
              </div>

              {/* Resumen por perrito */}
              <div className={`rounded-3xl p-5 ${algunoManual ? "bg-[#fde4c8]" : "bg-[#d8f0e3]"}`}>
                <p className="font-display text-base font-extrabold text-ink">
                  {algunoManual ? "⚠️ Atención personalizada" : "✅ Reserva lista"}
                </p>
                <div className="mt-2 space-y-1.5">
                  {perros.slice(0, cantidad).map((p, i) => {
                    const r = resumen[i];
                    return (
                      <p key={i} className="flex items-center justify-between text-sm font-semibold text-ink-soft">
                        <span>🐶 {p.nombrePerro || `Perrito ${i + 1}`}</span>
                        <span>
                          {r.esManual
                            ? "evaluación en puerta"
                            : r.estimado
                              ? formatRangoCLP(r.estimado.total)
                              : "—"}
                        </span>
                      </p>
                    );
                  })}
                  {cantidad > 1 && totalEstimado > 0 && (
                    <p className="flex items-center justify-between border-t border-ink/10 pt-1.5 text-sm font-extrabold text-ink">
                      <span>Total estimado</span>
                      <span>{formatRangoCLP(totalEstimado)}</span>
                    </p>
                  )}
                </div>
                {/* Sin esto, el cliente ve "evaluación en puerta" donde
                    esperaba un precio y no sabe qué hizo mal. Casi siempre es
                    lo mismo: marcó un tamaño y después escribió un peso que
                    no calza con ese tamaño. Decirlo permite corregirlo. */}
                {algunoManual && (
                  <p className="mt-2 rounded-2xl bg-[#fde4c8] px-4 py-3 text-xs leading-relaxed text-[#7a4d10]">
                    El tamaño que elegiste no calza con el peso que
                    escribiste, así que el valor lo confirmamos al verlo. Si
                    fue un error, puedes volver atrás y corregirlo.
                  </p>
                )}
                <p className="mt-2 text-xs leading-relaxed text-ink-soft">{NOTA_PRECIOS}</p>
              </div>

              <button
                type="button"
                onClick={confirmarReserva}
                disabled={!fechaDeseada || !inicioElegido || !servicio || enviando}
                className={`flex w-full items-center justify-center gap-2 rounded-full py-4 font-display text-base font-extrabold shadow-[0_3px_0_rgba(6,58,64,.25)] transition-[background-color,transform,box-shadow,opacity] duration-150 hover:shadow-[0_5px_0_rgba(6,58,64,.25)] active:translate-y-0.5 active:shadow-[0_1px_0_rgba(6,58,64,.25)] disabled:cursor-not-allowed disabled:opacity-40 ${
                  algunoManual
                    ? "bg-orange text-teal-ink hover:bg-[#f7ab52]"
                    : "bg-teal text-white hover:bg-teal-dark"
                }`}
              >
                <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current" aria-hidden="true">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
                  <path d="M12 0C5.373 0 0 5.373 0 12c0 2.125.555 4.122 1.528 5.858L0 24l6.335-1.652A11.954 11.954 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.818a9.818 9.818 0 01-5.007-1.37l-.36-.213-3.727.977.994-3.634-.234-.373A9.818 9.818 0 0112 2.182c5.426 0 9.818 4.392 9.818 9.818S17.426 21.818 12 21.818z"/>
                </svg>
                {/* Los dos textos tienen que decir que el botón ENVÍA.
                    "Solicitar evaluación personalizada" a secas se leía como
                    otra cosa —el señor Ignacio buscó el botón de enviar y
                    creyó que no estaba—, y si a él le pasó, a un cliente
                    también. */}
                {enviando
                  ? "Preparando tu reserva…"
                  : algunoManual
                    ? "Confirmar y pedir evaluación"
                    : "Confirmar reserva"}
              </button>

              {/* Decir lo que va a pasar ANTES de que pase. Al confirmar se
                  abre WhatsApp, y una app que se abre sola sin aviso asusta
                  — sobre todo a quien reserva desde el celular. Ademas deja
                  claro que la reserva no queda cerrada hasta que el equipo
                  confirme: prometer una hora que todavia no existe es la
                  forma mas rapida de perder a un cliente en la puerta. */}
              <p className="text-center text-xs leading-relaxed text-ink-soft">
                Al confirmar, nuestra atención al cliente te escribe por
                WhatsApp para cerrar la hora.
              </p>

              {solicitudEstado === "registrada" && (
                <p className="rise-in rounded-2xl bg-[#d8f0e3] px-5 py-3 text-center text-sm font-semibold text-teal-ink">
                  🐾 Tu solicitud quedó registrada como <strong>pendiente</strong> —
                  el equipo la confirmará pronto.
                </p>
              )}

              {/* PRP-002 F6. Paso opcional y explícito, no automático.

                  Automático fue el primer diseño y estaba mal: la hoja de
                  compartir no permite fijar destinatario, así que el cliente
                  terminaba eligiendo un contacto a mano —y si no tenía a
                  Perrustingo agendado, no lo encontraba—. Ahora el mensaje ya
                  salió al chat correcto por `wa.me`; esto solo agrega la
                  imagen, y por eso el texto avisa que hay que elegir el mismo
                  chat. El botón aparece únicamente si el navegador declara que
                  puede compartir ESTOS archivos: ofrecer uno que después falla
                  es peor que no ofrecerlo. */}
              {/* `urlWhatsApp` y no solo `puedeCompartir`: el texto habla de
                  "la misma conversación que acabas de abrir", y antes de
                  confirmar esa conversación no existe. Se veía ofreciendo
                  adjuntar una foto a un chat que todavía no se abría. */}
              {puedeCompartir && urlWhatsApp && (
                <div className="rounded-2xl bg-[#eaf7f1] px-4 py-4">
                  <p className="text-center text-xs font-semibold leading-relaxed text-teal-ink">
                    Tu foto ya quedó guardada en la ficha y el equipo la ve al
                    abrir tu cita. Si además la quieres en el chat:
                  </p>
                  <button
                    type="button"
                    onClick={compartirLaFoto}
                    className="mt-3 w-full rounded-full border-2 border-teal px-5 py-3 font-display text-sm font-extrabold text-teal-dark transition-colors hover:bg-[#d5efe2]"
                  >
                    Adjuntar la foto al chat
                  </button>
                  <p className="mt-2 text-center text-[11px] leading-relaxed text-ink-soft">
                    Se abrirá el menú de tu teléfono: elige WhatsApp y luego la
                    misma conversación de Perrustingo que acabas de abrir.
                  </p>
                </div>
              )}
              {avisoCompartir && (
                <p className="text-center text-xs font-semibold text-ink-soft">
                  {avisoCompartir}
                </p>
              )}
              {solicitudEstado === "error" && (
                /* Antes decía "tu mensaje de WhatsApp salió igual" sin haberlo
                   comprobado. Le pasó al señor Ignacio: leyó que su mensaje
                   había salido, y no había salido nada. Un aviso que afirma
                   lo que no sabe es peor que no avisar. */
                <p className="rise-in rounded-2xl bg-[#fde4c8] px-5 py-3 text-center text-sm font-semibold text-[#a34d00]">
                  No pudimos guardar la solicitud en el sistema. Envía el
                  mensaje por WhatsApp con el botón de abajo y el equipo te
                  responde por ahí.
                </p>
              )}

              {/* Salida de emergencia: si el navegador bloqueó la ventana, si
                  la hoja de compartir se cerró, o si algo falló, el cliente
                  igual tiene cómo mandar su mensaje. Sin esto queda atascado
                  con la reserva a medias. */}
              {urlWhatsApp && (
                <a
                  href={urlWhatsApp}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block w-full rounded-full bg-teal py-3.5 text-center font-display text-sm font-extrabold text-white shadow-[0_3px_0_rgba(6,58,64,.25)] transition-[background-color,transform] duration-150 hover:bg-teal-dark active:translate-y-0.5"
                >
                  Abrir WhatsApp y enviar el mensaje
                </a>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Navegación */}
      <div className="mt-5 flex items-center gap-3">
        {(fase !== "cuantos") && (
          <button
            type="button"
            onClick={retroceder}
            className="rounded-full border-2 border-ink/15 px-6 py-3 font-display text-sm font-extrabold text-ink transition-colors hover:border-ink/30"
          >
            ←
          </button>
        )}
        {fase !== "cita" && (
          <button
            type="button"
            onClick={intentarAvanzar}
            /* A propósito NO va `disabled`: un botón apagado no se puede
               pulsar, así que el cliente nunca se entera de qué le falta.
               Se ve atenuado, pero responde y explica. */
            aria-disabled={bloqueaAvance}
            className={`flex-1 rounded-full bg-teal py-3.5 font-display text-sm font-extrabold text-white shadow-[0_3px_0_rgba(6,58,64,.25)] transition-[background-color,box-shadow,opacity] hover:bg-teal-dark hover:shadow-[0_5px_0_rgba(6,58,64,.25)] ${
              bloqueaAvance ? "opacity-50" : ""
            }`}
          >
            {fase === "perro" && step === totalPasosPerro - 1 && dogIdx < cantidad - 1
              ? `Siguiente perrito →`
              : "Siguiente →"}
          </button>
        )}
      </div>

      {/* Sale solo cuando el cliente ya intentó avanzar: avisar antes de que
          lo intente es regañar a alguien que todavía no hizo nada. */}
      {intentoAvanzar && faltaAqui && (
        <p
          role="alert"
          className="mt-3 rounded-2xl bg-[#fde4c8] px-4 py-3 text-center text-xs font-semibold leading-relaxed text-[#7a4d10]"
        >
          {faltaAqui}
        </p>
      )}
    </div>
  );
}

// ─── Helpers de payload ────────────────────────────────────────────────────

function pesoDe(p: FormData): number | null {
  const n = parseFloat(p.pesoKg);
  return !isNaN(n) && n > 0 && n <= 120 ? n : null;
}

function normalizarTemperamento(t: string): string | null {
  return ["se_deja", "no_se_deja", "complicado", "no_lo_se"].includes(t) ? t : null;
}
