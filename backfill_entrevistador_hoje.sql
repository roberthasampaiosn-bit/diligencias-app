-- Preenche o entrevistador nas pesquisas concluídas HOJE que ficaram sem nome
-- (feitas antes do app passar a gravar o entrevistador automaticamente).
-- Escopo seguro: só BAT, só concluídas de hoje e só onde o campo está vazio.
-- Ajuste o nome se quem concluiu não foi a Roberta.
--
-- Confira antes o que será afetado:
--   select ccc, vitima, pesquisa_data_conclusao, pesquisa_entrevistador
--   from diligencias
--   where empresa_cliente <> 'V.TAL'
--     and pesquisa_status = 'Concluída'
--     and coalesce(pesquisa_entrevistador, '') = ''
--     and pesquisa_data_conclusao like to_char(current_date, 'YYYY-MM-DD') || '%';

update diligencias
set pesquisa_entrevistador = 'Roberta Sampaio'
where empresa_cliente <> 'V.TAL'
  and pesquisa_status = 'Concluída'
  and coalesce(pesquisa_entrevistador, '') = ''
  and pesquisa_data_conclusao like to_char(current_date, 'YYYY-MM-DD') || '%';
