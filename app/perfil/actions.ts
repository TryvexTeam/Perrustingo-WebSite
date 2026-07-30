"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { validarDatos, type DatosEditables } from "@/lib/usuarios";

/* Gestión de los perros del propio cliente (pedido del señor Adley, 30-jul).

   Desde que la reserva reutiliza la ficha guardada, mantenerla al día dejó
   de ser cosmético: un peso viejo produce un precio estimado equivocado.
   El dueño del dato es el cliente — que la corrija él.

   Ninguna acción recibe `cliente_id`: todas operan con la sesión de quien
   llama, y la política RLS `cliente_ve_sus_perros` (FOR ALL, cliente_id =
   auth.uid()) garantiza que nadie toca un perro ajeno aunque adivine el id.
   El `.select()` verifica el efecto — la lección repetida del 30-jul: un
   UPDATE o DELETE filtrado por RLS no falla, devuelve éxito con 0 filas. */

interface ResultadoAccion {
  success: boolean;
  error?: string;
}

export interface FichaPerro {
  nombre: string;
  raza: string | null;
  pesoKg: number | null;
  contextura: "delgado" | "normal" | "robusto" | null;
  tipoPelo: string | null;
  temperamento: "se_deja" | "no_se_deja" | "complicado" | "no_lo_se" | null;
  alergias: string | null;
}

/** La misma vara que usa el endpoint de reservas para estos campos. */
function validarFicha(f: FichaPerro): string | null {
  const nombre = f.nombre.trim();
  if (nombre.length < 1 || nombre.length > 60) {
    return "El nombre debe tener entre 1 y 60 caracteres.";
  }
  if (f.raza && f.raza.length > 60) return "La raza es demasiado larga.";
  if (f.pesoKg != null && (Number.isNaN(f.pesoKg) || f.pesoKg < 0 || f.pesoKg > 120)) {
    return "El peso debe estar entre 0 y 120 kg.";
  }
  if (f.contextura && !["delgado", "normal", "robusto"].includes(f.contextura)) {
    return "Contextura inválida.";
  }
  if (f.tipoPelo && f.tipoPelo.length > 40) return "El tipo de pelo es demasiado largo.";
  if (
    f.temperamento &&
    !["se_deja", "no_se_deja", "complicado", "no_lo_se"].includes(f.temperamento)
  ) {
    return "Temperamento inválido.";
  }
  if (f.alergias && f.alergias.length > 200) return "Las alergias no pueden pasar de 200 caracteres.";
  return null;
}

function aFila(f: FichaPerro) {
  return {
    nombre: f.nombre.trim(),
    // Una raza escrita a mano que coincida con el catálogo se guarda tal
    // cual; cualquier otra también — el catálogo es sugerencia, no corsé.
    raza: f.raza?.trim() || null,
    peso_kg: f.pesoKg,
    contextura: f.contextura,
    tipo_pelo: f.tipoPelo?.trim() || null,
    temperamento: f.temperamento,
    alergias: f.alergias?.trim() || null,
  };
}

/** Actualiza los datos de contacto de la PROPIA cuenta.

    Importa más de lo que parece: el formulario de reserva toma el contacto
    del perfil, así que un teléfono viejo acá significa que el salón llama a
    un número muerto para confirmar la cita. Hasta hoy el cliente no tenía
    ninguna forma de corregirlo.

    La política `perfil_propio` limita el UPDATE a la fila propia, y el
    trigger `protege_rol` impide que por esta vía alguien toque su rol — que
    ni siquiera viaja en el payload. */
export async function actualizarMisDatosAction(datos: DatosEditables): Promise<ResultadoAccion> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Sesión expirada." };

  const problema = validarDatos(datos);
  if (problema) return { success: false, error: problema };

  const { data, error } = await supabase
    .from("perfiles")
    .update({
      nombre: datos.nombre.trim(),
      apellido: datos.apellido.trim() || null,
      telefono: datos.telefono.trim() || null,
      comuna: datos.comuna.trim() || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", user.id)
    .select("id");

  if (error) return { success: false, error: "No se pudo guardar." };
  if (!data || data.length === 0) {
    return { success: false, error: "No se pudo guardar (permisos)." };
  }

  revalidatePath("/perfil");
  revalidatePath("/reserva");
  return { success: true };
}

/** Actualiza la ficha de un perro propio. */
export async function guardarPerroAction(
  perroId: string,
  ficha: FichaPerro
): Promise<ResultadoAccion> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Sesión expirada." };

  const problema = validarFicha(ficha);
  if (problema) return { success: false, error: problema };

  const { data, error } = await supabase
    .from("perros")
    .update(aFila(ficha))
    .eq("id", perroId)
    .eq("cliente_id", user.id)
    .select("id");

  if (error) return { success: false, error: "No se pudo guardar." };
  if (!data || data.length === 0) {
    return { success: false, error: "No se encontró ese perro en tu cuenta." };
  }

  revalidatePath("/perfil");
  return { success: true };
}

/** Crea un perro nuevo en la cuenta, listo para la próxima reserva. */
export async function crearPerroAction(ficha: FichaPerro): Promise<ResultadoAccion> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Sesión expirada." };

  const problema = validarFicha(ficha);
  if (problema) return { success: false, error: problema };

  const { data, error } = await supabase
    .from("perros")
    .insert({ cliente_id: user.id, ...aFila(ficha) })
    .select("id");

  if (error) return { success: false, error: "No se pudo guardar." };
  if (!data || data.length === 0) {
    return { success: false, error: "No se pudo crear la ficha (permisos)." };
  }

  revalidatePath("/perfil");
  return { success: true };
}

/** Elimina un perro propio. Sus citas pasadas NO se tocan: `sesiones.perro_id`
    es ON DELETE SET NULL, así que el historial del negocio queda entero —
    solo pierde la referencia a la ficha. */
export async function eliminarPerroAction(perroId: string): Promise<ResultadoAccion> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Sesión expirada." };

  const { data, error } = await supabase
    .from("perros")
    .delete()
    .eq("id", perroId)
    .eq("cliente_id", user.id)
    .select("id");

  if (error) return { success: false, error: "No se pudo eliminar." };
  if (!data || data.length === 0) {
    return { success: false, error: "No se encontró ese perro en tu cuenta." };
  }

  revalidatePath("/perfil");
  return { success: true };
}
