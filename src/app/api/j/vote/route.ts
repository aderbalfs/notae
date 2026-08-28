import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { resolveJudgeByToken } from "@/lib/server/require-judge";
import { logAction } from "@/lib/server/audit";
import { VOTE_CRITERIA, averageCriteriaScores, type CriteriaScores } from "@/lib/criteria";

const criterionScoreSchema = z
  .number()
  .min(0)
  .max(10)
  .refine((n) => Number.isInteger(Math.round(n * 10)), {
    message: "Nota deve ter no máximo uma casa decimal",
  });

const bodySchema = z.object({
  token: z.string().uuid(),
  presentationId: z.string().uuid(),
  scores: z.object({
    beleza_simpatia: criterionScoreSchema,
    postura_elegancia: criterionScoreSchema,
    traje_apresentacao: criterionScoreSchema,
    carisma_comunicacao: criterionScoreSchema,
    representatividade: criterionScoreSchema,
  } satisfies Record<(typeof VOTE_CRITERIA)[number]["key"], typeof criterionScoreSchema>),
});

/**
 * Registra (ou atualiza) as notas de um jurado para uma apresentação: uma
 * nota de 0 a 10 por critério (VOTE_CRITERIA). A nota final do jurado para
 * o participante é a média dos critérios, calculada aqui e salva em
 * `votes.score` — é o valor que a apuração (results.ts) usa para o pódio.
 * Só é aceito enquanto a apresentação está 'em_andamento' — depois que o
 * admin encerra a votação, a linha em `votes` fica travada (upsert é
 * rejeitado aqui, antes mesmo de chegar ao banco).
 */
export async function POST(request: NextRequest) {
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Requisição inválida" },
      { status: 400 }
    );
  }
  const { token, presentationId, scores } = parsed.data;

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

  const roundedScores = Object.fromEntries(
    VOTE_CRITERIA.map((c) => [c.key, Math.round(scores[c.key] * 10) / 10])
  ) as CriteriaScores;
  const finalScore = averageCriteriaScores(roundedScores);

  const criteriaColumns = Object.fromEntries(
    VOTE_CRITERIA.map((c) => [c.column, roundedScores[c.key]])
  );

  const { data: vote, error } = await supabase
    .from("votes")
    .upsert(
      {
        presentation_id: presentationId,
        judge_id: judge.id,
        score: finalScore,
        confirmed: true,
        ...criteriaColumns,
      },
      { onConflict: "presentation_id,judge_id" }
    )
    .select(
      "score, score_beleza_simpatia, score_postura_elegancia, score_traje_apresentacao, score_carisma_comunicacao, score_representatividade"
    )
    .single();

  if (error || !vote) {
    return NextResponse.json({ error: "Falha ao registrar a nota" }, { status: 500 });
  }

  await logAction({
    eventId: judge.event_id,
    actorType: "judge",
    actorId: judge.id,
    action: "vote.cast",
    details: { presentationId, score: finalScore, scores: roundedScores },
  });

  return NextResponse.json({ score: vote.score });
}
