-- Migration: dispensar documentos ESPECÍFICOS por diligência.
-- Diferente de `dispensar_documentos` (que dispensa TODOS os documentos), esta
-- coluna guarda a lista de documentos individuais marcados como "não se aplica"
-- naquela diligência — ex.: uma presencial que tem contrato e recibo mas nunca
-- terá comprovante de serviço. Assim ela deixa de ficar eternamente pendente sem
-- precisar dispensar os documentos que ela DE FATO tem.
--
-- Valores possíveis dentro do array (mesmas chaves dos anexos):
--   'contratoAssinado', 'reciboAssinado', 'comprovantePagamento', 'comprovanteServico'
ALTER TABLE diligencias
  ADD COLUMN IF NOT EXISTS documentos_dispensados text[] NOT NULL DEFAULT '{}';
