-- ============================================================================
-- Item B — marcar quando o PDF final de uma diligência já foi gerado
--
-- Guarda a data/hora da última geração do PDF final, só para exibir um aviso
-- ("PDF final já gerado em ..."). NÃO bloqueia gerar de novo.
--
-- SEGURO rodar mais de uma vez ("if not exists"). Não altera dados existentes.
-- ============================================================================

alter table diligencias
  add column if not exists pdf_final_gerado_em timestamptz;
