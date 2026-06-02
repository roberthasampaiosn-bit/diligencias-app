-- ═══════════════════════════════════════════════════════════════════════════
-- RLS — Row Level Security — Ana Rodrigues Advocacia
-- Executar UMA VEZ no Supabase Dashboard → SQL Editor
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Efeito: apenas usuários autenticados (os 3 cadastrados) conseguem
-- ler ou gravar dados. A anon key sem login retorna 0 registros.
-- As rotas de API do servidor (service_role) não são afetadas.
-- ═══════════════════════════════════════════════════════════════════════════

-- 1. Ativar RLS em todas as tabelas
ALTER TABLE advogados        ENABLE ROW LEVEL SECURITY;
ALTER TABLE diligencias      ENABLE ROW LEVEL SECURITY;
ALTER TABLE ligacoes         ENABLE ROW LEVEL SECURITY;
ALTER TABLE eventos          ENABLE ROW LEVEL SECURITY;
ALTER TABLE consultas_placas ENABLE ROW LEVEL SECURITY;

-- 2. Remover políticas anteriores (se existirem), para evitar conflito
DROP POLICY IF EXISTS "acesso_autenticado" ON advogados;
DROP POLICY IF EXISTS "acesso_autenticado" ON diligencias;
DROP POLICY IF EXISTS "acesso_autenticado" ON ligacoes;
DROP POLICY IF EXISTS "acesso_autenticado" ON eventos;
DROP POLICY IF EXISTS "acesso_autenticado" ON consultas_placas;

-- 3. Criar política: qualquer usuário autenticado tem acesso total
--    (SELECT + INSERT + UPDATE + DELETE)
--    Os 3 usuários têm permissão igual — sem restrição por user_id.

CREATE POLICY "acesso_autenticado" ON advogados
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "acesso_autenticado" ON diligencias
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "acesso_autenticado" ON ligacoes
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "acesso_autenticado" ON eventos
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "acesso_autenticado" ON consultas_placas
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);

-- ═══════════════════════════════════════════════════════════════════════════
-- Verificação (execute após o bloco acima para confirmar)
-- ═══════════════════════════════════════════════════════════════════════════
SELECT
  schemaname,
  tablename,
  rowsecurity AS rls_ativo
FROM pg_tables
WHERE tablename IN ('advogados','diligencias','ligacoes','eventos','consultas_placas')
ORDER BY tablename;
