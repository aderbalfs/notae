import "server-only";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import type { CriteriaScores } from "@/lib/criteria";

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

export interface JudgeVoteDetail {
  judgeId: string;
  judgeName: string;
  score: number | null;
  scores: CriteriaScores | null;
}

export interface ParticipantVoteBreakdown {
  participantId: string;
  name: string;
  displayOrder: number;
  average: number | null;
  judgeVotes: JudgeVoteDetail[];
}

export interface EventVoteBreakdown {
  votingComplete: boolean;
  judges: { id: string; name: string }[];
  participants: ParticipantVoteBreakdown[];
}

/**
 * Detalha, para cada participante, a nota que CADA jurado deu (final + os
 * 5 critérios) — usado pela tela de apuração para o admin conferir o voto
 * individual de cada jurado depois que a votação termina, além da média.
 */
export async function getEventVoteBreakdown(eventId: string): Promise<EventVoteBreakdown | null> {
  const supabase = createSupabaseServiceClient();

  const [{ data: participants }, { data: presentations }, { data: judges }] = await Promise.all([
    supabase
      .from("participants")
      .select("id, name, display_order")
      .eq("event_id", eventId)
      .order("display_order", { ascending: true }),
    supabase.from("presentations").select("id, participant_id, status").eq("event_id", eventId),
    supabase
      .from("judges")
      .select("id, name")
      .eq("event_id", eventId)
      .order("created_at", { ascending: true }),
  ]);

  if (!participants || !presentations || !judges) return null;

  interface VoteRowSelected {
    presentation_id: string;
    judge_id: string;
    score: number;
    score_beleza_simpatia: number;
    score_postura_elegancia: number;
    score_traje_apresentacao: number;
    score_carisma_comunicacao: number;
    score_representatividade: number;
  }

  const presentationIds = presentations.map((p) => p.id);
  const { data: votes } = presentationIds.length
    ? await supabase
        .from("votes")
        .select(
          "presentation_id, judge_id, score, score_beleza_simpatia, score_postura_elegancia, score_traje_apresentacao, score_carisma_comunicacao, score_representatividade"
        )
        .in("presentation_id", presentationIds)
    : { data: [] as VoteRowSelected[] };

  const votingComplete =
    presentations.length > 0 && presentations.every((p) => p.status === "encerrada");

  const presentationByParticipant = new Map(presentations.map((p) => [p.participant_id, p]));
  const voteByPresentationAndJudge = new Map(
    (votes ?? []).map((v) => [`${v.presentation_id}:${v.judge_id}`, v])
  );

  const participantsBreakdown: ParticipantVoteBreakdown[] = participants.map((participant) => {
    const presentation = presentationByParticipant.get(participant.id);
    const judgeVotes: JudgeVoteDetail[] = judges.map((judge) => {
      const vote = presentation
        ? voteByPresentationAndJudge.get(`${presentation.id}:${judge.id}`)
        : undefined;
      return {
        judgeId: judge.id,
        judgeName: judge.name,
        score: vote?.score ?? null,
        scores: vote
          ? {
              beleza_simpatia: vote.score_beleza_simpatia,
              postura_elegancia: vote.score_postura_elegancia,
              traje_apresentacao: vote.score_traje_apresentacao,
              carisma_comunicacao: vote.score_carisma_comunicacao,
              representatividade: vote.score_representatividade,
            }
          : null,
      };
    });

    const validScores = judgeVotes
      .map((j) => j.score)
      .filter((s): s is number => s != null);
    const average = validScores.length
      ? Math.round((validScores.reduce((a, b) => a + b, 0) / validScores.length) * 10) / 10
      : null;

    return {
      participantId: participant.id,
      name: participant.name,
      displayOrder: participant.display_order,
      average,
      judgeVotes,
    };
  });

  // Mesmo critério de ordenação/desempate de getEventResults, pra bater com o pódio.
  participantsBreakdown.sort((a, b) => {
    if (a.average == null && b.average == null) return a.displayOrder - b.displayOrder;
    if (a.average == null) return 1;
    if (b.average == null) return -1;
    if (b.average !== a.average) return b.average - a.average;
    const aMax = Math.max(0, ...a.judgeVotes.map((j) => j.score ?? 0));
    const bMax = Math.max(0, ...b.judgeVotes.map((j) => j.score ?? 0));
    if (bMax !== aMax) return bMax - aMax;
    return a.displayOrder - b.displayOrder;
  });

  return {
    votingComplete,
    judges: judges.map((j) => ({ id: j.id, name: j.name })),
    participants: participantsBreakdown,
  };
}
