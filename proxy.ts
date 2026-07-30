import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

/* Renombrado de `middleware.ts` (30-jul): en Next 16 la convención pasó a
   llamarse `proxy`, y la anterior está deprecada — el aviso salía en cada
   arranque. Mismo comportamiento: refrescar la sesión de Supabase antes de
   cada petición. El helper conserva su nombre de archivo porque es nuestro,
   no de la convención. */
export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
