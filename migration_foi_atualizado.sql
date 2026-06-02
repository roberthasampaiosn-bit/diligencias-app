-- Adiciona coluna para sinalizar eventos que foram atualizados por um email posterior
ALTER TABLE eventos ADD COLUMN IF NOT EXISTS foi_atualizado boolean NOT NULL DEFAULT false;
