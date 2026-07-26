import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/* GET /api/google/connect — inicio del flujo OAuth de Google Calendar (solo admin).
   Setup de UNA sola vez: redirige al consent de Google; el callback muestra el
   refresh token para copiarlo a las envs de Vercel. Ver lib/google/calendar.ts. */

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

  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
  if (!clientId || !process.env.GOOGLE_OAUTH_CLIENT_SECRET) {
    return NextResponse.json(
      { error: "Faltan GOOGLE_OAUTH_CLIENT_ID / GOOGLE_OAUTH_CLIENT_SECRET en las envs." },
      { status: 503 }
    );
  }

  const state = crypto.randomUUID();
  const redirectUri = new URL("/api/google/callback", request.url).toString();

  const auth = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  auth.searchParams.set("client_id", clientId);
  auth.searchParams.set("redirect_uri", redirectUri);
  auth.searchParams.set("response_type", "code");
  auth.searchParams.set("scope", "https://www.googleapis.com/auth/calendar");
  auth.searchParams.set("access_type", "offline");
  // Fuerza a Google a emitir refresh_token aunque ya se haya autorizado antes.
  auth.searchParams.set("prompt", "consent");
  auth.searchParams.set("state", state);

  const res = NextResponse.redirect(auth);
  res.cookies.set("google_oauth_state", state, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    maxAge: 600,
    path: "/api/google",
  });
  return res;
}
