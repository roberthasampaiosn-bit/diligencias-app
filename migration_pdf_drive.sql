-- Guarda se o PDF final da diligência já foi salvo no Google Drive (link + quando).
-- Rodar uma vez no Supabase → SQL Editor.
alter table diligencias add column if not exists pdf_drive_url text;
alter table diligencias add column if not exists pdf_drive_em timestamptz;
