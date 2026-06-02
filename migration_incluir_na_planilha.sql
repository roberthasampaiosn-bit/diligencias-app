-- ═══════════════════════════════════════════════════════════════════════════
-- Campo incluir_na_planilha — diligências com valor zero que devem aparecer
-- na planilha de diligências com custo (ex: audiências da equipe interna)
-- Executar no Supabase Dashboard → SQL Editor
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE diligencias
  ADD COLUMN IF NOT EXISTS incluir_na_planilha boolean DEFAULT false;
