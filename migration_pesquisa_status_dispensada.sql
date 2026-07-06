-- Faz o banco aceitar o novo status de pesquisa "Dispensada".
-- O erro "Não foi possível dispensar" acontece porque a coluna pesquisa_status
-- é um ENUM que só conhece 'Pendente' e 'Concluída'.
--
-- PASSO 1 — descubra o tipo da coluna e já gere o comando de correção:
select
  data_type,
  udt_name,
  case
    when data_type = 'USER-DEFINED'
      then 'alter type ' || udt_name || ' add value if not exists ''Dispensada'';'
    else '(a coluna é ' || data_type || ' — me mande o resultado desta consulta)'
  end as passo_2_rode_isto
from information_schema.columns
where table_name = 'diligencias' and column_name = 'pesquisa_status';

-- PASSO 2 — se a coluna for enum (data_type = USER-DEFINED), copie o texto da
-- coluna "passo_2_rode_isto" e rode SOZINHO numa nova query. Exemplo:
--   alter type pesquisa_status add value if not exists 'Dispensada';
--
-- (Se a coluna for text/varchar, então o bloqueio é uma CHECK constraint —
--  me avise que eu passo o comando certo para ajustar.)
