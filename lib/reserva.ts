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

/** Los cinco tamaños en orden de menor a mayor — orden canónico para
    listas y editores (antes cada componente tenía su propia copia). */
export const TAMANOS: readonly TamanoKey[] = [
  "toy",
  "pequeno",
  "mediano",
  "grande",
  "gigante",
] as const;

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

/** Aclaración legal/comercial — mostrar junto a cualquier precio. */
export const NOTA_PRECIOS =
  "Precios referenciales: el valor puede variar según el comportamiento, el estado del pelo, la frecuencia de visitas y la mantención en casa. El valor final se confirma en la puerta, siempre antes de comenzar.";

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
  esPrimeraVez: "si" | "no" | "no_lo_se" | "";
  // Paso 2 — tamaño y pelo
  pesoKg: string;
  alturaCmd: string;
  contextura: "delgado" | "normal" | "robusto" | "";
  tamanoDeclarado: TamanoKey | "";
  tipoPelo: TipoPelo | "";
  tipoPeloOtro: string;
  // Paso 3 — salud y temperamento
  /* "no_lo_se" es una respuesta legítima, no un campo sin llenar: mucha
     gente no le ha mirado las uñas a su perro. Obligar a elegir sí o no
     produce datos inventados, y un "no" falso hace que el equipo no revise. */
  unasEncarnadas: "si" | "no" | "no_lo_se" | "";
  secrecionOcular: "si" | "no" | "no_lo_se" | "";
  tieneAlergia: "si" | "no" | "no_lo_se" | "";
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
  esPrimeraVez: "",
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


