/**
 * Os 5 critérios que compõem a nota final de um jurado para um participante.
 * `column` é o nome da coluna correspondente em `votes` (ver migration
 * 0005_vote_criteria.sql). Compartilhado entre client (formulário de
 * votação) e server (validação e cálculo da nota final).
 */
export const VOTE_CRITERIA = [
  { key: "beleza_simpatia", label: "Beleza e Simpatia", column: "score_beleza_simpatia" },
  { key: "postura_elegancia", label: "Postura e Elegância", column: "score_postura_elegancia" },
  { key: "traje_apresentacao", label: "Traje e Apresentação", column: "score_traje_apresentacao" },
  { key: "carisma_comunicacao", label: "Carisma e Comunicação", column: "score_carisma_comunicacao" },
  { key: "representatividade", label: "Representatividade do Município", column: "score_representatividade" },
] as const;

export type CriterionKey = (typeof VOTE_CRITERIA)[number]["key"];

export type CriteriaScores = Record<CriterionKey, number>;

export function averageCriteriaScores(scores: CriteriaScores): number {
  const values = VOTE_CRITERIA.map((c) => scores[c.key]);
  const sum = values.reduce((total, value) => total + value, 0);
  return Math.round((sum / values.length) * 10) / 10;
}

export function defaultCriteriaScores(): CriteriaScores {
  return Object.fromEntries(VOTE_CRITERIA.map((c) => [c.key, 0])) as CriteriaScores;
}
