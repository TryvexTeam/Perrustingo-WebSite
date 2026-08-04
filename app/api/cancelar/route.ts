import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { supabaseConfigurado } from "@/lib/citas";

/* POST /api/cancelar?token=<uuid> — el cliente cancela su cita desde el correo.
 *
 * SOLO POST, a propósito. Un GET que cancela es una bomba: WhatsApp, Gmail y
 * cualquier antivirus corporativo abren los enlaces para generar la vista
 * previa, y la cita quedaría cancelada sin que nadie la haya cancelado. La
 * página /cancelar hace el GET para mostrar el aviso, y este POST solo corre
 * cuando una persona aprieta el botón.
 *
 * Toda la regla vive en la función `cancelar_con_token` (migración 035): valida,
 * cancela y registra la penalización en una sola transacción. Acá no se decide
 * nada de negocio; se traduce el resultado a algo que una persona entienda.
 */

/** Motivos que devuelve la función, en castellano. NUNCA un rechazo mudo: un
    error sin explicación deja al cliente sin saber si su cita sigue en pie. */
const MOTIVOS: Record<string, string> = {
  no_encontrada:
    "No encontramos esta cita. Puede que el enlace esté incompleto o que la cita ya no exista. Escríbanos y lo vemos.",
  ya_cancelada: "Esta cita ya estaba cancelada. No hay nada más que hacer.",
  ya_paso: "Esta cita ya pasó, así que no se puede cancelar. Si necesita algo, escríbanos.",
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token")?.trim() ?? "";

  /* Se valida la forma antes de ir a la base: un token mal escrito haría
     fallar el cast a uuid en Postgres con un error de tipo, que llegaría como
     500 y se leería como "el sistema está caído" en vez de "el enlace está
     malo". */
  if (!UUID.test(token)) {
    return NextResponse.json(
      { ok: false, motivo: "token_invalido", mensaje: "El enlace no es válido. Cópielo completo desde su correo." },
      { status: 400 }
    );
  }

  if (!supabaseConfigurado()) {
    return NextResponse.json(
      {
        ok: false,
        motivo: "sin_base",
        mensaje: "Ahora mismo no podemos procesar la cancelación. Escríbanos por WhatsApp y la anulamos nosotros.",
      },
      { status: 503 }
    );
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("cancelar_con_token", { p_token: token });

  if (error) {
    /* Se registra con detalle porque este camino corre sin sesión y sin nadie
       mirando: sin el log, un fallo de permisos y una función ausente se ven
       exactamente igual desde afuera. */
    console.error("[cancelar] la función rechazó la cancelación", {
      codigo: error.code,
      mensaje: error.message,
    });
    return NextResponse.json(
      {
        ok: false,
        motivo: "error_servidor",
        mensaje: "No pudimos cancelar la cita en este momento. Inténtelo de nuevo o escríbanos por WhatsApp.",
      },
      { status: 500 }
    );
  }

  const r = (data ?? {}) as {
    ok?: boolean;
    penalizada?: boolean;
    pct?: number | string;
    pierde_cupon?: boolean;
    cupon?: string | null;
    motivo?: string;
  };

  if (!r.ok) {
    const motivo = r.motivo ?? "desconocido";
    return NextResponse.json(
      {
        ok: false,
        motivo,
        mensaje: MOTIVOS[motivo] ?? "No pudimos cancelar la cita. Escríbanos y lo resolvemos.",
      },
      // `ya_cancelada` no es culpa de nadie ni un error del servidor: el
      // estado que el cliente pedía ya es el actual.
      { status: motivo === "ya_cancelada" ? 200 : 409 }
    );
  }

  const pct = Number(r.pct ?? 0);
  return NextResponse.json({
    ok: true,
    penalizada: Boolean(r.penalizada),
    pct,
    pierdeCupon: Boolean(r.pierde_cupon),
    cupon: r.cupon ?? null,
    mensaje: r.penalizada
      ? `Su cita quedó cancelada. Por cancelar con poca anticipación, su próxima cita tendrá un recargo del ${pct}%.`
      : "Su cita quedó cancelada. Sin costo.",
  });
}

/* GET solo informa: dice que el enlace existe y que falta apretar el botón.
   Deliberadamente NO toca la base — ver el comentario de arriba sobre las
   vistas previas de los enlaces. */
export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token")?.trim() ?? "";
  if (!UUID.test(token)) {
    return NextResponse.json(
      { ok: false, motivo: "token_invalido", mensaje: "El enlace no es válido." },
      { status: 400 }
    );
  }
  return NextResponse.json({
    ok: false,
    motivo: "confirmacion_requerida",
    mensaje: "Abra la página de cancelación y confirme para anular la cita.",
  });
}
