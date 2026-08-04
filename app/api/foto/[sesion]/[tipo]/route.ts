import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { BUCKET_FOTOS, rutaDeFoto } from "@/lib/fotosComun";

/* GET /api/foto/<sesion>/<tipo> — la foto de una cita, vista desde WhatsApp.

   Por qué existe (pedido del señor Ignacio, 27-jul: "que llegue el mensaje
   con la foto, sí o sí"):

   WhatsApp no deja adjuntar archivos desde un enlace `wa.me` — por ahí solo
   viaja texto. Lo que sí viaja es una dirección, y WhatsApp le muestra la
   vista previa al equipo dentro del chat. Esta ruta es esa dirección: corta
   —el mensaje tiene largo limitado y una URL firmada de Storage se come
   cientos de caracteres—, estable, y sin secretos a la vista.

   Por qué no se firma en el navegador: desde PRP-002 F4 el bucket es privado
   y solo el equipo puede leerlo. Quien reserva sin cuenta no tiene permiso
   para firmar ni su propia foto, así que la firma tiene que ocurrir acá.

   Qué protege el acceso: el UUID de la sesión, que no se puede adivinar y
   que solo conocen el cliente que reservó y el equipo. Es el mismo criterio
   con el que ya viajaba el enlace a la ficha en el mensaje. A cambio, la
   firma dura poco: si el enlace se reenvía, lo que se copia es esta
   dirección, no una llave permanente al archivo. */

export const dynamic = "force-dynamic";

const TIPOS_PERMITIDOS = new Set(["antes", "referencia", "despues"]);

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ sesion: string; tipo: string }> }
) {
  const { sesion, tipo } = await params;

  if (!TIPOS_PERMITIDOS.has(tipo)) {
    return NextResponse.json({ error: "Tipo de foto desconocido." }, { status: 400 });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const servicio = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !servicio) {
    /* Sin la credencial de servicio esto no puede funcionar, y decirlo es
       mejor que devolver una imagen rota: el mensaje de WhatsApp deja de
       incluir el enlace (lo decide el formulario) y el equipo mira la foto
       en el panel, como siempre. */
    return NextResponse.json(
      { error: "El servidor no tiene configurado el acceso a las fotos." },
      { status: 503 }
    );
  }

  /* Cliente de servicio: se salta RLS a propósito, porque el destinatario de
     este enlace —el equipo mirando su WhatsApp— no está logueado en el sitio.
     Nunca llega al navegador: esta clave solo vive en el servidor. */
  const supabase = createClient(url, servicio, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: fila, error } = await supabase
    .from("fotos_sesion")
    .select("ruta, url")
    .eq("sesion_id", sesion)
    .eq("tipo", tipo)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !fila) {
    return NextResponse.json({ error: "No encontramos esa foto." }, { status: 404 });
  }

  const ruta = rutaDeFoto(fila);
  if (!ruta) {
    return NextResponse.json({ error: "No encontramos esa foto." }, { status: 404 });
  }

  /* Dos minutos: lo justo para que WhatsApp arme la vista previa y para que
     alguien la abra al tocarla. */
  const { data: firmada, error: errFirma } = await supabase.storage
    .from(BUCKET_FOTOS)
    .createSignedUrl(ruta, 120);

  if (errFirma || !firmada?.signedUrl) {
    return NextResponse.json({ error: "No pudimos abrir la foto." }, { status: 502 });
  }

  /* Redirección y no proxy: la imagen la sirve Storage, sin pasar los bytes
     por la función. `no-store` para que ningún intermediario se quede con la
     redirección, que caduca en dos minutos. */
  return NextResponse.redirect(firmada.signedUrl, {
    status: 302,
    headers: { "Cache-Control": "no-store" },
  });
}
