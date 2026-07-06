-- Atribui a Roberta Sampaio como entrevistadora em TODAS as pesquisas já
-- concluídas que ficaram sem entrevistador (o app antigo não gravava esse campo).
-- Como hoje a Roberta é quem faz todas as entrevistas, o backfill cobre o histórico.
--
-- Exclui o lote de maio/2026 que foi "Encerrado administrativamente" (perda de
-- dados) — aquelas não foram entrevistas, então não recebem entrevistador.
--
-- Confira antes o que será afetado:
--   select ccc, vitima, pesquisa_data_conclusao, pesquisa_observacoes
--   from diligencias
--   where empresa_cliente <> 'V.TAL'
--     and pesquisa_status = 'Concluída'
--     and coalesce(pesquisa_entrevistador, '') = ''
--     and coalesce(pesquisa_observacoes, '') not ilike '%administrativ%';

update diligencias
set pesquisa_entrevistador = 'Roberta Sampaio'
where empresa_cliente <> 'V.TAL'
  and pesquisa_status = 'Concluída'
  and coalesce(pesquisa_entrevistador, '') = ''
  and coalesce(pesquisa_observacoes, '') not ilike '%administrativ%';
