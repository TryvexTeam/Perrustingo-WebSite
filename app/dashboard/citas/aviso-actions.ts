"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { crearClienteServicio } from "@/lib/supabase/servicio";
import { esFallo, exigirCitaPropia } from "@/lib/citasAcceso";
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

  /* El chequeo de dueño va ANTES de leer el contacto, no después: acá el
     riesgo no es solo mandar un correo indebido, es que la lectura misma
     entrega el `contacto_email` que la vista `sesiones_equipo` le niega al
     trabajador desde la 027. Sin este filtro, pedir el aviso de una cita ajena
     era la forma de sacar por la puerta de atrás el dato que se protege por
     delante. Ver lib/citasAcceso.ts. */
  const permiso = await exigirCitaPropia(admin, citaId, perfil.rol, user.id);
  if (esFallo(permiso)) return { success: false, error: permiso.error };

  const { data: cita } = await admin
    .from("sesiones")
    .select("estado, servicio, contacto_nombre, contacto_email, detalle_form, aviso_listo_en")
    .eq("id", citaId)
    .single();

  if (!cita) return { success: false, error: "Cita no encontrada." };

  /* Ya se avisó. El botón del panel se bloquea al enviar, pero ese estado
     vive solo mientras el panel esté abierto: cerrarlo y reabrirlo lo
     reiniciaba y el cliente recibía el aviso de nuevo (pasó el 30-jul, dos
     correos en tres minutos). La única defensa que sobrevive a una recarga
     es la que está en la base. */
  if (cita.aviso_listo_en) {
    /* Sin punto final: el formato es-CL ya termina en "p. m." y quedaban dos
       puntos seguidos. */
    const cuando = new Date(cita.aviso_listo_en).toLocaleString("es-CL", {
      timeZone: "America/Santiago",
    });
    return { success: false, error: `Ya se avisó el ${cuando} — no se reenvía` };
  }

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

  /* Se marca DESPUÉS de que Resend aceptó, no antes: si el envío falla, la
     cita queda sin marcar y el aviso se puede reintentar. Al revés —marcar
     primero— un fallo de red dejaría al cliente sin aviso y sin manera de
     mandarlo de nuevo. */
  const { error: errorMarca } = await admin
    .from("sesiones")
    .update({ aviso_listo_en: new Date().toISOString() })
    .eq("id", citaId);

  if (errorMarca) {
    /* El correo YA salió; no se puede deshacer. Se registra para que quede
       rastro de que la marca no quedó y el aviso podría repetirse. */
    console.error("[avisarPerroListo] el correo salió pero no se marcó la cita", {
      citaId,
      mensaje: errorMarca.message,
    });
  }

  revalidatePath("/dashboard/citas");

  /* Solo el veredicto. Ni el correo, ni el teléfono, ni el id del mensaje:
     nada con que reconstruir el dato protegido. */
  return { success: true };
}
