-- Substitui o PIN do evento por uma credencial única (e-mail + senha) via
-- Supabase Auth. A conta é criada exclusivamente pela rota de criação do
-- evento (service role, auth.admin.createUser) — não existe cadastro
-- público, então ninguém além do admin do desfile pode criar conta.
alter table events drop column admin_pin_hash;

alter table events
  add column admin_user_id uuid not null references auth.users(id) on delete cascade;

alter table events
  add constraint events_admin_user_unique unique (admin_user_id);
