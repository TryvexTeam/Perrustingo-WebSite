export type TamanoKey = "toy" | "pequeno" | "mediano" | "grande" | "gigante";

export type TipoPelo =
  | "corto_liso_duro"
  | "largo_liso_duro"
  | "crespo_motas"
  | "crespo_sin_motas"
  | "liso_largo"
  | "doble_capa"
  | "motas_rastas"
  | "otro";

export type Temperamento = "se_deja" | "no_se_deja" | "no_lo_se";

export const TAMANO_LABELS: Record<TamanoKey, string> = {
  toy: "Mini / Toy (hasta 5 kg)",
  pequeno: "Pequeño (6–10 kg)",
  mediano: "Mediano (11–25 kg)",
  grande: "Grande (26–45 kg)",
  gigante: "Gigante (más de 45 kg)",
};

export const TAMANO_RANGOS: Record<TamanoKey, [number, number]> = {
  toy: [0, 5],
  pequeno: [6, 10],
  mediano: [11, 25],
  grande: [26, 45],
  gigante: [46, 999],
};

export const TAMANO_PRECIOS: Record<TamanoKey, number> = {
  toy: 18000,
  pequeno: 20000,
  mediano: 25000,
  grande: 40000,
  gigante: 80000,
};

export const PELO_LABELS: Record<TipoPelo, string> = {
  corto_liso_duro: "Corto liso duro",
  largo_liso_duro: "Largo liso duro",
  crespo_motas: "Crespo con motas",
  crespo_sin_motas: "Crespo sin motas",
  liso_largo: "Liso largo (golden, pastor, terranova)",
  doble_capa: "Doble capa",
  motas_rastas: "Motas / rastas",
  otro: "Otro",
};

export const TEMP_LABELS: Record<Temperamento, string> = {
  se_deja: "Se deja",
  no_se_deja: "No se deja",
  no_lo_se: "No lo sé",
};

export const RAZAS = [
  "Chihuahua",
  "Pomerania",
  "Yorkshire",
  "Poodle Toy",
  "Dachshund Miniatura",
  "Fox Terrier Pelo Liso",
  "Bichón Frisé",
  "Shih Tzu",
  "Poodle",
  "Terrier Chileno",
  "Dachshund",
  "Beagle",
  "Cocker Spaniel",
  "Schnauzer",
  "Bulldog Francés",
  "Dogo Chileno",
  "Golden Retriever",
  "Labrador",
  "Pastor Alemán",
  "Pastor Inglés",
  "Samoyedo",
  "Ovejero Magallánico",
  "San Bernardo",
  "Terranova",
  "Mestizo / Quiltro",
  "Otro",
];

export const SERVICIOS = [
  "Baño completo (sin corte de pelo)",
  "Baño + corte de pelo",
  "Spa completo",
  "Solo uñas",
  "Solo baño y secado",
];

export interface FormData {
  // Contacto del dueño
  contactoNombre: string;
  contactoEmail: string;
  contactoTelefono: string;
  // Paso 1 — básico
  nombrePerro: string;
  raza: string;
  razaOtro: string;
  edadAnios: string;
  edadMeses: string;
  // Paso 2 — tamaño y pelo
  pesoKg: string;
  alturaCmd: string;
  contextura: "delgado" | "normal" | "robusto" | "";
  tamanoDeclarado: TamanoKey | "";
  tipoPelo: TipoPelo | "";
  tipoPeloOtro: string;
  // Paso 3 — salud y temperamento
  unasEncarnadas: "si" | "no" | "";
  secrecionOcular: "si" | "no" | "";
  tieneAlergia: "si" | "no" | "";
  cualAlergia: string;
  temperamentoGeneral: Temperamento | "complicado" | "";
  conPatitas: Temperamento | "";
  conHocico: Temperamento | "";
  conUnas: Temperamento | "";
  conCola: Temperamento | "";
  conBano: Temperamento | "";
  conSecador: Temperamento | "";
  conMaquina: Temperamento | "";
  conTijeras: Temperamento | "";
  // Paso 4 — cita
  fechaDeseada: string;
  servicio: string;
}

export const FORM_INITIAL: FormData = {
  contactoNombre: "",
  contactoEmail: "",
  contactoTelefono: "",
  nombrePerro: "",
  raza: "",
  razaOtro: "",
  edadAnios: "",
  edadMeses: "",
  pesoKg: "",
  alturaCmd: "",
  contextura: "",
  tamanoDeclarado: "",
  tipoPelo: "",
  tipoPeloOtro: "",
  unasEncarnadas: "",
  secrecionOcular: "",
  tieneAlergia: "",
  cualAlergia: "",
  temperamentoGeneral: "",
  conPatitas: "",
  conHocico: "",
  conUnas: "",
  conCola: "",
  conBano: "",
  conSecador: "",
  conMaquina: "",
  conTijeras: "",
  fechaDeseada: "",
  servicio: "",
};

export function detectarTamanoPorPeso(peso: number): TamanoKey {
  if (peso <= 5) return "toy";
  if (peso <= 10) return "pequeno";
  if (peso <= 25) return "mediano";
  if (peso <= 45) return "grande";
  return "gigante";
}

export function hayConflicto(tamanoDeclarado: TamanoKey, peso: number): boolean {
  const [min, max] = TAMANO_RANGOS[tamanoDeclarado];
  return peso < min || peso > max;
}

export function calcularPrecio(peso: number): number {
  return TAMANO_PRECIOS[detectarTamanoPorPeso(peso)];
}

