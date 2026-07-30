-- ═══════════════════════════════════════════════════════════════════════════════
-- Item G1 — registrar o HORÁRIO do envio do WhatsApp da pesquisa
-- ═══════════════════════════════════════════════════════════════════════════════
-- Até agora o app gravava só a DATA do envio (pesquisa_data_envio_whatsapp).
-- Esta coluna guarda o horário (texto "HH:MM"), no mesmo padrão de
-- pesquisa_hora_entrevista. O código passa a gravar data + hora a cada envio,
-- tanto na fila de pesquisa quanto nos eventos de triagem.
--
-- SEGURO rodar mais de uma vez — "if not exists" evita erro se já existir.
-- Não altera dados existentes; registros antigos ficam com a hora em branco.
-- ═══════════════════════════════════════════════════════════════════════════════

alter table diligencias
  add column if not exists pesquisa_hora_envio_whatsapp text;
