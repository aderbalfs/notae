-- Adiciona 'cancelled' como status possível de um evento, para o admin
-- poder cancelar ou encerrar manualmente um evento a qualquer momento (sem
-- depender do fluxo normal de apresentações). Usa um DO block para achar o
-- nome real da constraint de check em `status` (gerado automaticamente pelo
-- Postgres na migration 0001), em vez de supor o nome.
do $$
declare
  con_name text;
begin
  select conname into con_name
  from pg_constraint
  where conrelid = 'events'::regclass
    and contype = 'c'
    and pg_get_constraintdef(oid) like '%status%';
  if con_name is not null then
    execute format('alter table events drop constraint %I', con_name);
  end if;
end $$;

alter table events
  add constraint events_status_check
  check (status in ('draft', 'in_progress', 'finished', 'cancelled'));
