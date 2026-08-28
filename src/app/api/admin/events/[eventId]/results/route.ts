import { NextRequest, NextResponse } from "next/server";
import { requireAdminForEvent } from "@/lib/server/require-admin";
import { getEventResults } from "@/lib/server/results";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  const { eventId } = await params;
  if (!(await requireAdminForEvent(eventId))) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const results = await getEventResults(eventId);
  if (!results) {
    return NextResponse.json({ error: "Evento não encontrado" }, { status: 404 });
  }

  return NextResponse.json(results);
}
