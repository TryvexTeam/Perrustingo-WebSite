import { createClient } from "@supabase/supabase-js";

export function crearClienteServicio() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const clave = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !clave) return null;
  return createClient(url, clave, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
