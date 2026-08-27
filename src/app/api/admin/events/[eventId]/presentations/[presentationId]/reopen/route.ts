import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { requireAdminForEvent } from "@/lib/server/require-admin";
import { logAction } from "@/lib/server/audit";

/**
 * Reabre manualmente uma apresentação já encerrada, permitindo que os
 * jurados alterem a nota novamente. Ação sensível — sempre auditada.
 */
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ eventId: string; presentationId: string }> }
) {
  const { eventId, presentationId } = await params;
  if (!(await requireAdminForEvent(eventId))) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const supabase = createSupabaseServiceClient();

  const { data: presentation } = await supabase
    .from("presentations")
    .select("id, event_id, status")
    .eq("id", presentationId)
    .single();

  if (!presentation || presentation.event_id !== eventId) {
    return NextResponse.json({ error: "Apresentação não encontrada" }, { status: 404 });
  }
  if (presentation.status !== "encerrada") {
    return NextResponse.json(
      { error: "Só é possível reabrir uma apresentação encerrada" },
      { status: 409 }
    );
  }

  const { data: ongoing } = await supabase
    .from("presentations")
    .select("id")
    .eq("event_id", eventId)
    .eq("status", "em_andamento")
    .maybeSingle();

  if (ongoing) {
    return NextResponse.json(
      { error: "Encerre a apresentação em andamento antes de reabrir outra" },
      { status: 409 }
    );
  }

  const { error: updateError } = await supabase
    .from("presentations")
    .update({ status: "em_andamento", reopened_at: new Date().toISOString() })
    .eq("id", presentationId);

  if (updateError) {
    return NextResponse.json({ error: "Falha ao reabrir apresentação" }, { status: 500 });
  }

  await supabase.from("events").update({ current_presentation_id: presentationId }).eq("id", eventId);

  await logAction({
    eventId,
    actorType: "admin",
    action: "presentation.reopen",
    details: { presentationId },
  });

  return NextResponse.json({ ok: true });
}
