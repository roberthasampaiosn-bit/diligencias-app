-- Adiciona coluna para descrição livre quando tipo_diligencia = 'Outro'
ALTER TABLE diligencias
  ADD COLUMN IF NOT EXISTS tipo_diligencia_descricao varchar;
