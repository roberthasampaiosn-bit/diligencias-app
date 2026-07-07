-- Corrige pesquisas em que o entrevistador foi gravado como E-MAIL em vez do nome
-- (aconteceu quando concluídas logada com um e-mail ainda não mapeado).
-- Como a Roberta é a única entrevistadora, todo entrevistador com "@" vira o nome dela.
--
-- Confira antes:
--   select distinct pesquisa_entrevistador from diligencias
--   where pesquisa_entrevistador like '%@%';

update diligencias
set pesquisa_entrevistador = 'Roberta Sampaio'
where pesquisa_entrevistador like '%@%';
