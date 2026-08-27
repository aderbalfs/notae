import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { resolveJudgeByToken } from "@/lib/server/require-judge";
import { logAction } from "@/lib/server/audit";

const bodySchema = z.object({
  token: z.string().uuid(),
  presentationId: z.string().uuid(),
  score: z
    .number()
    .min(0)
    .max(10)
    .refine((n) => Number.isInteger(Math.round(n * 10)), {
      message: "Nota deve ter no máximo uma casa decimal",
    }),
});

/**
 * Registra (ou atualiza) a nota de um jurado para uma apresentação. Só é
 * aceito enquanto a apresentação está 'em_andamento' — depois que o admin
 * encerra a votação, a linha em `votes` fica travada (upsert é rejeitado
 * aqui, antes mesmo de chegar ao banco).
 */
export async function POST(request: NextRequest) {
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Requisição inválida" },
      { status: 400 }
    );
  }
  const { token, presentationId, score } = parsed.data;

  const judge = await resolveJudgeByToken(token);
  if (!judge) {
    return NextResponse.json({ error: "Token inválido" }, { status: 401 });
  }

  const supabase = createSupabaseServiceClient();
  const { data: presentation } = await supabase
    .from("presentations")
    .select("id, event_id, status")
    .eq("id", presentationId)
    .single();

  if (!presentation || presentation.event_id !== judge.event_id) {
    return NextResponse.json({ error: "Apresentação não encontrada" }, { status: 404 });
  }

  if (presentation.status !== "em_andamento") {
    return NextResponse.json(
      { error: "A votação para este participante não está aberta" },
      { status: 409 }
    );
  }

  const roundedScore = Math.round(score * 10) / 10;

  const { data: vote, error } = await supabase
    .from("votes")
    .upsert(
      { presentation_id: presentationId, judge_id: judge.id, score: roundedScore, confirmed: true },
      { onConflict: "presentation_id,judge_id" }
    )
    .select("score")
    .single();

  if (error || !vote) {
    return NextResponse.json({ error: "Falha ao registrar a nota" }, { status: 500 });
  }

  await logAction({
    eventId: judge.event_id,
    actorType: "judge",
    actorId: judge.id,
    action: "vote.cast",
    details: { presentationId, score: roundedScore },
  });

  return NextResponse.json({ score: vote.score });
}
