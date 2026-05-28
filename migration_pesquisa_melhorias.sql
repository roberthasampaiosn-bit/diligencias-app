-- Migração: melhorias na área de Pesquisas
-- Execute no Supabase SQL Editor (ou psql) antes de fazer o deploy.

ALTER TABLE diligencias
  ADD COLUMN IF NOT EXISTS pesquisa_tentativas_whatsapp integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS pesquisa_data_conclusao      text;