export const PRIMERA_VEZ_LABELS: Record<string, string> = {
  si: "Sí, es su primera peluquería",
  no: "Ya ha ido a peluquería antes",
  no_lo_se: "No lo sé",
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

/* ── El precio que ve el cliente es un rango, no una cifra exacta ──────

   Pedido del señor Ignacio (27-jul). La razón es comercial y honesta a la
   vez: el valor final depende del estado real del pelo, del comportamiento
   y del tamaño, y se confirma en la puerta. Un "$38.400" clavado promete
   una exactitud que el negocio no puede sostener, y cuando en el local
   sale distinto, el cliente siente que le cambiaron el precio.

   Un rango redondo dice la verdad —"va a estar entre 38 y 40"— y deja al
   equipo margen para cobrar lo justo sin discutir. */

const PASO_REDONDEO = 1000;
/* Cuánto se abre el rango hacia arriba. 2.000 sobre un servicio de ~20.000
   es un 10 %: suficiente para absorber un perro enredado, y lo bastante
   angosto para que el número siga significando algo. Un rango demasiado
   ancho no es una estimación, es una evasiva. */
const ANCHO_RANGO = 2000;

export interface RangoPrecio {
  desde: number;
  hasta: number;
}

/** Convierte un precio calculado en el rango redondo que ve el cliente. */
export function rangoPrecio(n: number): RangoPrecio {
  if (n <= 0) return { desde: 0, hasta: 0 };
  const desde = Math.floor(n / PASO_REDONDEO) * PASO_REDONDEO;
  return { desde, hasta: desde + ANCHO_RANGO };
}

/** "$38.000 a $40.000" — la forma en que se muestra un estimado.

    Bajo mil pesos se muestra el valor exacto: redondear 800 hacia abajo da
    un piso de $0 y eso se lee como "gratis". No pasa con las tarifas reales
    (el servicio más barato ronda los 20.000), pero un formateador que puede
    decir "gratis" por un error de cálculo no debe existir. */
export function formatRangoCLP(n: number): string {
  if (n <= 0) return formatCLP(0);
  if (n < PASO_REDONDEO) return formatCLP(n);
  const { desde, hasta } = rangoPrecio(n);
  return `${formatCLP(desde)} a ${formatCLP(hasta)}`;
}

/* ── Capitalización de lo que escribe el cliente ──────────────────────

   La gente escribe "luna" o "JUAN PEREZ" en el teléfono, y eso después
   aparece en la agenda del local y en el mensaje del equipo. No es
   cosmética: una ficha que dice "luna" se ve descuidada, y el salón lo
   está entregando a un cliente. */

/* Partículas que van en minúscula dentro de un nombre: "María de los
   Ángeles" y no "María De Los Ángeles". */
const PARTICULAS = new Set(["de", "del", "la", "las", "los", "y", "da", "do"]);

/** Capitaliza un nombre propio respetando partículas y guiones. */
export function capitalizarNombre(valor: string): string {
  const limpio = valor.trim().replace(/\s+/g, " ");
  if (!limpio) return "";

  return limpio
    .toLocaleLowerCase("es-CL")
    .split(" ")
    .map((palabra, i) => {
      if (i > 0 && PARTICULAS.has(palabra)) return palabra;
      // Los nombres compuestos con guion también llevan las dos mayúsculas.
      return palabra
        .split("-")
        .map((parte) =>
          parte ? parte.charAt(0).toLocaleUpperCase("es-CL") + parte.slice(1) : parte
        )
        .join("-");
    })
    .join(" ");
}

/** Primera letra en mayúscula, para textos libres de una frase. */
export function capitalizarFrase(valor: string): string {
  const limpio = valor.trim().replace(/\s+/g, " ");
  if (!limpio) return "";
  return limpio.charAt(0).toLocaleUpperCase("es-CL") + limpio.slice(1);
}

/* ── Qué falta para poder avanzar ─────────────────────────────────────

   Antes solo se bloqueaba el peso inválido y la foto. Todo lo demás se
   podía saltar vacío, y la ficha llegaba al local sin raza, sin pelo y
   sin temperamento — justo lo que el equipo necesita para preparar la
   sesión y para no llevarse un mordisco.

   Devuelve el texto de lo que falta, o null si el paso está completo. El
   texto importa: un botón apagado sin explicación se siente como que la
   página está rota. */
export function faltaEnPaso(pasoId: string, data: FormData): string | null {
  switch (pasoId) {
    case "nombre":
      return data.nombrePerro.trim().length >= 2
        ? null
        : "Escribe el nombre para continuar.";
    case "raza":
      if (!data.raza) return "Elige una raza (o «Mestizo / Quiltro»).";
      if (data.raza === "Otro" && !data.razaOtro.trim()) return "Cuéntanos qué raza es.";
      return null;
    case "edad":
      return data.edadAnios || data.edadMeses
        ? null
        : "Indica la edad, aunque sea aproximada.";
    case "primera":
      return data.esPrimeraVez ? null : "Elige una opción.";
    case "peso": {
      const peso = parseFloat(data.pesoKg);
      if (!data.pesoKg.trim()) return "El peso es lo que nos permite calcular el precio.";
      if (isNaN(peso) || peso <= 0.4 || peso > 120) return "Revisa el peso: debe estar entre 0,5 y 120 kg.";
      return null;
    }
    case "contextura":
      return data.contextura ? null : "Elige una opción.";
    case "pelo":
      if (!data.tipoPelo) return "Elige el tipo de pelo.";
      if (data.tipoPelo === "otro" && !data.tipoPeloOtro.trim()) return "Cuéntanos cómo es su pelo.";
      return null;
    case "salud": {
      const sinResponder = [
        !data.unasEncarnadas && "uñas encarnadas",
        !data.secrecionOcular && "secreción ocular",
        !data.tieneAlergia && "enfermedad o alergia",
      ].filter(Boolean) as string[];
      if (sinResponder.length > 0) {
        // "No lo sé" es una respuesta válida: por eso se puede exigir que
        // respondan las tres sin obligar a nadie a inventar.
        return `Falta responder: ${sinResponder.join(", ")}. Si no sabes, marca «No lo sé».`;
      }
      if (data.tieneAlergia === "si" && !data.cualAlergia.trim()) {
        return "Cuéntanos cuál es la alergia o enfermedad.";
      }
      return null;
    }
    case "temperamento":
      return data.temperamentoGeneral ? null : "Elige cómo se porta.";
    /* `tamano` y `zonas` quedan fuera a propósito: sus propios textos
       dicen "Opcional" y "o ninguna". Exigirlos sería contradecir a la
       pantalla, y el tamaño ya se deduce del peso. */
    default:
      return null;
  }
}

/* ── El enlace a la ficha en el mensaje (PRP-002 F6) ──────────────────

   WhatsApp no deja adjuntar una imagen desde un enlace `wa.me?text=`: solo
   acepta texto. No es una limitación del sitio, es de WhatsApp, y no hay
   forma de sortearla desde una página web.

   Lo que sí se puede: mandar en el mensaje un enlace a la ficha de la cita.
   El equipo lo abre con su sesión y ve las fotos ahí. Si el mensaje se
   reenvía, quien no sea del equipo no ve nada — coherente con que las fotos
   son respaldo interno (F4). */

export interface EnlaceFicha {
  /** Origen del sitio, sin barra final. */
  origen: string;
  /** IDs de las citas creadas. */
  ids: string[];
  /** Si el cliente adjuntó alguna foto. */
  conFotos: boolean;
}

/** Añade al mensaje el enlace a la ficha, si hay una cita que enlazar.

    Devuelve el mensaje intacto cuando no hay ids: si la reserva no llegó a
    crearse, un enlace a una ficha inexistente sería peor que no ponerlo. */
export function conEnlaceFicha(mensaje: string, enlace: EnlaceFicha | null): string {
  if (!enlace || enlace.ids.length === 0 || !enlace.origen) return mensaje;

  const url = `${enlace.origen.replace(/\/+$/, "")}/dashboard/citas?cita=${enlace.ids[0]}`;

  /* El texto solo habla de fotos cuando las hay. Prometer "ver las fotos" a
     un equipo que va a encontrar una ficha vacía es la clase de detalle que
     hace que dejen de abrir el enlace.

     SIN EMOJI, y no por gusto: verificado el 27-jul contra WhatsApp real, el
     redirect de wa.me a api.whatsapp.com convierte los emojis de 4 bytes
     (fuera del BMP, como 📷) en el carácter de reemplazo "�". Los signos
     del BMP —las viñetas, la eñe, los acentos— sí sobreviven. Un rombo negro
     al lado del enlace más importante del mensaje se lee como un error del
     sitio, así que acá manda que llegue bien, no que se vea bonito. */
  const titulo = enlace.conFotos
    ? "Ficha y fotos de la cita (para el equipo)"
    : "Ficha de la cita (para el equipo)";

  const extra =
    enlace.ids.length > 1
      ? `\n(Las otras ${enlace.ids.length - 1} fichas están en el panel)`
      : "";

  return `${mensaje}\n\n${titulo}:\n${url}${extra}`;
}

/** Una foto que ya quedó guardada, con el nombre del perrito al que pertenece. */
export interface FotoEnMensaje {
  sesionId: string;
  nombre: string;
  /** Tipos que existen para esa cita: 'antes' (el perrito) y/o 'referencia'. */
  tipos: ("antes" | "referencia")[];
}

/** Mete las fotos DENTRO del mensaje de WhatsApp, como enlaces.

    Pedido del señor Ignacio, 27-jul: "que llegue el mensaje con la foto, sí
    o sí". Un enlace `wa.me` no transporta archivos, así que lo que viaja es
    la dirección de cada foto — y WhatsApp le muestra la vista previa al
    equipo dentro de la conversación, sin pedirle que entre a ningún panel.

    Las direcciones son las de `/api/foto/...`: cortas a propósito. El
    mensaje entero viaja en la query del enlace y una URL firmada de Storage
    se lleva sola cientos de caracteres; con dos perritos, el mensaje se
    pasaba de largo y WhatsApp lo cortaba. */
export function conEnlacesFoto(
  mensaje: string,
  origen: string,
  fotos: FotoEnMensaje[]
): string {
  const base = origen.replace(/\/+$/, "");
  const lineas = fotos.flatMap((f) =>
    f.tipos.map((tipo) => {
      const que = tipo === "antes" ? "Foto de" : "Corte que quiere para";
      return `${que} ${f.nombre}:\n${base}/api/foto/${f.sesionId}/${tipo}`;
    })
  );

  if (lineas.length === 0) return mensaje;

  return `${mensaje}\n\n${lineas.join("\n\n")}`;
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
  /* Lo que el dueño no sabe también viaja: es justamente lo que el equipo
     tiene que mirar al recibir al perrito. */
  const porRevisar = [
    data.unasEncarnadas === "no_lo_se" && "uñas",
    data.secrecionOcular === "no_lo_se" && "ojos",
    data.tieneAlergia === "no_lo_se" && "alergias",
  ].filter(Boolean) as string[];
  if (porRevisar.length > 0) saludItems.push(`por revisar: ${porRevisar.join(", ")}`);

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
  if (data.esPrimeraVez) lines.push(`• *Primera peluquería:* ${PRIMERA_VEZ_LABELS[data.esPrimeraVez]}`);
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
    if (precio > 0 && pesoValido) {
      /* En rango, igual que en pantalla. Se me habia escapado esta ruta:
         el formulario mostraba "$21.000 a $23.000" y el mensaje que llegaba
         al equipo decia "desde $21.800". Dos cifras distintas para la misma
         cita es justo lo que hace que un cliente reclame en la puerta. */
      lines.push(`*Precio estimado:* ${formatRangoCLP(precio)}`);
      const est = calcularEstimado(data);
      if (est && est.ajustes.length > 0) {
        lines.push(
          `  (incluye: ${est.ajustes.map((a) => `${textoDeAjuste(a)} ${a.etiqueta.toLowerCase()}`).join(", ")})`
        );
      }
    }
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
  const dudas = [
    data.unasEncarnadas === "no_lo_se" && "uñas",
    data.secrecionOcular === "no_lo_se" && "ojos",
    data.tieneAlergia === "no_lo_se" && "alergias",
  ].filter(Boolean) as string[];
  if (dudas.length > 0) salud.push(`por revisar: ${dudas.join(", ")}`);

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
    esPrimeraVez: data.esPrimeraVez ? PRIMERA_VEZ_LABELS[data.esPrimeraVez] : "",
    pesoKg: data.pesoKg,
    contextura: data.contextura,
    tipoPelo: pelo,
    salud: salud.join(", "),
    temperamento: tempGeneral,
    noSeDejaCon: zonas.join(", "),
  };
}

