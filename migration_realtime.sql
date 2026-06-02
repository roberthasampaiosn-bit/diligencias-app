-- ═══════════════════════════════════════════════════════════════════════════
-- REALTIME — Habilitar sincronização em tempo real para todas as tabelas
-- Executar UMA VEZ no Supabase Dashboard → SQL Editor
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Efeito: qualquer alteração feita por qualquer usuário (Anne, Adriana, Roberta)
-- será propagada automaticamente para todos os outros sem precisar recarregar a página.
-- ═══════════════════════════════════════════════════════════════════════════

-- Adicionar as tabelas ao canal de publicação do Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE diligencias;
ALTER PUBLICATION supabase_realtime ADD TABLE eventos;
ALTER PUBLICATION supabase_realtime ADD TABLE advogados;
ALTER PUBLICATION supabase_realtime ADD TABLE ligacoes;
ALTER PUBLICATION supabase_realtime ADD TABLE consultas_placas;

-- Verificar quais tabelas estão no Realtime (deve listar todas acima)
SELECT schemaname, tablename
FROM pg_publication_tables
WHERE pubname = 'supabase_realtime'
ORDER BY tablename;
