import "server-only";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import type { CriteriaScores } from "@/lib/criteria";

export interface LiveJudgeVote {
  judgeId: string;
  judgeName: string;
  voted: boolean;
  scores: CriteriaScores | null;
  finalScore: number | null;
}

export interface LiveVotingState {
  currentPresentation: { presentationId: string; participantName: string } | null;
  judges: LiveJudgeVote[];
  partialAverage: number | null;
}

/**
 * Estado da apresentação em andamento para o painel de acompanhamento ao
 * vivo do admin: as notas de critério de cada jurado (só quem já votou) e a
 * média parcial entre eles. Só é consumido por rotas com requireAdminForEvent
 * — nunca exposto via anon key, diferente de vote_receipts.
 */
export async function getLiveVotingState(eventId: string): Promise<LiveVotingState | null> {
  const supabase = createSupabaseServiceClient();

  const [{ data: event }, { data: participants }, { data: presentations }, { data: judges }] =
    await Promise.all([
      supabase.from("events").select("current_presentation_id").eq("id", eventId).single(),
      supabase.from("participants").select("id, name").eq("event_id", eventId),
      supabase.from("presentations").select("id, participant_id, status").eq("event_id", eventId),
      supabase
        .from("judges")
        .select("id, name")
        .eq("event_id", eventId)
        .order("created_at", { ascending: true }),
    ]);

  if (!event || !participants || !presentations || !judges) return null;

  const currentPresentationRow = presentations.find(
    (p) => p.id === event.current_presentation_id && p.status === "em_andamento"
  );

  if (!currentPresentationRow) {
    return { currentPresentation: null, judges: [], partialAverage: null };
  }

  const participant = participants.find((p) => p.id === currentPresentationRow.participant_id);

  const { data: votes } = await supabase
    .from("votes")
    .select(
      "judge_id, score, score_beleza_simpatia, score_postura_elegancia, score_traje_apresentacao, score_carisma_comunicacao, score_representatividade"
    )
    .eq("presentation_id", currentPresentationRow.id);

  const voteByJudge = new Map((votes ?? []).map((v) => [v.judge_id, v]));

  const liveJudges: LiveJudgeVote[] = judges.map((judge) => {
    const vote = voteByJudge.get(judge.id);
    if (!vote) {
      return { judgeId: judge.id, judgeName: judge.name, voted: false, scores: null, finalScore: null };
    }
    const scores: CriteriaScores = {
      beleza_simpatia: vote.score_beleza_simpatia,
      postura_elegancia: vote.score_postura_elegancia,
      traje_apresentacao: vote.score_traje_apresentacao,
      carisma_comunicacao: vote.score_carisma_comunicacao,
      representatividade: vote.score_representatividade,
    };
    return { judgeId: judge.id, judgeName: judge.name, voted: true, scores, finalScore: vote.score };
  });

  const votedScores = liveJudges
    .filter((j): j is LiveJudgeVote & { finalScore: number } => j.finalScore != null)
    .map((j) => j.finalScore);
  const partialAverage = votedScores.length
    ? Math.round((votedScores.reduce((a, b) => a + b, 0) / votedScores.length) * 10) / 10
    : null;

  return {
    currentPresentation: participant
      ? { presentationId: currentPresentationRow.id, participantName: participant.name }
      : null,
    judges: liveJudges,
    partialAverage,
  };
}
