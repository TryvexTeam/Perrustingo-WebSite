import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
  // If Supabase is not configured yet, pass through without auth checks
  const supabaseUrl = process["env"]["NEXT_PUBLIC_SUPABASE_URL"] as string;
  if (!supabaseUrl || supabaseUrl.includes("TU_PROYECTO")) {
    return NextResponse.next({ request });
  }

  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process["env"]["NEXT_PUBLIC_SUPABASE_URL"] as string,
    process["env"]["NEXT_PUBLIC_SUPABASE_ANON_KEY"] as string,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Refresh session so it doesn't expire while the user is on the site
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Protect dashboard and admin routes
  const { pathname } = request.nextUrl;
  const isProtected =
    pathname.startsWith("/dashboard") || pathname.startsWith("/admin");

  if (isProtected && !user) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
