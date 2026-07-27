import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/* GET /api/google/callback — cierre del flujo OAuth (solo admin).
   Intercambia el code por tokens y muestra el refresh token UNA vez para
   copiarlo a Vercel (GOOGLE_CALENDAR_REFRESH_TOKEN). No se persiste en
   ningún lado: la env es la única fuente. Destino fijo — sin parámetro
   `next` ni redirecciones derivadas del request (evita open redirect). */

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(new URL("/login", request.url));

  const { data: perfil } = await supabase
    .from("perfiles")
    .select("rol")
    .eq("id", user.id)
    .single();
  if (perfil?.rol !== "admin") {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const stateCookie = request.cookies.get("google_oauth_state")?.value;

  if (!code || !state || !stateCookie || state !== stateCookie) {
    return NextResponse.json(
      { error: "Estado OAuth inválido o expirado — reinicia en /api/google/connect." },
      { status: 400 }
    );
  }

  const redirectUri = new URL("/api/google/callback", request.url).toString();
  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_OAUTH_CLIENT_ID ?? "",
      client_secret: process.env.GOOGLE_OAUTH_CLIENT_SECRET ?? "",
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });

  if (!tokenRes.ok) {
    return NextResponse.json(
      { error: `Google rechazó el intercambio (HTTP ${tokenRes.status}). Revisa client id/secret y redirect URI.` },
      { status: 502 }
    );
  }

  const tokens = (await tokenRes.json()) as { refresh_token?: string };
  if (!tokens.refresh_token) {
    return NextResponse.json(
      { error: "Google no devolvió refresh_token. Reintenta desde /api/google/connect (fuerza prompt=consent)." },
      { status: 502 }
    );
  }

  const html = `<!doctype html><html lang="es"><head><meta charset="utf-8">
<title>Google Calendar conectado — Perrustingo</title>
<style>body{font-family:system-ui;max-width:640px;margin:48px auto;padding:0 20px;color:#1c2b2d}
code{display:block;background:#f0f4f4;border-radius:8px;padding:14px;word-break:break-all;margin:12px 0;user-select:all}
ol{line-height:1.7}</style></head><body>
<h1>✅ Autorización completada</h1>
<p>Copia este <strong>refresh token</strong> — se muestra solo esta vez y no queda guardado en la plataforma:</p>
<code>${tokens.refresh_token.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`)}</code>
<ol>
<li>Vercel → proyecto → <strong>Settings → Environment Variables</strong>.</li>
<li>Crear <strong>GOOGLE_CALENDAR_REFRESH_TOKEN</strong> con ese valor (Production).</li>
<li>Redeploy. Desde ahí, cada cita confirmada se espeja en el Google Calendar del negocio.</li>
</ol>
<p>Cierra esta pestaña cuando termines.</p></body></html>`;

  const res = new NextResponse(html, {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
  res.cookies.delete("google_oauth_state");
  return res;
}
