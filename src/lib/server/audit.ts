import "server-only";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import type { ActorType } from "@/types/database";

interface LogActionInput {
  eventId: string;
  actorType: ActorType;
  actorId?: string | null;
  action: string;
  details?: Record<string, unknown>;
}

/** Registra uma ação no audit_logs. Nunca lança — auditoria não pode derrubar o fluxo principal. */
export async function logAction(input: LogActionInput): Promise<void> {
  const supabase = createSupabaseServiceClient();
  const { error } = await supabase.from("audit_logs").insert({
    event_id: input.eventId,
    actor_type: input.actorType,
    actor_id: input.actorId ?? null,
    action: input.action,
    details: input.details ?? null,
  });
  if (error) {
    console.error("[audit] falha ao registrar ação", input.action, error);
  }
}
