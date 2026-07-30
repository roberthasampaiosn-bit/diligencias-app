-- ============================================================================
-- Item D — vincular um documento avulso a uma diligência (CCC)
--
-- Guarda em qual diligência o avulso foi "encaixado". Quando você vincula um
-- avulso a um CCC, o app copia os tokens/links do ZapSign do avulso para a
-- diligência (e baixa o PDF já assinado, se houver) — assim o contrato/recibo
-- do avulso entra no PDF final daquele CCC.
--
-- SEGURO rodar mais de uma vez ("if not exists"). Não altera dados existentes.
-- ============================================================================

alter table documentos_avulsos
  add column if not exists diligencia_vinculada_id uuid
    references diligencias(id) on delete set null;
