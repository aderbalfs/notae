-- Habilita eventos de Realtime (postgres_changes) para as tabelas que o
-- client (jurado/admin) escuta: events (current_presentation_id) e
-- presentations (status). Sem isso, o Postgres nunca notifica o Supabase
-- Realtime das mudanças, mesmo com RLS de select liberado e o canal
-- inscrito com sucesso.
alter publication supabase_realtime add table events, presentations;
