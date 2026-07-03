"use client";

import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function LogoutButton() {
  const router = useRouter();

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  }

  return (
    <button
      onClick={handleLogout}
      className="rounded-full border border-zinc-200 bg-white px-4 py-2 text-sm font-semibold text-ink-soft transition hover:border-red-200 hover:text-red-600"
    >
      Cerrar sesión
    </button>
  );
}
