-- Corrige de forma definitiva o erro ao dispensar pesquisa ("Dispensada").
-- A coluna pesquisa_status era um ENUM antigo (status_pesquisa_enum) com valores
-- legados, que recusava valores novos. Convertendo para TEXT, ela passa a aceitar
-- qualquer status ('Pendente', 'Concluída', 'Dispensada'), sem depender do enum.
-- Os valores já existentes são preservados como texto.
--
-- Rode tudo de uma vez:

alter table diligencias alter column pesquisa_status drop default;
alter table diligencias alter column pesquisa_status type text using pesquisa_status::text;
alter table diligencias alter column pesquisa_status set default 'Pendente';

-- Recarrega o cache da API do Supabase para enxergar a mudança de tipo:
notify pgrst, 'reload schema';
