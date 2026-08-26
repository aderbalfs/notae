import "server-only";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

/**
 * Client com service role — só pode ser importado em código de servidor
 * (API routes / server actions). Ignora RLS: é aqui que TODAS as regras
 * de negócio (validação de voto, avanço de participante, etc.) são
 * aplicadas antes de qualquer escrita.
 */
export function createSupabaseServiceClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}
