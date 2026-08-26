import "server-only";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import type { JudgeRow } from "@/types/database";

/**
 * Resolve um jurado a partir do token de acesso presente no link único
 * enviado pelo admin. O token é o único fator de identificação do jurado —
 * por isso ele nunca deve ser logado, exibido em URLs de terceiros ou
 * incluído em analytics.
 */
export async function resolveJudgeByToken(token: string): Promise<JudgeRow | null> {
  if (!token) return null;
  const supabase = createSupabaseServiceClient();
  const { data, error } = await supabase
    .from("judges")
    .select("*")
    .eq("access_token", token)
    .single();

  if (error || !data) return null;
  return data;
}
