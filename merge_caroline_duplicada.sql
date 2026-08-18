-- =============================================================================
-- Merge do cadastro DUPLICADO da Caroline Werner
--   MANTÉM  : "Caroline Werner - Fadel"  (São Paulo/SP)  -> cadastro completo
--   REMOVE  : "Caroline Werner"          (sem cidade/UF) -> duplicado
-- Antes de apagar, reaponta todas as referências (diligências, documentos
-- avulsos e o link de cadastro) para o cadastro que fica.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- PASSO 1 — PRÉVIA (rode só isto primeiro e confira os dois cadastros)
-- -----------------------------------------------------------------------------
SELECT id, nome_completo, cidade_principal, uf, oab, telefone, created_at
FROM advogados
WHERE nome_completo ILIKE '%caroline werner%'
ORDER BY created_at;

-- Quantas diligências / documentos cada um tem hoje:
SELECT a.id, a.nome_completo, a.uf,
       (SELECT count(*) FROM diligencias        d WHERE d.advogado_id = a.id) AS qt_diligencias,
       (SELECT count(*) FROM documentos_avulsos x WHERE x.advogado_id = a.id) AS qt_documentos
FROM advogados a
WHERE a.nome_completo ILIKE '%caroline werner%'
ORDER BY a.created_at;


-- -----------------------------------------------------------------------------
-- PASSO 2 — MERGE (rode depois de conferir a prévia acima)
-- Faz tudo numa transação: se algo der errado, nada é aplicado.
-- -----------------------------------------------------------------------------
DO $$
DECLARE
  keeper uuid;  -- cadastro que FICA (Caroline Werner - Fadel, SP)
  dupe   uuid;  -- cadastro que SAI  (Caroline Werner, sem UF)
BEGIN
  -- Fica: tem "fadel" no nome E UF = SP
  SELECT id INTO keeper
  FROM advogados
  WHERE nome_completo ILIKE '%caroline werner%fadel%' AND uf = 'SP'
  LIMIT 1;

  -- Sai: qualquer outro "Caroline Werner" que não seja o keeper
  SELECT id INTO dupe
  FROM advogados
  WHERE nome_completo ILIKE '%caroline werner%'
    AND id <> keeper
  LIMIT 1;

  IF keeper IS NULL OR dupe IS NULL THEN
    RAISE EXCEPTION 'Abortado: keeper=% dupe=% (confira a prévia do PASSO 1)', keeper, dupe;
  END IF;

  -- Reaponta as referências do duplicado para o cadastro que fica
  UPDATE diligencias         SET advogado_id = keeper WHERE advogado_id = dupe;
  UPDATE documentos_avulsos  SET advogado_id = keeper WHERE advogado_id = dupe;
  UPDATE cadastros_advogados SET advogado_id = keeper WHERE advogado_id = dupe;

  -- Remove o duplicado
  DELETE FROM advogados WHERE id = dupe;

  RAISE NOTICE 'OK — referências movidas para % ; removido %', keeper, dupe;
END $$;


-- -----------------------------------------------------------------------------
-- PASSO 3 — CONFERÊNCIA (deve sobrar só um "Caroline Werner")
-- -----------------------------------------------------------------------------
SELECT id, nome_completo, cidade_principal, uf
FROM advogados
WHERE nome_completo ILIKE '%caroline werner%'
ORDER BY created_at;
