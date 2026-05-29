-- Tabela para persistir documentos avulsos gerados (contrato/recibo sem diligência vinculada)
CREATE TABLE IF NOT EXISTS documentos_avulsos (
  id            uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  advogado_id   uuid REFERENCES advogados(id) ON DELETE SET NULL,
  advogado_nome text NOT NULL,
  tipo          text NOT NULL,  -- 'contrato' | 'recibo' | 'ambos'
  valor         numeric NOT NULL,
  data_atendimento text,
  tipo_servico  text,
  -- Contrato
  filename_contrato             text,
  zapsign_token_contrato        text,
  link_assinatura_adriana       text,
  link_assinatura_advogado_contrato text,
  -- Recibo
  filename_recibo               text,
  zapsign_token_recibo          text,
  link_assinatura_advogado_recibo text,
  created_at timestamptz DEFAULT now()
);

-- Índice para busca por advogado
CREATE INDEX IF NOT EXISTS idx_documentos_avulsos_advogado ON documentos_avulsos(advogado_id);