/* ── Estimado en vivo ─────────────────────────────────────────
   Recargos PROVISORIOS (a confirmar con Rodolfo): el estimado sube
   mientras el cliente declara condiciones que implican más trabajo. */

/** Un agregado del precio. Puede cobrarse de dos formas y solo una manda:
    - porcentaje (`pct`): escala con el tamaño del perro. Un 25% son $4.500
      en un toy y $20.000 en un gigante.
    - monto fijo (`monto`, en CLP): mismo costo para todos. Sirve cuando el
      costo real no es proporcional (un producto, un accesorio).
    Si `monto` viene definido, `pct` se ignora en el cálculo. */
export interface AjustePrecio {
  etiqueta: string;
  pct: number;
  monto?: number;
}

/** Cómo se cobra un agregado. Vive acá y no en lib/ajustesPrecio.ts porque
    ese módulo es `"use client"` y esto lo necesitan también los server
    actions — un helper de dominio no puede quedar del lado del cliente. */
export type TipoAjuste = "pct" | "monto";

/** Las zonas sensibles se quedan solo en porcentaje a propósito: sus dos
    filas son "cada zona suma X" y "el tope es Y", y si una fuera monto y
    la otra %, el tope no tendría contra qué compararse. Ver migración 010. */
export function admiteMontoFijo(categoria: string): boolean {
  return categoria !== "zona_sensible";
}

