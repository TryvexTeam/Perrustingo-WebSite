import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { supabaseConfigurado } from "@/lib/citas";
import { hoyEnSantiago } from "@/lib/disponibilidad";
import { evaluarCupon } from "@/lib/cupones";
import { contarVisitasPrevias, obtenerCupon } from "@/lib/cuponesDatos";

/* POST /api/cupon — ¿este cupón le sirve a esta persona, para esta cita?
 *
 * POR QUÉ EXISTE: hasta hoy el formulario validaba el cupón con un `select`
 * desde el navegador, así que solo sabía si el código existía. Con las
 * condiciones de la migración 035 —anticipación, número de visita, cuenta,
 * servicio— eso ya no alcanza: un cupón podía verse aplicado en pantalla y
 * ser rechazado recién al enviar la reserva, con la persona ya convencida de
 * su descuento. Acá se responde lo mismo que responderá `/api/reservas`,
 * porque corre exactamente el mismo motor.
 *
 * El número de visita se cuenta en el SERVIDOR y no se acepta del cuerpo: es
 * lo que decide si el descuento aplica, y el navegador no es fuente confiable.
 *
 * Esta ruta no reserva ni consume nada. El canje se registra al crear la cita.
 */

const cuerpoSchema = z.object({
  codigo: z.string().trim().min(1).max(40),
  /** Día de la cita, si ya se eligió. Sin él, un cupón con anticipación
      mínima responde "elija primero el día" en vez de un sí falso. */
  fechaCita: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable()
    .optional()
    .default(null),
  servicio: z.string().trim().max(80).nullable().optional().default(null),
  email: z.string().trim().max(120).optional().default(""),
  telefono: z.string().trim().max(20).optional().default(""),
});

export async function POST(request: NextRequest) {
  if (!supabaseConfigurado()) {
    return NextResponse.json(
      { ok: false, mensaje: "Base de datos no configurada todavía." },
      { status: 503 }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, mensaje: "Cuerpo inválido." }, { status: 400 });
  }

  const parsed = cuerpoSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, mensaje: "Datos inválidos." }, { status: 400 });
  }
  const { codigo, fechaCita, servicio, email, telefono } = parsed.data;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const cupon = await obtenerCupon(supabase, codigo.toUpperCase());

  /* Se cuenta la visita solo si hay con qué identificar a la persona. Sin
     contacto, `contarVisitasPrevias` devuelve 0 —primera visita—, que es la
     respuesta conservadora: no se regala un descuento de cliente frecuente. */
  const visitasPrevias =
    email && telefono ? await contarVisitasPrevias(supabase, email, telefono) : 0;

  const contexto = {
    fechaCita: fechaCita ?? "",
    hoy: hoyEnSantiago(),
    numeroVisita: visitasPrevias + 1,
    tieneCuenta: Boolean(user),
    servicioSlug: servicio,
  };

  /* El "no existe" se resuelve antes para que el resto del cuerpo trabaje con
     un cupón concreto; el mensaje sale igual del dominio, no se inventa acá. */
  if (!cupon) {
    const nulo = evaluarCupon(null, contexto);
    return NextResponse.json({
      ok: false,
      motivo: nulo.ok ? "no_existe" : nulo.motivo,
      mensaje: nulo.ok ? "Ese cupón no existe." : nulo.mensaje,
    });
  }

  const veredicto = evaluarCupon(cupon, contexto);

  if (!veredicto.ok) {
    // 200, no 400: el cupón que no aplica es una respuesta válida, no un
    // error de la petición. El mensaje explica qué le falta a la persona.
    return NextResponse.json({ ok: false, motivo: veredicto.motivo, mensaje: veredicto.mensaje });
  }

  return NextResponse.json({
    ok: true,
    cupon: {
      codigo: cupon.codigo,
      pct: veredicto.descuentoPct,
      etiqueta: cupon.descripcion || `Cupón ${cupon.codigo}`,
    },
  });
}