export function formatCLP(n: number): string {
  return "$" + n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

export function buildWhatsAppMessage(
  data: FormData,
  esManual: boolean,
  precioOverride?: number | null
): string {
  const peso = parseFloat(data.pesoKg);
  const precio =
    precioOverride ?? (!isNaN(peso) && peso > 0 ? calcularPrecio(peso) : 0);
  const raza = data.raza === "Otro" ? (data.razaOtro || "Otro") : data.raza;
  const pelo =
    data.tipoPelo === "otro"
      ? data.tipoPeloOtro || "Otro"
      : PELO_LABELS[data.tipoPelo as TipoPelo] || "";

  const edadParts: string[] = [];
  if (data.edadAnios) edadParts.push(`${data.edadAnios} año${data.edadAnios === "1" ? "" : "s"}`);
  if (data.edadMeses) edadParts.push(`${data.edadMeses} mes${data.edadMeses === "1" ? "" : "es"}`);
  const edad = edadParts.join(" y ") || "no especificada";

  const saludItems: string[] = [];
  if (data.unasEncarnadas === "si") saludItems.push("uñas encarnadas");
  if (data.secrecionOcular === "si") saludItems.push("secreción ocular");
  if (data.tieneAlergia === "si" && data.cualAlergia) saludItems.push(`alergia: ${data.cualAlergia}`);

  const tempGeneral =
    data.temperamentoGeneral === "complicado"
      ? "Complicado o bravo"
      : TEMP_LABELS[data.temperamentoGeneral as Temperamento] || "";

  const zonas: string[] = (
    [
      ["patitas", data.conPatitas],
      ["hocico", data.conHocico],
      ["uñas", data.conUnas],
      ["cola", data.conCola],
      ["baño", data.conBano],
      ["secador", data.conSecador],
      ["máquina", data.conMaquina],
      ["tijeras", data.conTijeras],
    ] as [string, string][]
  )
    .filter(([, v]) => v === "no_se_deja")
    .map(([k]) => k);

  /* Solo caracteres del plano básico Unicode (BMP): los emojis 🐶📋…
     se corrompen a "�" cuando Windows entrega el link wa.me a la app de
     escritorio de WhatsApp. Viñetas y negritas de WhatsApp sobreviven. */
  const pesoValido = !isNaN(peso) && peso > 0 && peso <= 120;
  const lines: string[] = [];

  lines.push(
    esManual
      ? "Hola Perrustingo, necesito una evaluación personalizada para mi perro."
      : "Hola Perrustingo, quiero agendar una cita para mi perro."
  );
  lines.push("");
  lines.push(`• *Nombre:* ${data.nombrePerro || "—"}`);
  if (raza) lines.push(`• *Raza:* ${raza}`);
  if (pesoValido) lines.push(`• *Peso:* ${data.pesoKg} kg`);
  lines.push(`• *Edad:* ${edad}`);
  if (data.contextura) lines.push(`• *Contextura:* ${data.contextura}`);
  if (pelo) lines.push(`• *Tipo de pelo:* ${pelo}`);

  if (saludItems.length > 0) {
    lines.push("");
    lines.push(`*Condiciones de salud:* ${saludItems.join(", ")}`);
  }

  if (tempGeneral || zonas.length > 0) {
    lines.push("");
    if (tempGeneral) lines.push(`*Temperamento general:* ${tempGeneral}`);
    if (zonas.length > 0) lines.push(`*No se deja con:* ${zonas.join(", ")}`);
  }

  if (precio > 0 || data.servicio || data.fechaDeseada) {
    lines.push("");
    if (precio > 0 && pesoValido) lines.push(`*Precio estimado:* desde ${formatCLP(precio)}`);
    if (data.servicio) lines.push(`*Servicio:* ${data.servicio}`);
    if (data.fechaDeseada) lines.push(`*Fecha deseada:* ${data.fechaDeseada}`);
  }

  if (esManual) {
    lines.push("");
    lines.push("Nota: el tamaño y el peso no coinciden — solicito evaluación directa.");
  }

  return lines.join("\n");
}

/** Snapshot legible del formulario para `sesiones.detalle_form`. */
export function construirDetalle(data: FormData): Record<string, string> {
  const raza = data.raza === "Otro" ? data.razaOtro || "Otro" : data.raza;
  const pelo =
    data.tipoPelo === "otro"
      ? data.tipoPeloOtro || "Otro"
      : PELO_LABELS[data.tipoPelo as TipoPelo] || "";

  const edadParts: string[] = [];
  if (data.edadAnios) edadParts.push(`${data.edadAnios} años`);
  if (data.edadMeses) edadParts.push(`${data.edadMeses} meses`);

  const salud: string[] = [];
  if (data.unasEncarnadas === "si") salud.push("uñas encarnadas");
  if (data.secrecionOcular === "si") salud.push("secreción ocular");
  if (data.tieneAlergia === "si" && data.cualAlergia) salud.push(`alergia: ${data.cualAlergia}`);

  const zonas = (
    [
      ["patitas", data.conPatitas],
      ["hocico", data.conHocico],
      ["uñas", data.conUnas],
      ["cola", data.conCola],
      ["baño", data.conBano],
      ["secador", data.conSecador],
      ["máquina", data.conMaquina],
      ["tijeras", data.conTijeras],
    ] as [string, string][]
  )
    .filter(([, v]) => v === "no_se_deja")
    .map(([k]) => k);

  const tempGeneral =
    data.temperamentoGeneral === "complicado"
      ? "Complicado o bravo"
      : TEMP_LABELS[data.temperamentoGeneral as Temperamento] || "";

  return {
    nombrePerro: data.nombrePerro,
    raza,
    edad: edadParts.join(" y "),
    pesoKg: data.pesoKg,
    contextura: data.contextura,
    tipoPelo: pelo,
    salud: salud.join(", "),
    temperamento: tempGeneral,
    noSeDejaCon: zonas.join(", "),
  };
}
