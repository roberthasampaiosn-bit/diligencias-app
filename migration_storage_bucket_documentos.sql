-- Ajuste do bucket de Storage "documentos"
--
-- Problema: upload de PDF/foto pelo iPhone falhava ("só funciona no notebook").
-- Causa provável: o bucket restringe tipos MIME e, no iOS/Safari, o arquivo
-- chega com MIME vazio -> rejeitado só no celular.
--
-- Rode ISTO no Supabase → SQL Editor. Escolha UMA das duas opções abaixo.

-- 1) DIAGNÓSTICO — veja como o bucket está hoje:
select id, public, file_size_limit, allowed_mime_types
from storage.buckets
where id = 'documentos';

-- ---------------------------------------------------------------------------
-- OPÇÃO A (recomendada) — libera todos os tipos e aumenta o limite p/ 50 MB.
-- allowed_mime_types = NULL significa "aceitar qualquer tipo".
update storage.buckets
set
  file_size_limit   = 52428800,  -- 50 MB (em bytes)
  allowed_mime_types = null
where id = 'documentos';

-- ---------------------------------------------------------------------------
-- OPÇÃO B (restrita) — mantém uma lista fechada, mas cobrindo os formatos
-- que o app realmente envia (PDF, fotos incl. HEIC do iPhone, Word).
-- Use ESTA em vez da Opção A se preferir limitar os tipos aceitos.
--
-- update storage.buckets
-- set
--   file_size_limit   = 52428800,  -- 50 MB
--   allowed_mime_types = array[
--     'application/pdf',
--     'image/jpeg',
--     'image/png',
--     'image/heic',
--     'image/heif',
--     'application/msword',
--     'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
--   ]
-- where id = 'documentos';

-- Confirme depois de rodar:
select id, public, file_size_limit, allowed_mime_types
from storage.buckets
where id = 'documentos';
