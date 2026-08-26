import "server-only";
import { cookies } from "next/headers";
import { ADMIN_SESSION_COOKIE, verifyAdminSessionToken } from "@/lib/server/admin-session";

/**
 * Retorna o eventId autorizado pela sessão do admin, ou null se não houver
 * sessão válida. Toda API route de administração deve chamar isto e
 * comparar o eventId do payload com o retornado aqui antes de agir.
 */
export async function requireAdminEventId(): Promise<string | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(ADMIN_SESSION_COOKIE)?.value;
  return verifyAdminSessionToken(token);
}
