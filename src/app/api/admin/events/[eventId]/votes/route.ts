import { NextRequest, NextResponse } from "next/server";
import { requireAdminForEvent } from "@/lib/server/require-admin";
import { getEventVoteBreakdown } from "@/lib/server/results";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  const { eventId } = await params;
  if (!(await requireAdminForEvent(eventId))) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const breakdown = await getEventVoteBreakdown(eventId);
  if (!breakdown) {
    return NextResponse.json({ error: "Evento não encontrado" }, { status: 404 });
  }

  return NextResponse.json(breakdown);
}
