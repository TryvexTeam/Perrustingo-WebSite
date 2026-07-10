import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { solicitudCitaSchema, supabaseConfigurado } from "@/lib/citas";

/* POST /api/reservas — crea una solicitud de cita en estado 'pendiente'.
   Funciona logueado (liga cliente_id) o anónimo (solo datos de contacto). */

const VENTANA_MS = 10 * 60 * 1000;
const MAX_POR_VENTANA = 5;
const intentos = new Map<string, { count: number; desde: number }>();

function excedeLimite(ip: string): boolean {
  const ahora = Date.now();
  const reg = intentos.get(ip);
  if (!reg || ahora - reg.desde > VENTANA_MS) {
    intentos.set(ip, { count: 1, desde: ahora });
    return false;
  }
  reg.count += 1;
  return reg.count > MAX_POR_VENTANA;
}

export async function POST(request: NextRequest) {
  if (!supabaseConfigurado()) {
    return NextResponse.json(
      { success: false, error: "Base de datos no configurada todavía." },
      { status: 503 }
    );
  }

  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  if (excedeLimite(ip)) {
    return NextResponse.json(
      { success: false, error: "Demasiadas solicitudes. Intenta en unos minutos." },
      { status: 429 }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, error: "Cuerpo inválido." },
      { status: 400 }
    );
  }

  const parsed = solicitudCitaSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: "Datos de solicitud inválidos." },
      { status: 400 }
    );
  }

  const { contacto, fechaDeseada, servicio, precioEstimado, detalle } = parsed.data;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data, error } = await supabase
    .from("sesiones")
    .insert({
      estado: "pendiente",
      cliente_id: user?.id ?? null,
      fecha_cita: `${fechaDeseada}T00:00:00-04:00`,
      servicio,
      precio_base: precioEstimado,
      contacto_nombre: contacto.nombre,
      contacto_email: contacto.email,
      contacto_telefono: contacto.telefono,
      detalle_form: detalle,
    })
    .select("id")
    .single();

  if (error) {
    return NextResponse.json(
      { success: false, error: "No se pudo registrar la solicitud." },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true, data: { id: data.id } }, { status: 201 });
}
