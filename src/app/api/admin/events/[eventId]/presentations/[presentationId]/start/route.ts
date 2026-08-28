import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { requireAdminForEvent } from "@/lib/server/require-admin";
import { logAction } from "@/lib/server/audit";

/**
 * Coloca uma apresentação em andamento e a torna a "atual" do evento.
 * Só permitido a partir de 'aguardando' e com nenhuma outra apresentação
 * em andamento no mesmo evento (o admin precisa encerrar a atual antes).
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
  if (presentation.status !== "aguardando") {
    return NextResponse.json(
      { error: "Apresentação não está aguardando" },
      { status: 409 }
    );
  }

  const { data: eventBefore } = await supabase.from("events").select("status").eq("id", eventId).single();
  if (eventBefore?.status === "cancelled" || eventBefore?.status === "finished") {
    return NextResponse.json(
      { error: "Este evento está cancelado ou encerrado" },
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
      { error: "Encerre a apresentação em andamento antes de iniciar outra" },
      { status: 409 }
    );
  }

  const { error: updateError } = await supabase
    .from("presentations")
    .update({ status: "em_andamento", started_at: new Date().toISOString() })
    .eq("id", presentationId);

  if (updateError) {
    return NextResponse.json({ error: "Falha ao iniciar apresentação" }, { status: 500 });
  }

  await supabase
    .from("events")
    .update({
      current_presentation_id: presentationId,
      status: eventBefore?.status === "draft" ? "in_progress" : eventBefore?.status,
    })
    .eq("id", eventId);

  await logAction({
    eventId,
    actorType: "admin",
    action: "presentation.start",
    details: { presentationId },
  });

  return NextResponse.json({ ok: true });
}
