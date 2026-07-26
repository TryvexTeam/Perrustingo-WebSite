/* Datos de contacto de quien reserva (PRP-003 F1).

   Hasta ahora reservar exigía cuenta, así que el contacto salía del perfil
   y el formulario no lo preguntaba. Al abrir la reserva a visitantes sin
   cuenta hay que pedírselos — sin ellos el equipo no puede confirmar la
   cita ni el dashboard sabe de dónde viene el negocio.

   Sin directiva de cliente: lo usan el formulario, el endpoint y el panel. */

export interface DatosContacto {
  nombre: string;
  telefono: string;
  email: string;
  comuna: string;
}

export const CONTACTO_VACIO: DatosContacto = {
  nombre: "",
  telefono: "",
  email: "",
  comuna: "",
};

/* Comunas del área que atiende Perrustingo (Renca y alrededores). La lista
   evita que "Quilicura", "quilicura" y "Kilicura" sean tres comunas
   distintas en el dashboard. "Otra" deja escribir a mano el resto. */
export const COMUNAS = [
  "Renca",
  "Cerro Navia",
  "Quinta Normal",
  "Pudahuel",
  "Conchalí",
  "Independencia",
  "Quilicura",
  "Lo Prado",
  "Estación Central",
  "Huechuraba",
  "Recoleta",
  "Santiago",
  "Otra",
] as const;

/** Solo dígitos: `+56 9 1234 5678`, `56912345678` y `9 1234 5678` son la
    misma persona. Un criterio único en todo el sitio — con dos, el
    historial de un cliente queda partido en dos y las ofertas por "segunda
    cita" no se le reconocen. */
export function normalizarTelefono(valor: string): string {
  const soloDigitos = valor.replace(/\D/g, "");
  // Chile: se guarda sin el prefijo país para que +56912345678 y 912345678
  // coincidan. 9 dígitos es el largo de un móvil chileno.
  if (soloDigitos.startsWith("56") && soloDigitos.length > 9) {
    return soloDigitos.slice(2);
  }
  return soloDigitos;
}

const LARGO_NOMBRE = 80;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Valida los datos de contacto. Devuelve el primer problema, o null.
    Se usa igual en el navegador (para no mandar viajes perdidos) y en el
    servidor (que es el que manda). */
export function validarContacto(datos: DatosContacto): string | null {
  if (datos.nombre.trim().length < 2) return "Escriba su nombre.";
  if (datos.nombre.length > LARGO_NOMBRE) return "El nombre es demasiado largo.";

  const tel = normalizarTelefono(datos.telefono);
  // Móvil chileno: 9 dígitos empezando en 9. Se aceptan fijos de 8 por si
  // alguien deja el número del local.
  if (tel.length < 8 || tel.length > 11) return "Revise el teléfono: faltan o sobran dígitos.";

  if (datos.email.trim().length === 0) return "Escriba su correo.";
  if (!EMAIL.test(datos.email.trim())) return "Ese correo no parece válido.";

  if (datos.comuna.trim().length === 0) return "Elija su comuna.";

  return null;
}

/** Formato lindo para mostrar: 912345678 → +56 9 1234 5678 */
export function formatearTelefono(valor: string): string {
  const t = normalizarTelefono(valor);
  if (t.length !== 9) return valor;
  return `+56 ${t.slice(0, 1)} ${t.slice(1, 5)} ${t.slice(5)}`;
}
