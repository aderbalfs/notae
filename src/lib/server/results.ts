import "server-only";
import { createSupabaseServiceClient } from "@/lib/supabase/server";

export interface RankingEntry {
  participantId: string;
  name: string;
  displayOrder: number;
  average: number | null;
  voteCount: number;
}

export interface EventResults {
  votingComplete: boolean;
  ranking: RankingEntry[];
}

/**
 * Apura os votos de um evento: média de nota por participante (todas as
 * apresentações já encerradas) e se a votação está completa (nenhuma
 * apresentação pendente ou em andamento). `votingComplete` é o que decide
 * quando a tela de apuração deve aparecer para admin e jurados.
 */
export async function getEventResults(eventId: string): Promise<EventResults | null> {
  const supabase = createSupabaseServiceClient();

  const [{ data: participants }, { data: presentations }] = await Promise.all([
    supabase.from("participants").select("id, name, display_order").eq("event_id", eventId),
    supabase.from("presentations").select("id, participant_id, status").eq("event_id", eventId),
  ]);

  if (!participants || !presentations) return null;

  const presentationIds = presentations.map((p) => p.id);
  const { data: votes } = presentationIds.length
    ? await supabase.from("votes").select("presentation_id, score").in("presentation_id", presentationIds)
    : { data: [] as { presentation_id: string; score: number }[] };

  const votingComplete =
    presentations.length > 0 && presentations.every((p) => p.status === "encerrada");

  const presentationByParticipant = new Map(presentations.map((p) => [p.participant_id, p]));
  const votesByPresentation = new Map<string, number[]>();
  for (const v of votes ?? []) {
    const list = votesByPresentation.get(v.presentation_id) ?? [];
    list.push(v.score);
    votesByPresentation.set(v.presentation_id, list);
  }

  const rankingWithScores = participants.map((participant) => {
    const presentation = presentationByParticipant.get(participant.id);
    const scores = presentation ? (votesByPresentation.get(presentation.id) ?? []) : [];
    const average = scores.length
      ? Math.round((scores.reduce((sum, s) => sum + s, 0) / scores.length) * 10) / 10
      : null;
    return {
      participantId: participant.id,
      name: participant.name,
      displayOrder: participant.display_order,
      average,
      voteCount: scores.length,
      highestScore: scores.length ? Math.max(...scores) : null,
    };
  });

  // Desempate: maior nota individual (entre todos os jurados) mais alta vence;
  // só cai para a ordem de apresentação se nem isso decidir.
  rankingWithScores.sort((a, b) => {
    if (a.average == null && b.average == null) return a.displayOrder - b.displayOrder;
    if (a.average == null) return 1;
    if (b.average == null) return -1;
    if (b.average !== a.average) return b.average - a.average;
    if (b.highestScore !== a.highestScore) return (b.highestScore ?? 0) - (a.highestScore ?? 0);
    return a.displayOrder - b.displayOrder;
  });

  const ranking: RankingEntry[] = rankingWithScores.map((entry) => ({
    participantId: entry.participantId,
    name: entry.name,
    displayOrder: entry.displayOrder,
    average: entry.average,
    voteCount: entry.voteCount,
  }));

  return { votingComplete, ranking };
}
