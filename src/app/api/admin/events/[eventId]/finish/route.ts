import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { requireAdminForEvent } from "@/lib/server/require-admin";
import { logAction } from "@/lib/server/audit";

/**
 * Encerra um evento manualmente, independente do estado das apresentações
 * — para quando o admin quer fechar o evento mesmo sem ter passado todo
 * mundo pelo palco (ex.: imprevisto no dia). Não mexe nas apresentações em
 * si, só marca o evento como finalizado.
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
  if (event.status === "finished" || event.status === "cancelled") {
    return NextResponse.json(
      { error: "Evento já está encerrado ou cancelado" },
      { status: 409 }
    );
  }

  const { error } = await supabase.from("events").update({ status: "finished" }).eq("id", eventId);
  if (error) {
    return NextResponse.json({ error: "Falha ao encerrar o evento" }, { status: 500 });
  }

  await logAction({ eventId, actorType: "admin", action: "event.finished_manually" });

  return NextResponse.json({ ok: true });
}