/** Cuánto suma un ajuste sobre una base dada, en pesos. Única fuente de
    verdad para el desglose y el total — si se calculan por separado, el
    cliente ve un desglose que no suma su total. */
export function montoDeAjuste(ajuste: AjustePrecio, base: number): number {
  return ajuste.monto !== undefined ? ajuste.monto : Math.round((base * ajuste.pct) / 100);
}

/** Etiqueta corta del valor de un ajuste, para el desglose: "+25%" o "+$8.000". */
export function textoDeAjuste(ajuste: AjustePrecio): string {
  if (ajuste.monto !== undefined) {
    return `${ajuste.monto >= 0 ? "+" : "−"}${formatCLP(Math.abs(ajuste.monto))}`;
  }
  return `${ajuste.pct > 0 ? "+" : ""}${ajuste.pct}%`;
}

/* Configuración de ajustes de precio — antes constantes fijas acá mismo,
   ahora vive en la tabla `ajustes_precio` (migración 007) y se lee vía
   lib/ajustesPrecio.ts. Estos valores DEFAULT son el fallback antes de que
   cargue la config real, e idénticos al hardcode original — no cambiar
   sin también actualizar el seed de la migración 007. */
export interface AjustesPrecioConfig {
  recargosPelo: Partial<Record<TipoPelo, AjustePrecio>>;
  recargosTemperamento: Record<string, AjustePrecio>;
  pctPorZona: number;
  maxPctZonas: number;
  descuentoCachorro: AjustePrecio;
  descuentoPrimeraCita: AjustePrecio;
}

export const AJUSTES_PRECIO_DEFAULT: AjustesPrecioConfig = {
  recargosPelo: {
    crespo_motas: { etiqueta: "Pelo con motas", pct: 15 },
    motas_rastas: { etiqueta: "Motas / rastas", pct: 25 },
    doble_capa: { etiqueta: "Doble capa", pct: 10 },
  },
  recargosTemperamento: {
    no_se_deja: { etiqueta: "No se deja atender", pct: 15 },
    complicado: { etiqueta: "Complicado o bravo", pct: 25 },
  },
  pctPorZona: 3,
  maxPctZonas: 12,
  descuentoCachorro: { etiqueta: "Cachorro en crecimiento", pct: -15 },
  descuentoPrimeraCita: { etiqueta: "Primera cita con cuenta", pct: -10 },
};

/* Regla de Rodolfo: cachorro/joven de raza conocida usa la tabla del
   TAMAÑO ADULTO de su raza, "bajándole un poquito". % PROVISORIO. */
