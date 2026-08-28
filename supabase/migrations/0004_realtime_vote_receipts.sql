-- Habilita Realtime em vote_receipts: o painel do admin escuta essa tabela
-- para mostrar, ao vivo, quais jurados já votaram na apresentação em
-- andamento — sem nunca expor a nota (a tabela `votes` continua fora do
-- Realtime e sem policy de select para anon).
alter publication supabase_realtime add table vote_receipts;
