/* La dirección pública del sitio. Un solo lugar, y no una constante por
   archivo, porque justamente eso fue lo que falló:

   Hasta el 27-jul el `metadataBase`, el sitemap, el robots.txt, la etiqueta
   og:url y los datos estructurados decían "perrustingo.cl" — un dominio que
   no responde— mientras el sitio vive en .com. O sea: lo que se compartía por
   WhatsApp apuntaba a la nada, el sitemap ofrecía a Google direcciones de
   otro sitio, y la ficha de negocio que Google lee para las búsquedas
   locales daba una URL muerta. Es difícil imaginar algo que estorbe más al
   objetivo de aparecer primero al buscar "peluquería canina Renca".

   Configurable por entorno para los previews, con el dominio real de
   respaldo: si la variable falta, se cae al valor correcto, no a uno roto. */
export const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://perrustingo.com"
).replace(/\/+$/, "");

export const SITE = {
  name: "Perrustingo",
  tagline: "Peluquería Canina",
  address: "Arturo Prat 4556, Renca, Santiago",
  mapsUrl:
    "https://www.google.com/maps/place/Peluqueria+Canina+Perrustingo/@-33.4035606,-70.7133999,17z",
  rating: 4.6,
  reviewCount: 135,
  instagram: "https://instagram.com/perrustingo",
  facebook: "https://facebook.com/perrustingo",
  hours: "Lun a Sáb · 9:00 a 17:00",
} as const;

/* El WhatsApp del salón. Sale SIEMPRE del entorno y no tiene respaldo a
   propósito.

   Hasta el 27-jul había uno escrito acá —"4915237152283", un número alemán
   que se dejó como prueba hace meses— y la variable nunca se configuró en
   Vercel. Es decir: producción llevaba semanas mandando reservas de clientes
   reales, con nombre, teléfono y comuna, al WhatsApp de un desconocido en
   Alemania, y nadie se enteró porque el sitio "funcionaba".

   Ese es el costo de un respaldo silencioso: convierte una configuración
   faltante en una fuga de datos que no avisa. Sin la variable ahora no hay
   número, el formulario lo dice en pantalla, y el error se ve el primer día
   en vez de descubrirse por casualidad. */
export const WHATSAPP_NUMBER = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER ?? "";

export const hayWhatsAppConfigurado = (): boolean =>
  /^\d{8,15}$/.test(WHATSAPP_NUMBER);
