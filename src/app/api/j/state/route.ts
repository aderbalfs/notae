import { NextRequest, NextResponse } from "next/server";
import { getJudgeState } from "@/lib/server/judge-state";

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token") ?? "";
  const state = await getJudgeState(token);

  if (!state) {
    return NextResponse.json({ error: "Token inválido" }, { status: 401 });
  }

  return NextResponse.json(state);
}
