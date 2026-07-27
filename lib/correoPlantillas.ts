/* Los dos correos que salen cuando alguien reserva: el del cliente y el del
   equipo. Pedido del señor Ignacio, 27-jul.

   Están escritos en HTML de correo, que no es HTML de web: tablas en vez de
   flex o grid, estilos en línea en vez de clases, y ancho fijo de 600px.
   No es descuido — Gmail borra la etiqueta <style> de la cabecera y Outlook
   ignora flex. Lo que acá parece anticuado es lo único que se ve igual en
   los dos.

   La paleta es la misma del sitio (app/globals.css), copiada como literales
   porque un correo no puede leer variables CSS. */

const TEAL_INK = "#063a40";
const TEAL = "#00a6a8";
const CREAM = "#edf3ff";
const INK = "#2f3e46";
const INK_SOFT = "#5b6b72";
const ORANGE = "#f49d37";
const ORANGE_SOFT = "#fdeed8";

/** Un perrito, con lo que el correo necesita mostrar de él. */
export interface PerroCorreo {
  nombre: string;
  raza: string;
  /** Ya formateado como rango ("$38.000 a $40.000"), no como número. */
  precio: string | null;
  /** Enlaces a las fotos que el cliente adjuntó, si hay. */
  fotoActual?: string | null;
  fotoReferencia?: string | null;
}

export interface DatosCorreo {
  cliente: { nombre: string; email: string; telefono: string; comuna?: string | null };
  perros: PerroCorreo[];
  servicio: string;
  /** Legible: "jueves 30 de julio, 15:00". */
  cuando: string;
  totalEstimado: string | null;
  /** Enlace `wa.me` ya armado, con el mensaje de seguimiento dentro. */
  urlWhatsApp: string | null;
  /** Enlace a la ficha en el panel — solo va en el correo del equipo. */
  urlFicha?: string | null;
}

/** Escapa lo que viene del formulario. Un nombre con `<` rompería el correo,
    y un nombre con etiquetas sería una inyección en la bandeja del equipo. */
function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function boton(url: string, texto: string, color = TEAL): string {
  /* Botón de correo: un <a> con padding, no un <button>. Y con `border` del
     mismo color para que Outlook no lo dibuje transparente. */
  return `<a href="${esc(url)}" style="display:inline-block;background:${color};border:1px solid ${color};color:#ffffff;font-family:Verdana,Geneva,sans-serif;font-size:15px;font-weight:bold;text-decoration:none;padding:14px 28px;border-radius:999px;">${esc(texto)}</a>`;
}

function fila(etiqueta: string, valor: string): string {
  return `<tr>
    <td style="padding:6px 0;font-family:Verdana,Geneva,sans-serif;font-size:13px;color:${INK_SOFT};width:38%;vertical-align:top;">${esc(etiqueta)}</td>
    <td style="padding:6px 0;font-family:Verdana,Geneva,sans-serif;font-size:13px;color:${INK};font-weight:bold;">${valor}</td>
  </tr>`;
}

/** El aviso que el señor Ignacio pidió que nunca falte: el rango es una
    referencia, el valor de verdad se dice en la puerta antes de empezar. */
function avisoPrecio(): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${ORANGE_SOFT};border-radius:14px;margin:22px 0;">
    <tr><td style="padding:16px 20px;font-family:Verdana,Geneva,sans-serif;font-size:12px;line-height:1.7;color:#8a5a12;">
      <strong>Sobre el precio:</strong> el monto de arriba es una estimación en rango.
      El valor final depende de cómo llegue el pelito, del comportamiento durante la
      sesión y de la mantención en casa — <strong>se te confirma en la puerta, siempre
      antes de empezar</strong>. Nunca hay sorpresas al final.
    </td></tr>
  </table>`;
}

function envoltura(contenido: string, preheader: string, pie: string): string {
  /* El preheader es el texto gris que Gmail muestra al lado del asunto. Si
     no se pone, muestra el primer texto del correo — que suele ser el
     nombre del salón repetido. */
  return `<!DOCTYPE html>
