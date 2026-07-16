import { TZ_NEGOCIO } from "@/lib/agenda";

/* Google Calendar — respaldo real de las citas confirmadas (MISIÓN 3).
   Sin SDK: llamadas REST directas autenticadas con el refresh token del negocio.

   Envs requeridas (Vercel → Settings → Environment Variables):
     GOOGLE_OAUTH_CLIENT_ID        — de la credencial OAuth (console.cloud.google.com)
     GOOGLE_OAUTH_CLIENT_SECRET    — ídem
     GOOGLE_CALENDAR_REFRESH_TOKEN — se obtiene UNA vez visitando /api/google/connect
                                     como admin (consent screen "In production" para
                                     que no expire a los 7 días)
     GOOGLE_CALENDAR_ID            — opcional, default "primary"

   Si faltan envs todo es no-op silencioso (mismo patrón que supabaseConfigurado):
   la plataforma funciona igual sin el respaldo. */

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const CAL_BASE = "https://www.googleapis.com/calendar/v3";

export function googleCalendarConfigurado(): boolean {
  return Boolean(
    process.env.GOOGLE_OAUTH_CLIENT_ID &&
      process.env.GOOGLE_OAUTH_CLIENT_SECRET &&
      process.env.GOOGLE_CALENDAR_REFRESH_TOKEN
  );
}

async function obtenerAccessToken(): Promise<string> {
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_OAUTH_CLIENT_ID!,
      client_secret: process.env.GOOGLE_OAUTH_CLIENT_SECRET!,
      refresh_token: process.env.GOOGLE_CALENDAR_REFRESH_TOKEN!,
      grant_type: "refresh_token",
    }),
  });
  if (!res.ok) throw new Error(`Google token: HTTP ${res.status}`);
  const data = (await res.json()) as { access_token?: string };
  if (!data.access_token) throw new Error("Google token: respuesta sin access_token");
  return data.access_token;
}

/** ID de evento determinístico a partir del id de la cita (uuid sin guiones —
    hex es subconjunto del base32hex que exige Google). Permite crear/actualizar/
    borrar sin guardar el id del evento en la BD. */
export function idEventoDeCita(citaId: string): string {
  return citaId.replaceAll("-", "").toLowerCase();
}

export interface EventoCita {
  citaId: string;
  titulo: string;
  descripcion: string;
  /** Instantes ISO con offset (los produce cambiarEstadoCita al confirmar). */
  inicioISO: string;
  finISO: string;
}

function cuerpoEvento(datos: EventoCita) {
  return {
    summary: datos.titulo,
    description: datos.descripcion,
    start: { dateTime: datos.inicioISO, timeZone: TZ_NEGOCIO },
    end: { dateTime: datos.finISO, timeZone: TZ_NEGOCIO },
    status: "confirmed", // revive el evento si la cita se canceló y se reconfirmó
  };
}

/** Crea o actualiza el evento espejo de una cita confirmada. */
export async function upsertEventoCita(datos: EventoCita): Promise<void> {
  if (!googleCalendarConfigurado()) return;
  const token = await obtenerAccessToken();
  const calId = encodeURIComponent(process.env.GOOGLE_CALENDAR_ID ?? "primary");
  const eventId = idEventoDeCita(datos.citaId);
  const headers = {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };

  const insert = await fetch(`${CAL_BASE}/calendars/${calId}/events`, {
    method: "POST",
    headers,
    body: JSON.stringify({ id: eventId, ...cuerpoEvento(datos) }),
  });
  if (insert.ok) return;

  // 409 = ya existe (incluso si está cancelado) → update lo actualiza/revive.
  if (insert.status === 409) {
    const update = await fetch(`${CAL_BASE}/calendars/${calId}/events/${eventId}`, {
      method: "PUT",
      headers,
      body: JSON.stringify(cuerpoEvento(datos)),
    });
    if (!update.ok) throw new Error(`Google event update: HTTP ${update.status}`);
    return;
  }
  throw new Error(`Google event insert: HTTP ${insert.status}`);
}

/** Borra el evento espejo (cita cancelada). 404/410 = ya no existe, no es error. */
export async function eliminarEventoCita(citaId: string): Promise<void> {
  if (!googleCalendarConfigurado()) return;
  const token = await obtenerAccessToken();
  const calId = encodeURIComponent(process.env.GOOGLE_CALENDAR_ID ?? "primary");
  const res = await fetch(
    `${CAL_BASE}/calendars/${calId}/events/${idEventoDeCita(citaId)}`,
    { method: "DELETE", headers: { Authorization: `Bearer ${token}` } }
  );
  if (!res.ok && res.status !== 404 && res.status !== 410) {
    throw new Error(`Google event delete: HTTP ${res.status}`);
  }
}
