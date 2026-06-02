-- Adiciona coluna OAB nº no cadastro de advogados
ALTER TABLE advogados
  ADD COLUMN IF NOT EXISTS oab_numero varchar;
