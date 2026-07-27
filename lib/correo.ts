/* Envío de correo por Resend. Solo servidor.

   Sin SDK, con `fetch` a la API REST: es un POST con JSON, y una dependencia
   menos en el bundle. Si algún día hacen falta adjuntos o webhooks, ahí sí
   conviene el paquete.

   Nada de esto puede voltear una reserva. Si Resend está caído, si falta la
   clave o si el correo rebota, la cita ya quedó en la base y el WhatsApp
   sale igual: el correo es un refuerzo, no el canal. Por eso todo devuelve
   un resultado en vez de lanzar. */

/** Lo que el cliente ve como remitente.

    Pedido del señor Ignacio: que se lea `@perrustingo.com`, aunque el correo
    que el equipo abre de verdad sea el de Gmail. Se puede porque el dominio
    está verificado en Resend (27-jul): el `From` sale con el dominio propio
    —y firmado con DKIM, así que no cae en spam— y `Reply-To` apunta al
    Gmail, de modo que cuando el cliente responde la respuesta llega donde el
    equipo la lee. Dos direcciones para dos cosas distintas. */
const REMITENTE = process.env.CORREO_REMITENTE ?? "Perrustingo <perrustingodatos@perrustingo.com>";

/** La bandeja real del salón: recibe el aviso de reserva y las respuestas. */
export const CORREO_EQUIPO = process.env.CORREO_EQUIPO ?? "perrustingodatos@gmail.com";

export interface ResultadoCorreo {
  ok: boolean;
  id?: string;
  error?: string;
}

interface Envio {
  para: string;
  asunto: string;
  html: string;
  /** Por defecto el Gmail del salón: quien responde, le responde al equipo. */
  responderA?: string;
}

export function correoConfigurado(): boolean {
  return Boolean(process.env.RESEND_API_KEY);
}

export async function enviarCorreo(envio: Envio): Promise<ResultadoCorreo> {
  const clave = process.env.RESEND_API_KEY;
  if (!clave) {
    /* Falta la clave: se dice, no se finge. Un "ok" acá haría creer que el
       cliente recibió una confirmación que nunca salió. */
    return { ok: false, error: "RESEND_API_KEY no está configurada" };
  }

  try {
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${clave}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: REMITENTE,
        to: [envio.para],
        reply_to: envio.responderA ?? CORREO_EQUIPO,
        subject: envio.asunto,
        html: envio.html,
      }),
    });

    const cuerpo = await r.json().catch(() => null);
    if (!r.ok) {
      return {
        ok: false,
        error: cuerpo?.message ?? `Resend respondió ${r.status}`,
      };
    }
    return { ok: true, id: cuerpo?.id };
  } catch (e: unknown) {
    return { ok: false, error: e instanceof Error ? e.message : "fallo de red" };
  }
}
