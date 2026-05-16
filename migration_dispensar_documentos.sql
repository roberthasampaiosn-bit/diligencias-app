-- Migration: add dispensar_documentos column to diligencias table
ALTER TABLE diligencias ADD COLUMN IF NOT EXISTS dispensar_documentos boolean DEFAULT false;
