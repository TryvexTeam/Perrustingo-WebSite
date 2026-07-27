import type { TamanoKey } from "./reserva";

/* Una página por servicio (27-jul, pedido del señor Ignacio para el SEO).

   Hasta ahora todo vivía en la portada: una sola página tratando de salir
   en "peluquería canina Renca", en "baño y corte para perros" y en "corte de
   uñas perro Renca" al mismo tiempo. Google necesita una página por
   intención — quien busca corte de uñas no quiere leer sobre el spa.

   Lo que se escribe acá es lo que el salón hace de verdad: sale de los
   servicios que ya lista la portada y de los que ofrece el formulario de
   reserva. Nada de inventar duraciones ni promesas que después el equipo
   tenga que sostener en el mostrador.

   Sin directiva de cliente: lo usan las páginas (servidor) y el sitemap. */

export interface Servicio {
  /** Parte final de la URL: /servicios/<slug>. */
  slug: string;
  /** Nombre corto, para menús y enlaces. */
  nombre: string;
  /** H1 y title. Lleva la palabra que la gente busca Y la comuna. */
  titulo: string;
  /** Meta description: lo que se lee bajo el título en Google. */
  descripcion: string;
  /** Primer párrafo de la página. */
  entrada: string;
  /** Qué incluye, en palabras del salón. */
  incluye: string[];
  /** Para qué perritos conviene. */
  paraQuien: string;
  /** El servicio tal cual lo espera el formulario de reserva. */
  servicioFormulario: string;
  /** Arte que ya existe en /public/servicios. */
  imagen: string;
  imagenAlt: string;
  /** Tamaño de referencia para mostrar "desde": el más pequeño paga menos. */
  tamanoReferencia: TamanoKey;
}

export const SERVICIOS_PAGINA: Servicio[] = [
  {
    slug: "bano-y-corte-de-pelo",
    nombre: "Baño y corte de pelo",
    titulo: "Baño y corte de pelo para perros en Renca",
    descripcion:
      "Baño y corte de pelo para tu perro o perra en Renca. Corte a máquina o tijera según su raza y su pelaje, con secado profesional. Precio estimado al instante y reserva online.",
    entrada:
      "Es el servicio que más nos piden: baño completo y corte, en la misma visita. Trabajamos el corte según la raza, el estado del pelaje y lo que necesite tu perro o perra — no aplicamos el mismo corte a todos.",
    incluye: [
      "Baño completo con productos según su tipo de pelo",
      "Corte a máquina o tijera, según su raza y pelaje",
      "Secado profesional y peinado",
      "Corte de uñas y limpieza de oídos",
      "Revisión de nudos y motas antes de empezar",
    ],
    paraQuien:
      "Para perros de pelo largo o que crece continuo —poodle, schnauzer, shih tzu, maltés, bichón— y para cualquier perrito que llegue con el pelo demasiado largo o enredado.",
    servicioFormulario: "Baño + corte de pelo",
    imagen: "/servicios/corte-estilo.png",
    imagenAlt: "Corte y estilo — el look perfecto para tu mejor amigo",
    tamanoReferencia: "toy",
  },
  {
    slug: "bano-para-perros",
    nombre: "Baño completo",
    titulo: "Baño para perros en Renca — baño completo y secado",
    descripcion:
      "Baño completo para perros en Renca: limpieza profunda, secado profesional, uñas y oídos. Sin corte de pelo. Reserva online y recibe tu precio estimado antes de venir.",
    entrada:
      "Baño completo sin corte: limpieza profunda, secado y la higiene que a veces se pasa por alto. Ideal cuando el pelo está bien de largo y lo que hace falta es dejarlo limpio y suelto.",
    incluye: [
      "Baño con productos elegidos según su piel y su pelo",
      "Secado profesional y cepillado",
      "Corte de uñas",
      "Limpieza de oídos",
      "Fragancia suave al terminar",
    ],
    paraQuien:
      "Para perros de pelo corto, para los que ya vienen con su corte al día, y para quienes mantienen una rutina de baño cada pocas semanas.",
    servicioFormulario: "Baño completo (sin corte de pelo)",
    imagen: "/servicios/bano.png",
    imagenAlt: "Baño relajante — limpieza profunda con amor y cuidado",
    tamanoReferencia: "toy",
  },
  {
    slug: "spa-canino",
    nombre: "Spa canino",
    titulo: "Spa canino en Renca — el día completo de tu perro",
    descripcion:
      "Spa canino en Renca: baño, corte, deslanado, hidratación y toda la higiene en una sola visita. Para perros que necesitan más que un baño. Agenda online.",
    entrada:
      "Todo junto y sin apuro: baño, corte, deslanado, hidratación del pelaje y la higiene completa. Es la visita para cuando tu perro o perra necesita más que una pasada rápida.",
    incluye: [
      "Todo lo del baño y corte",
      "Deslanado: sacar el pelo muerto que el cepillo de casa no alcanza",
      "Hidratación del pelaje",
      "Limpieza de oídos y de glándulas",
      "Fragancia y accesorio al terminar",
    ],
    paraQuien:
      "Para perros que sueltan mucho pelo, que llegan con el pelaje reseco o apelmazado, y para los que vienen cada varios meses y necesitan ponerse al día.",
    servicioFormulario: "Spa completo",
    imagen: "/servicios/spa.png",
    imagenAlt: "Día de spa — relajación, mascarillas y mucho mimo",
    tamanoReferencia: "toy",
  },
  {
    slug: "corte-de-unas-para-perros",
    nombre: "Corte de uñas",
    titulo: "Corte de uñas para perros en Renca",
    descripcion:
      "Corte de uñas para perros en Renca, rápido y sin estrés. Revisamos también si hay uñas encarnadas. Reserva online o pasa a coordinarlo.",
    entrada:
      "Un servicio corto, y de los que más se agradecen. Cortamos a la altura correcta —sin llegar a la parte viva— y revisamos si alguna uña está creciendo hacia adentro, que es más común de lo que parece y duele.",
    incluye: [
      "Corte de uñas de las cuatro patas",
      "Revisión de uñas encarnadas o partidas",
      "Limado si hace falta, para que no rasguñen",
    ],
    paraQuien:
      "Para perros que caminan poco en superficies duras, para los de uñas oscuras —donde es difícil ver dónde cortar en casa— y para los que no se dejan en la casa.",
    servicioFormulario: "Solo uñas",
    imagen: "/servicios/unas.png",
    imagenAlt: "Cuidado de uñas — uñitas sanas, paseos seguros y sin rasguños",
    tamanoReferencia: "toy",
  },
];

export function servicioPorSlug(slug: string): Servicio | undefined {
  return SERVICIOS_PAGINA.find((s) => s.slug === slug);
}
