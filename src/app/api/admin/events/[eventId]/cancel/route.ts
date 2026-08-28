import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { requireAdminForEvent } from "@/lib/server/require-admin";
import { logAction } from "@/lib/server/audit";

/**
 * Cancela um evento manualmente — para quando o admin decide abandonar um
 * teste ou um evento real que não vai mais acontecer. Diferente de
 * "encerrar": cancelado não teve resultado válido.
 */
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  const { eventId } = await params;
  if (!(await requireAdminForEvent(eventId))) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const supabase = createSupabaseServiceClient();
  const { data: event } = await supabase.from("events").select("status").eq("id", eventId).single();

  if (!event) {
    return NextResponse.json({ error: "Evento não encontrado" }, { status: 404 });
  }
  if (event.status === "cancelled") {
    return NextResponse.json({ error: "Evento já está cancelado" }, { status: 409 });
  }

  const { error } = await supabase.from("events").update({ status: "cancelled" }).eq("id", eventId);
  if (error) {
    return NextResponse.json({ error: "Falha ao cancelar o evento" }, { status: 500 });
  }

  await logAction({ eventId, actorType: "admin", action: "event.cancelled" });

  return NextResponse.json({ ok: true });
}
