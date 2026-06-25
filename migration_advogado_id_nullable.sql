-- Permite diligência sem advogado (diligência "casca" criada pela triagem ao
-- registrar pesquisa antes do caso ser atribuído a um advogado).
-- Sem isso, "Respondeu"/"Encerrar"/WhatsApp na fila da triagem falham com:
--   null value in column "advogado_id" of relation "diligencias" violates not-null constraint (23502)
ALTER TABLE diligencias ALTER COLUMN advogado_id DROP NOT NULL;
