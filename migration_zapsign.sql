-- Migration: ZapSign — campos de assinatura digital
-- Executar no Supabase SQL Editor (Dashboard > SQL Editor > New query)
-- Seguro para rodar múltiplas vezes (IF NOT EXISTS)

ALTER TABLE diligencias
  ADD COLUMN IF NOT EXISTS zapsign_document_id_contrato TEXT,
  ADD COLUMN IF NOT EXISTS zapsign_document_id_recibo    TEXT,
  ADD COLUMN IF NOT EXISTS link_assinatura_adriana               TEXT,
  ADD COLUMN IF NOT EXISTS link_assinatura_advogado_contrato     TEXT,
  ADD COLUMN IF NOT EXISTS link_assinatura_advogado_recibo       TEXT,
  ADD COLUMN IF NOT EXISTS status_assinatura_contrato            TEXT,
  ADD COLUMN IF NOT EXISTS status_assinatura_recibo              TEXT;

-- Verificar resultado
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'diligencias'
  AND column_name LIKE '%zapsign%'
  OR column_name LIKE '%assinatura%'
ORDER BY ordinal_position;
