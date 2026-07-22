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

/* Overrideable por entorno para testear sin escribirle al cliente real
   (en local se apunta al número del equipo). */
export const WHATSAPP_NUMBER =
  process.env.NEXT_PUBLIC_WHATSAPP_NUMBER ?? "4915237152283";

export function whatsappUrl(message: string): string {
  return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;
}

export const BOOKING_URL = whatsappUrl(
  "Hola Perrustingo, quiero agendar una cita para mi perro. Nombre: … Raza/tamaño: … Servicio: …"
);
