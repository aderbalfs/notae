import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { requireAdminForEvent } from "@/lib/server/require-admin";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  const { eventId } = await params;
  if (!(await requireAdminForEvent(eventId))) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const supabase = createSupabaseServiceClient();

  const [{ data: event }, { data: participants }, { data: judges }, { data: presentations }] =
    await Promise.all([
      supabase.from("events").select("id, name, status, current_presentation_id").eq("id", eventId).single(),
      supabase
        .from("participants")
        .select("id, name, display_order")
        .eq("event_id", eventId)
        .order("display_order", { ascending: true }),
      supabase
        .from("judges")
        .select("id, name, access_token")
        .eq("event_id", eventId)
        .order("created_at", { ascending: true }),
      supabase
        .from("presentations")
        .select("id, participant_id, status")
        .eq("event_id", eventId),
    ]);

  if (!event) {
    return NextResponse.json({ error: "Evento não encontrado" }, { status: 404 });
  }

  return NextResponse.json({
    event,
    participants: participants ?? [],
    judges: judges ?? [],
    presentations: presentations ?? [],
  });
}

/**
 * Apaga o evento definitivamente — participantes, jurados, apresentações,
 * votos e logs somem junto (cascade no schema). Ação irreversível, por isso
 * o front exige confirmação explícita antes de chamar esta rota.
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  const { eventId } = await params;
  if (!(await requireAdminForEvent(eventId))) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const supabase = createSupabaseServiceClient();
  const { error } = await supabase.from("events").delete().eq("id", eventId);

  if (error) {
    return NextResponse.json({ error: "Falha ao apagar o evento" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
