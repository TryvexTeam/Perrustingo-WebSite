import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { supabaseConfigurado } from "@/lib/citas";

/* GET /api/respaldo — descarga todo el negocio en un archivo (PRP-004 F5).

   Motivo: el plan gratuito de Supabase **no incluye respaldos**. Verificado
   en el panel el 26-jul: "Free Plan does not include project backups". Si
   alguien borra los datos —por ataque o por accidente— hoy no hay de dónde
   recuperarlos.

   Esto no reemplaza un respaldo administrado, pero convierte "no tenemos
   nada" en "tenemos lo que descargamos". Solo admin.

   Formato: JSON plano por tabla. Se eligió sobre SQL a propósito — un JSON
   lo abre cualquiera (incluso Excel) para leer una cita perdida, sin
   necesitar restaurar una base entera. */

export const dynamic = "force-dynamic";

/* Tablas del negocio, en orden de dependencia por si se restauran a mano.
   `rate_limit` NO va: son contadores efímeros, no información del negocio. */
const TABLAS = [
  "perfiles",
  "perros",
  "sesiones",
  "conducta",
  "fotos_sesion",
  "tarifas",
  "tarifas_extras",
  "ajustes_precio",
  "ajustes_precio_tamano",
  "cupones",
  "promos",
  "ofertas",
  "disponibilidad_config",
  "disponibilidad_tramos",
] as const;

export async function GET() {
  if (!supabaseConfigurado()) {
    return NextResponse.json({ error: "Base de datos no configurada." }, { status: 503 });
  }

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sesión expirada." }, { status: 401 });

  const { data: perfil } = await supabase
    .from("perfiles")
    .select("rol")
    .eq("id", user.id)
    .single();
  if (perfil?.rol !== "admin") {
    return NextResponse.json({ error: "Sin permisos." }, { status: 403 });
  }

  const respaldo: Record<string, unknown> = {
    generado: new Date().toISOString(),
    proyecto: "perrustingo",
  };
  const problemas: string[] = [];

  for (const tabla of TABLAS) {
    const { data, error } = await supabase.from(tabla).select("*");
    if (error) {
      // Se anota y se sigue: un respaldo parcial sirve más que ninguno,
      // pero tiene que decir qué le falta. Un respaldo que miente sobre su
      // contenido es peor que no tenerlo.
      problemas.push(`${tabla}: ${error.message}`);
      respaldo[tabla] = null;
    } else {
      respaldo[tabla] = data ?? [];
    }
  }

  if (problemas.length > 0) respaldo.problemas = problemas;

  // Conteos arriba del archivo: permiten ver de un vistazo si el respaldo
  // trae lo que debería, sin abrir 14 listas.
  respaldo.resumen = Object.fromEntries(
    TABLAS.map((t) => [t, Array.isArray(respaldo[t]) ? (respaldo[t] as unknown[]).length : "ERROR"])
  );

  const fecha = new Date().toISOString().slice(0, 10);
  return new NextResponse(JSON.stringify(respaldo, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="perrustingo-respaldo-${fecha}.json"`,
      // Un respaldo no se cachea: siempre se quiere el estado de ahora.
      "Cache-Control": "no-store",
    },
  });
}
