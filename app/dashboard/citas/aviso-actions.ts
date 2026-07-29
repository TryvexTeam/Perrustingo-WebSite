"use server";

import { createClient } from "@/lib/supabase/server";
import { crearClienteServicio } from "@/lib/supabase/servicio";
import { enviarCorreo, correoConfigurado } from "@/lib/correo";
import { correoPerroListo } from "@/lib/correoPlantillas";

/* Avisar al cliente que su perrito está listo (reunión con Rodolfo, 27-jul).

   Lo importante de esta acción es lo que NO hace: nunca devuelve el correo
   ni el teléfono. Desde la migración 027 el peluquero tampoco puede leerlos
   —la vista `sesiones_equipo` se los entrega en NULL—, así que el contacto
   se resuelve acá, en el servidor, y se usa solo para despachar el mensaje.

   Por eso hace falta el cliente de servicio: la sesión del peluquero, por
   diseño, ya no alcanza esa columna.

   Decisión deliberada: NO se expone una función RPC que devuelva el correo.
   Todo lo que se publica por PostgREST queda al alcance del navegador del
   peluquero — justo de quien se protege el dato. */

interface ResultadoAviso {
  success: boolean;
  error?: string;
}

export async function avisarPerroListoAction(citaId: string): Promise<ResultadoAviso> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Sesión expirada." };

  const { data: perfil } = await supabase
    .from("perfiles")
    .select("rol")
    .eq("id", user.id)
    .single();
  if (!perfil || !["admin", "trabajador"].includes(perfil.rol)) {
    return { success: false, error: "Sin permisos." };
  }

  if (!correoConfigurado()) {
    return { success: false, error: "El envío de correos no está configurado todavía." };
  }

  const admin = crearClienteServicio();
  if (!admin) {
    return {
      success: false,
      error: "El servidor no puede enviar el aviso (falta configuración).",
    };
  }

  const { data: cita } = await admin
    .from("sesiones")
    .select("estado, servicio, contacto_nombre, contacto_email, detalle_form")
    .eq("id", citaId)
    .single();

  if (!cita) return { success: false, error: "Cita no encontrada." };

  /* Solo cuando el trabajo ya está en marcha o terminado. Avisar antes hace
     que la persona llegue a un perrito a medio secar, y un correo enviado no
     se puede recoger. */
  if (!["en_proceso", "completada"].includes(cita.estado)) {
    return { success: false, error: "La cita todavía no está en proceso ni completada." };
  }

  if (!cita.contacto_email) {
    /* Sin correo no hay aviso por esta vía, y se dice tal cual: un "listo"
       en falso haría que nadie pase a buscar al perrito. */
    return {
      success: false,
      error: "Esta cita no tiene correo de contacto. Avise por el canal habitual.",
    };
  }

  const detalle = (cita.detalle_form ?? {}) as Record<string, string>;
  const { asunto, html } = correoPerroListo({
    nombreCliente: cita.contacto_nombre ?? "",
    nombrePerro: detalle.nombrePerro ?? null,
    servicio: cita.servicio ?? "el servicio",
  });

  const envio = await enviarCorreo({ para: cita.contacto_email, asunto, html });
  if (!envio.ok) {
    return { success: false, error: "No se pudo enviar el aviso. Intente de nuevo." };
  }

  /* Solo el veredicto. Ni el correo, ni el teléfono, ni el id del mensaje:
     nada con que reconstruir el dato protegido. */
  return { success: true };
}
