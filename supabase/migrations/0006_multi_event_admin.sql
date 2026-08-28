-- Um admin passa a poder ser dono de vários eventos (ex.: para testar
-- cenários antes da apresentação real), então a credencial deixa de estar
-- presa a um único evento.
alter table events drop constraint events_admin_user_unique;

create index idx_events_admin_user on events(admin_user_id);
