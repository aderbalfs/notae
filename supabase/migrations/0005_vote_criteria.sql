-- Cada jurado passa a avaliar 5 critérios (0 a 10, uma casa decimal) por
-- apresentação, em vez de uma nota única. `score` continua existindo e
-- representa a nota final do jurado para aquele participante — a média dos
-- 5 critérios, calculada pela API route (/api/j/vote) antes do insert,
-- seguindo a convenção do projeto de manter regras de negócio fora do banco.
-- Isso preserva toda a lógica de apuração/pódio (results.ts), que já lê
-- `votes.score` sem precisar saber que ele agora é derivado.
alter table votes
  add column score_beleza_simpatia numeric(3,1) not null check (score_beleza_simpatia >= 0 and score_beleza_simpatia <= 10),
  add column score_postura_elegancia numeric(3,1) not null check (score_postura_elegancia >= 0 and score_postura_elegancia <= 10),
  add column score_traje_apresentacao numeric(3,1) not null check (score_traje_apresentacao >= 0 and score_traje_apresentacao <= 10),
  add column score_carisma_comunicacao numeric(3,1) not null check (score_carisma_comunicacao >= 0 and score_carisma_comunicacao <= 10),
  add column score_representatividade numeric(3,1) not null check (score_representatividade >= 0 and score_representatividade <= 10);
