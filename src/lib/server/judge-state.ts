import "server-only";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { resolveJudgeByToken } from "@/lib/server/require-judge";
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
}

export interface JudgeState {
  judgeId: string;
  judgeName: string;
  eventId: string;
  eventStatus: string;
  current: JudgeCurrentPresentation | null;
  history: JudgeHistoryItem[];
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
      supabase.from("votes").select("presentation_id, score").eq("judge_id", judge.id),
    ]);

  if (!event || !participants || !presentations) return null;

  const participantById = new Map(participants.map((p) => [p.id, p]));
  const scoreByPresentation = new Map((votes ?? []).map((v) => [v.presentation_id, v.score]));

  const enriched = presentations
    .map((pres) => {
      const participant = participantById.get(pres.participant_id);
      if (!participant) return null;
      return {
        presentationId: pres.id,
        participantName: participant.name,
        displayOrder: participant.display_order,
        status: pres.status,
        score: scoreByPresentation.get(pres.id) ?? null,
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
        }
      : null,
    history,
  };
}