<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:${CREAM};">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;">${esc(preheader)}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${CREAM};padding:28px 12px;">
    <tr><td align="center">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:600px;max-width:100%;background:#ffffff;border-radius:22px;overflow:hidden;">
        <tr><td style="background:${TEAL_INK};padding:26px 32px;">
          <div style="font-family:Georgia,'Times New Roman',serif;font-size:24px;font-weight:bold;color:#ffffff;letter-spacing:-0.5px;">Perrustingo</div>
          <div style="font-family:Verdana,Geneva,sans-serif;font-size:11px;color:#8fd4d6;letter-spacing:2px;text-transform:uppercase;margin-top:4px;">Peluquería Canina</div>
        </td></tr>
        <tr><td style="padding:32px;">${contenido}</td></tr>
        <tr><td style="background:${CREAM};padding:22px 32px;font-family:Verdana,Geneva,sans-serif;font-size:11px;line-height:1.8;color:${INK_SOFT};">
          Arturo Prat 4556, Renca, Santiago · Lun a Sáb, 9:00 a 17:00<br>
          ${pie}
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

function bloquePerros(perros: PerroCorreo[], conFotos: boolean): string {
  return perros
    .map(
      (p) => `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e3ebf5;border-radius:16px;margin-bottom:14px;">
      <tr><td style="padding:18px 20px;">
        <div style="font-family:Georgia,'Times New Roman',serif;font-size:18px;font-weight:bold;color:${TEAL_INK};">${esc(p.nombre)}</div>
        <div style="font-family:Verdana,Geneva,sans-serif;font-size:12px;color:${INK_SOFT};margin-top:2px;">${esc(p.raza)}</div>
        ${
          p.precio
            ? `<div style="font-family:Verdana,Geneva,sans-serif;font-size:14px;color:${INK};margin-top:10px;">Estimado: <strong>${esc(p.precio)}</strong></div>`
            : ""
        }
        ${
          conFotos && (p.fotoActual || p.fotoReferencia)
            ? `<div style="margin-top:12px;font-family:Verdana,Geneva,sans-serif;font-size:12px;">
                ${p.fotoActual ? `<a href="${esc(p.fotoActual)}" style="color:${TEAL};font-weight:bold;">Ver foto de ${esc(p.nombre)}</a>` : ""}
                ${p.fotoActual && p.fotoReferencia ? " &nbsp;·&nbsp; " : ""}
                ${p.fotoReferencia ? `<a href="${esc(p.fotoReferencia)}" style="color:${TEAL};font-weight:bold;">Corte de referencia</a>` : ""}
               </div>`
            : ""
        }
      </td></tr>
    </table>`
    )
    .join("");
}

/** Correo para el cliente: confirma que la solicitud llegó y le deja el
    WhatsApp a un toque para seguirla. */
