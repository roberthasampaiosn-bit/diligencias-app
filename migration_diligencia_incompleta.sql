-- Unificação Triagem × Diligências
-- Marca uma diligência como "rascunho" vinda da triagem (evento do e-mail):
-- os dados do e-mail estão corretos, mas os dados da diligência (modo, advogado,
-- valores) ainda não foram completados pela Anne.
--
-- Rascunhos (incompleta = true):
--   • aparecem na FILA DE PESQUISA (para contato com a vítima) como qualquer card,
--     agora com checkbox → WhatsApp em lote funciona também para itens da triagem;
--   • NÃO entram em Dashboard / Financeiro / Relatórios / lista de Diligências.
-- Ao completar (form de nova diligência ou edição), incompleta vira false.
--
-- O BACKFILL dos eventos pendentes que já existem é feito pelo script:
--   node scripts/backfill-diligencias-triagem.cjs            (dry-run)
--   node scripts/backfill-diligencias-triagem.cjs --commit   (grava)

ALTER TABLE diligencias
  ADD COLUMN IF NOT EXISTS incompleta boolean NOT NULL DEFAULT false;
