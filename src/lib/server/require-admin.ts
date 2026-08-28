import "server-only";
import { cookies } from "next/headers";
import { ADMIN_SESSION_COOKIE, verifyAdminSessionToken } from "@/lib/server/admin-session";
import { createSupabaseServiceClient } from "@/lib/supabase/server";

/**
 * Retorna o id do admin (Supabase Auth user) autenticado pela sessão, ou
 * null se não houver sessão válida. Um mesmo admin pode ser dono de vários
 * eventos — a autorização por evento é feita à parte em requireAdminForEvent.
 */
export async function requireAdminUserId(): Promise<string | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(ADMIN_SESSION_COOKIE)?.value;
  return verifyAdminSessionToken(token);
}

/** Garante que a sessão do admin autoriza especificamente este eventId. */
export async function requireAdminForEvent(eventId: string): Promise<boolean> {
  const adminUserId = await requireAdminUserId();
  if (!adminUserId) return false;

  const supabase = createSupabaseServiceClient();
  const { data: event } = await supabase
    .from("events")
    .select("id")
    .eq("id", eventId)
    .eq("admin_user_id", adminUserId)
    .maybeSingle();

  return event !== null;
}