export const EDAD_CACHORRO_MESES = 18;

export interface EstimadoVivo {
  base: number;
  ajustes: AjustePrecio[];
  total: number;
}

/** Redondeo comercial a la centena. */
function redondear(n: number): number {
  return Math.round(n / 100) * 100;
}

/** Composición SIEMPRE aditiva (confirmado con Jarvis 22-jul): se suman
    todos los % y se aplican una sola vez sobre la base — nunca en cadena
    multiplicativa. Cambiar esto desincroniza el desglose que ve el
    cliente del total que realmente se le cobra. */
export function calcularEstimado(
  data: FormData,
  precioBase?: number | null,
  ajustesExtra?: AjustePrecio[],
  config: AjustesPrecioConfig = AJUSTES_PRECIO_DEFAULT
): EstimadoVivo | null {
  const peso = parseFloat(data.pesoKg);
  const base = precioBase ?? (!isNaN(peso) && peso > 0 && peso <= 120 ? calcularPrecio(peso) : null);
  if (!base) return null;

  const ajustes: AjustePrecio[] = [...(ajustesExtra ?? [])];

  const recargoPelo = config.recargosPelo[data.tipoPelo as TipoPelo];
  if (recargoPelo) ajustes.push(recargoPelo);

  const recargoTemp = config.recargosTemperamento[data.temperamentoGeneral];
  if (recargoTemp) ajustes.push(recargoTemp);

  const zonas = [
    data.conPatitas, data.conHocico, data.conUnas, data.conCola,
    data.conBano, data.conSecador, data.conMaquina, data.conTijeras,
  ].filter((v) => v === "no_se_deja").length;
  if (zonas > 0) {
    ajustes.push({
      etiqueta: `${zonas} zona${zonas === 1 ? "" : "s"} sensible${zonas === 1 ? "" : "s"}`,
      pct: Math.min(zonas * config.pctPorZona, config.maxPctZonas),
    });
  }

  // Los porcentajes se suman entre sí y se aplican UNA vez sobre la base
  // (nunca en cadena multiplicativa). Los montos fijos se suman al final,
  // sin escalar: son costos reales, no proporciones.
  const pctTotal = ajustes.filter((a) => a.monto === undefined).reduce((acc, a) => acc + a.pct, 0);
  const montoFijo = ajustes.reduce((acc, a) => acc + (a.monto ?? 0), 0);
  return { base, ajustes, total: redondear(base * (1 + pctTotal / 100) + montoFijo) };
}

/* ── Reserva multi-perrito ────────────────────────────────────
   Un mensaje de WhatsApp con un bloque por perrito + total. */

export interface PerroReserva {
  data: FormData;
  esManual: boolean;
  estimado: EstimadoVivo | null;
}

export function buildWhatsAppMessageMulti(
  perros: PerroReserva[],
  compartido: { fechaDeseada: string; servicio: string; contactoNombre: string }
): string {
  if (perros.length === 1) {
    const unico = {
      ...perros[0].data,
      fechaDeseada: compartido.fechaDeseada,
      servicio: compartido.servicio,
    };
    return buildWhatsAppMessage(unico, perros[0].esManual, perros[0].estimado?.total);
  }

  const lines: string[] = [];
  lines.push(
    `Hola Perrustingo, quiero agendar una cita para mis ${perros.length} perros.`
  );

  let total = 0;
  let algunoManual = false;
  perros.forEach(({ data, esManual, estimado }, i) => {
    const raza = data.raza === "Otro" ? data.razaOtro || "Otro" : data.raza;
    lines.push("");
    lines.push(`*Perro ${i + 1}: ${data.nombrePerro || "—"}*`);
    if (raza) lines.push(`• Raza: ${raza}`);
    if (data.pesoKg) lines.push(`• Peso: ${data.pesoKg} kg`);
    if (estimado) {
      lines.push(`• Estimado: ${formatRangoCLP(estimado.total)}`);
      total += estimado.total;
    }
    if (esManual) {
      algunoManual = true;
      lines.push("• Nota: tamaño y peso no coinciden — necesita evaluación.");
    }
  });

  lines.push("");
  if (total > 0) lines.push(`*Total estimado:* ${formatRangoCLP(total)}`);
  if (compartido.servicio) lines.push(`*Servicio:* ${compartido.servicio}`);
  if (compartido.fechaDeseada) lines.push(`*Fecha deseada:* ${compartido.fechaDeseada}`);
  if (algunoManual) {
    lines.push("");
    lines.push("Solicito evaluación personalizada para los casos marcados.");
  }

  return lines.join("\n");
}