export function correoCliente(d: DatosCorreo): { asunto: string; html: string } {
  const nombres = d.perros.map((p) => p.nombre).join(" y ");
  const contenido = `
    <div style="font-family:Verdana,Geneva,sans-serif;font-size:11px;letter-spacing:2px;text-transform:uppercase;color:${TEAL};font-weight:bold;">Reserva recibida</div>
    <h1 style="font-family:Georgia,'Times New Roman',serif;font-size:26px;line-height:1.3;color:${TEAL_INK};margin:8px 0 0;">
      ¡Gracias, ${esc(d.cliente.nombre.split(" ")[0] || "")}! Ya tenemos la cita de ${esc(nombres)}
    </h1>
    <p style="font-family:Verdana,Geneva,sans-serif;font-size:14px;line-height:1.8;color:${INK_SOFT};margin:14px 0 0;">
      Quedó registrada como <strong style="color:${INK};">pendiente</strong>. Nuestra atención al
      cliente te escribe por WhatsApp para cerrar la hora — normalmente el mismo día.
    </p>

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${CREAM};border-radius:16px;margin:22px 0;">
      <tr><td style="padding:18px 22px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
          ${fila("Servicio", esc(d.servicio))}
          ${fila("Día y hora", esc(d.cuando))}
          ${d.totalEstimado ? fila("Estimado total", esc(d.totalEstimado)) : ""}
          ${fila("Te contactamos al", esc(d.cliente.telefono))}
        </table>
      </td></tr>
    </table>

    ${bloquePerros(d.perros, false)}
    ${avisoPrecio()}

    ${
      d.urlWhatsApp
        ? `<div style="text-align:center;margin:26px 0 8px;">
             ${boton(d.urlWhatsApp, "Seguir mi reserva por WhatsApp")}
             <div style="font-family:Verdana,Geneva,sans-serif;font-size:11px;color:${INK_SOFT};margin-top:10px;">
               Se abre el chat del salón con tu reserva escrita — no necesitas tenernos agendados.
             </div>
           </div>`
        : ""
    }`;

  return {
    asunto: `Tu reserva en Perrustingo — ${nombres}, ${d.cuando}`,
    html: envoltura(
      contenido,
      `Recibimos la cita de ${nombres}. Te escribimos por WhatsApp para cerrar la hora.`,
      "Escríbenos respondiendo este correo — lo lee el equipo."
    ),
  };
}

/** Correo para el equipo: lo que hace falta para preparar la sesión y
    contestarle al cliente sin abrir el panel. */
export function correoEquipo(d: DatosCorreo): { asunto: string; html: string } {
  const nombres = d.perros.map((p) => p.nombre).join(" y ");
  const contenido = `
    <div style="font-family:Verdana,Geneva,sans-serif;font-size:11px;letter-spacing:2px;text-transform:uppercase;color:${ORANGE};font-weight:bold;">Nueva reserva pendiente</div>
    <h1 style="font-family:Georgia,'Times New Roman',serif;font-size:24px;line-height:1.3;color:${TEAL_INK};margin:8px 0 0;">
      ${esc(nombres)} — ${esc(d.cuando)}
    </h1>

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${CREAM};border-radius:16px;margin:20px 0;">
      <tr><td style="padding:18px 22px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
          ${fila("Cliente", esc(d.cliente.nombre))}
          ${fila("Teléfono", `<a href="tel:${esc(d.cliente.telefono)}" style="color:${TEAL};">${esc(d.cliente.telefono)}</a>`)}
          ${fila("Correo", `<a href="mailto:${esc(d.cliente.email)}" style="color:${TEAL};">${esc(d.cliente.email)}</a>`)}
          ${d.cliente.comuna ? fila("Comuna", esc(d.cliente.comuna)) : ""}
          ${fila("Servicio", esc(d.servicio))}
          ${d.totalEstimado ? fila("Estimado", esc(d.totalEstimado)) : ""}
        </table>
      </td></tr>
    </table>

    ${bloquePerros(d.perros, true)}

    ${
      d.urlFicha
        ? `<div style="text-align:center;margin:24px 0 6px;">${boton(d.urlFicha, "Abrir la ficha en el panel", TEAL_INK)}</div>`
        : ""
    }
    <p style="font-family:Verdana,Geneva,sans-serif;font-size:11px;line-height:1.7;color:${INK_SOFT};margin-top:18px;text-align:center;">
      Los enlaces de foto caducan a los dos minutos de abrirlos; si expira, se vuelve a abrir desde acá.
    </p>`;

  return {
    asunto: `Reserva pendiente: ${nombres} — ${d.cuando}`,
    html: envoltura(
      contenido,
      `${d.cliente.nombre} · ${d.cliente.telefono} · ${d.servicio}`,
      /* Distinto del pie del cliente a propósito: este correo lleva
         `Reply-To` al cliente, así que responderlo le escribe a él. Decir
         acá "lo lee el equipo" sería mentirle al propio equipo. */
      `Responder este correo le escribe directamente a ${esc(d.cliente.nombre)}.`
    ),
  };
}
