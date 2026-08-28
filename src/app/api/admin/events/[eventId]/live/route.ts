import { NextRequest, NextResponse } from "next/server";
import { requireAdminForEvent } from "@/lib/server/require-admin";
import { getLiveVotingState } from "@/lib/server/live-voting";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  const { eventId } = await params;
  if (!(await requireAdminForEvent(eventId))) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const state = await getLiveVotingState(eventId);
  if (!state) {
    return NextResponse.json({ error: "Evento não encontrado" }, { status: 404 });
  }

  return NextResponse.json(state);
}
