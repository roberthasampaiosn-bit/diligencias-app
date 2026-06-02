-- ─── Migração: Suporte multi-empresa (empresaCliente) ───────────────────────
-- Executar no painel SQL do Supabase.
-- Registros existentes assumem BAT BRASIL por padrão (DEFAULT).

-- Campo cliente do escritório (separado de "empresa" da vítima)
ALTER TABLE diligencias
  ADD COLUMN IF NOT EXISTS empresa_cliente varchar NOT NULL DEFAULT 'BAT BRASIL';

-- Campos específicos para diligências V.TAL
ALTER TABLE diligencias ADD COLUMN IF NOT EXISTS data_atendimento date;
ALTER TABLE diligencias ADD COLUMN IF NOT EXISTS macro varchar;
ALTER TABLE diligencias ADD COLUMN IF NOT EXISTS local_atendimento varchar;
ALTER TABLE diligencias ADD COLUMN IF NOT EXISTS resultado_demanda varchar;
ALTER TABLE diligencias ADD COLUMN IF NOT EXISTS centro_custo varchar;
