-- Notae — schema inicial (Fase 1: Fundação)
-- Convenções:
--   * Todas as escritas de negócio (votos, avanço de participante, etc.)
--     passam pelas API routes do Next.js usando a service role key.
--     O client nunca escreve diretamente no banco.
--   * O client (jurado/admin) só faz SELECT via Realtime/anon key, e apenas
--     em colunas que não vazam informação sensível (ex: notas de outros jurados).

create extension if not exists "pgcrypto";

-- =========================================================
-- EVENTS
-- =========================================================
create table events (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  status text not null default 'draft'
    check (status in ('draft', 'in_progress', 'finished')),
  admin_pin_hash text not null,
  current_presentation_id uuid, -- FK adicionada após presentations existir
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- =========================================================
-- PARTICIPANTS
-- =========================================================
create table participants (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events(id) on delete cascade,
  name text not null,
  display_order int not null,
  created_at timestamptz not null default now(),
  unique (event_id, display_order)
);

-- =========================================================
-- JUDGES
-- =========================================================
create table judges (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events(id) on delete cascade,
  name text not null,
  access_token uuid not null default gen_random_uuid(),
  created_at timestamptz not null default now(),
  unique (access_token)
);

-- =========================================================
-- PRESENTATIONS
-- Uma apresentação = a passagem de 1 participante pelo palco em 1 evento.
-- =========================================================
create table presentations (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events(id) on delete cascade,
  participant_id uuid not null references participants(id) on delete cascade,
  status text not null default 'aguardando'
    check (status in ('aguardando', 'em_andamento', 'encerrada')),
  started_at timestamptz,
  closed_at timestamptz,
  reopened_at timestamptz,
  created_at timestamptz not null default now(),
  unique (event_id, participant_id)
);

alter table events
  add constraint events_current_presentation_fk
  foreign key (current_presentation_id) references presentations(id);

-- =========================================================
-- VOTES
-- Nota de 0.0 a 10.0, uma casa decimal.
-- Um jurado só pode ter 1 linha de voto por apresentação (upsert).
-- =========================================================
create table votes (
  id uuid primary key default gen_random_uuid(),
  presentation_id uuid not null references presentations(id) on delete cascade,
  judge_id uuid not null references judges(id) on delete cascade,
  score numeric(3,1) not null check (score >= 0 and score <= 10),
  confirmed boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (presentation_id, judge_id)
);

-- View pública (sem nota) usada pelo Realtime para o painel do admin
-- e para o jurado saber que "já votou", sem expor a pontuação de ninguém.
create table vote_receipts (
  presentation_id uuid not null references presentations(id) on delete cascade,
  judge_id uuid not null references judges(id) on delete cascade,
  voted_at timestamptz not null default now(),
  primary key (presentation_id, judge_id)
);

-- Mantém vote_receipts sincronizado a cada insert/update em votes.
create or replace function sync_vote_receipt()
returns trigger
language plpgsql
as $$
begin
  insert into vote_receipts (presentation_id, judge_id, voted_at)
  values (new.presentation_id, new.judge_id, now())
  on conflict (presentation_id, judge_id)
  do update set voted_at = now();
  return new;
end;
$$;

create trigger votes_sync_receipt
after insert or update on votes
for each row execute function sync_vote_receipt();

-- =========================================================
-- AUDIT LOG
-- =========================================================
create table audit_logs (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events(id) on delete cascade,
  actor_type text not null check (actor_type in ('admin', 'judge', 'system')),
  actor_id uuid,
  action text not null,
  details jsonb,
  created_at timestamptz not null default now()
);

-- =========================================================
-- Índices de apoio
-- =========================================================
create index idx_participants_event on participants(event_id);
create index idx_judges_event on judges(event_id);
create index idx_presentations_event on presentations(event_id);
create index idx_votes_presentation on votes(presentation_id);
create index idx_votes_judge on votes(judge_id);
create index idx_audit_logs_event on audit_logs(event_id);

-- =========================================================
-- Row Level Security
-- Todas as tabelas exigem service role para escrita (feita via API routes).
-- Leitura via anon key (Realtime) é liberada apenas em vote_receipts e
-- presentations/participants/events, que não carregam notas.
-- A tabela `votes` NUNCA é exposta a anon/authenticated — só service role.
-- =========================================================
alter table events enable row level security;
alter table participants enable row level security;
alter table judges enable row level security;
alter table presentations enable row level security;
alter table votes enable row level security;
alter table vote_receipts enable row level security;
alter table audit_logs enable row level security;

-- Leitura pública controlada (necessária para Realtime no client):
create policy events_select_anon on events for select using (true);
create policy participants_select_anon on participants for select using (true);
create policy presentations_select_anon on presentations for select using (true);
create policy vote_receipts_select_anon on vote_receipts for select using (true);

-- judges: nunca expõe access_token para leitura anônima em massa.
-- (o próprio jurado recebe seu token fora do banco, via link gerado pelo admin)
-- Nenhuma policy de select pública é criada para `judges`, `votes` ou `audit_logs`:
-- somente a service role (que ignora RLS) acessa essas tabelas.
