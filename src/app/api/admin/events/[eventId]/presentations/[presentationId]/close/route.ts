import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { requireAdminForEvent } from "@/lib/server/require-admin";
import { logAction } from "@/lib/server/audit";

/**
 * Encerra a votação de uma apresentação. A partir daqui os jurados não
 * conseguem mais alterar a nota (bloqueado no endpoint POST /api/j/vote).
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
  if (presentation.status !== "em_andamento") {
    return NextResponse.json(
      { error: "Apresentação não está em andamento" },
      { status: 409 }
    );
  }

  const { error: updateError } = await supabase
    .from("presentations")
    .update({ status: "encerrada", closed_at: new Date().toISOString() })
    .eq("id", presentationId);

  if (updateError) {
    return NextResponse.json({ error: "Falha ao encerrar apresentação" }, { status: 500 });
  }

  await logAction({
    eventId,
    actorType: "admin",
    action: "presentation.close",
    details: { presentationId },
  });

  return NextResponse.json({ ok: true });
}
