import "server-only";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { resolveJudgeByToken } from "@/lib/server/require-judge";
import { getEventResults, type RankingEntry } from "@/lib/server/results";
import type { CriteriaScores } from "@/lib/criteria";
import type { PresentationStatus } from "@/types/database";

export interface JudgeHistoryItem {
  presentationId: string;
  participantName: string;
  displayOrder: number;
  score: number | null;
}

export interface JudgeCurrentPresentation {
  presentationId: string;
  participantName: string;
  status: PresentationStatus;
  myScore: number | null;
  myScores: CriteriaScores | null;
}

export interface JudgeState {
  judgeId: string;
  judgeName: string;
  eventId: string;
  eventStatus: string;
  current: JudgeCurrentPresentation | null;
  history: JudgeHistoryItem[];
  votingComplete: boolean;
  ranking: RankingEntry[];
}

/**
 * Monta o estado que a tela do jurado precisa: participante atual (se houver),
 * a nota que este jurado já deu a ele (se houver) e o histórico de notas já
 * travadas (apresentações encerradas). Nunca inclui notas de outros jurados.
 */
export async function getJudgeState(token: string): Promise<JudgeState | null> {
  const judge = await resolveJudgeByToken(token);
  if (!judge) return null;

  const supabase = createSupabaseServiceClient();

  const [{ data: event }, { data: participants }, { data: presentations }, { data: votes }] =
    await Promise.all([
      supabase
        .from("events")
        .select("id, status, current_presentation_id")
        .eq("id", judge.event_id)
        .single(),
      supabase
        .from("participants")
        .select("id, name, display_order")
        .eq("event_id", judge.event_id),
      supabase
        .from("presentations")
        .select("id, participant_id, status")
        .eq("event_id", judge.event_id),
      supabase
        .from("votes")
        .select(
          "presentation_id, score, score_beleza_simpatia, score_postura_elegancia, score_traje_apresentacao, score_carisma_comunicacao, score_representatividade"
        )
        .eq("judge_id", judge.id),
    ]);

  if (!event || !participants || !presentations) return null;

  const results = await getEventResults(judge.event_id);

  const participantById = new Map(participants.map((p) => [p.id, p]));
  const voteByPresentation = new Map((votes ?? []).map((v) => [v.presentation_id, v]));

  const enriched = presentations
    .map((pres) => {
      const participant = participantById.get(pres.participant_id);
      if (!participant) return null;
      const vote = voteByPresentation.get(pres.id);
      const scores: CriteriaScores | null = vote
        ? {
            beleza_simpatia: vote.score_beleza_simpatia,
            postura_elegancia: vote.score_postura_elegancia,
            traje_apresentacao: vote.score_traje_apresentacao,
            carisma_comunicacao: vote.score_carisma_comunicacao,
            representatividade: vote.score_representatividade,
          }
        : null;
      return {
        presentationId: pres.id,
        participantName: participant.name,
        displayOrder: participant.display_order,
        status: pres.status,
        score: vote?.score ?? null,
        scores,
      };
    })
    .filter((item): item is NonNullable<typeof item> => item !== null)
    .sort((a, b) => a.displayOrder - b.displayOrder);

  const current = event.current_presentation_id
    ? (enriched.find((item) => item.presentationId === event.current_presentation_id) ?? null)
    : null;

  const history: JudgeHistoryItem[] = enriched
    .filter((item) => item.status === "encerrada" && item.presentationId !== current?.presentationId)
    .map((item) => ({
      presentationId: item.presentationId,
      participantName: item.participantName,
      displayOrder: item.displayOrder,
      score: item.score,
    }));

  return {
    judgeId: judge.id,
    judgeName: judge.name,
    eventId: judge.event_id,
    eventStatus: event.status,
    current: current
      ? {
          presentationId: current.presentationId,
          participantName: current.participantName,
          status: current.status,
          myScore: current.score,
          myScores: current.scores,
        }
      : null,
    history,
    votingComplete: results?.votingComplete ?? false,
    ranking: results?.ranking ?? [],
  };
}
