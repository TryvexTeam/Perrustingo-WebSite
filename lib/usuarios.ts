/* Usuarios del sistema — dominio y tipos compartidos entre la página del
   panel (server) y el gestor (cliente). La escritura vive en
   app/dashboard/usuarios/actions.ts; acá solo tipos y helpers puros.
   Mismo espíritu que lib/citas.ts: el dominio no importa React. */

export const ROLES = ["cliente", "trabajador", "admin"] as const;

export type Rol = (typeof ROLES)[number];

export const ROL_LABEL: Record<Rol, string> = {
  cliente: "Cliente",
  trabajador: "Trabajador",
  admin: "Admin",
};

export const ROL_DESCRIPCION: Record<Rol, string> = {
  cliente: "Reserva y ve solo sus propias citas.",
  trabajador: "Entra al panel y gestiona citas.",
  admin: "Todo lo anterior + tarifas, anuncios y usuarios.",
};

export const ROL_COLOR: Record<Rol, string> = {
  cliente: "bg-zinc-100 text-zinc-600",
  trabajador: "bg-[#d5efe2] text-teal-dark",
  admin: "bg-[#fde4c8] text-[#7a4d10]",
};

/** Un perfil tal como lo lista el panel. `email` viene de auth.users, que
    no es legible con la clave anon — se resuelve en la página server. */
export interface PerfilAdmin {
  id: string;
  rol: Rol;
  nombre: string | null;
  apellido: string | null;
  telefono: string | null;
  comuna: string | null;
  es_peluquero: boolean;
  created_at: string;
}

/** Campos que el panel puede editar de otro perfil. `rol` y `es_peluquero`
    van aparte a propósito: cambiar un rol es una acción con consecuencias
    de seguridad, no un campo más de un formulario de datos. */
export interface DatosEditables {
  nombre: string;
  apellido: string;
  telefono: string;
  comuna: string;
}

export function esRol(valor: string): valor is Rol {
  return (ROLES as readonly string[]).includes(valor);
}

export function nombreCompleto(perfil: PerfilAdmin): string {
  const partes = [perfil.nombre, perfil.apellido].filter(Boolean);
  return partes.length > 0 ? partes.join(" ") : "Sin nombre";
}

const LARGO_MAX = 60;
const TELEFONO_MAX = 20;

/** Valida lo mismo que el server action, para no mandar viajes perdidos.
    NO reemplaza la validación del servidor — la duplica a propósito. */
export function validarDatos(datos: DatosEditables): string | null {
  if (datos.nombre.trim().length === 0) return "El nombre no puede quedar vacío.";
  if (datos.nombre.length > LARGO_MAX) return "El nombre es demasiado largo.";
  if (datos.apellido.length > LARGO_MAX) return "El apellido es demasiado largo.";
  if (datos.comuna.length > LARGO_MAX) return "La comuna es demasiado larga.";
  if (datos.telefono.length > TELEFONO_MAX) return "El teléfono es demasiado largo.";
  if (datos.telefono.trim().length > 0 && !/^[\d+\s()-]+$/.test(datos.telefono)) {
    return "El teléfono solo puede tener números, espacios, +, ( ) y guiones.";
  }
  return null;
}
