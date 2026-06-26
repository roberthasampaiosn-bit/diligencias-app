-- ─────────────────────────────────────────────────────────────────────────────
-- Tabela: cadastros_advogados
-- Caixa de entrada dos cadastros enviados pelos advogados pelo link público.
-- O formulário público NÃO fala direto com o banco: ele envia para a rota de
-- API /api/cadastro-advogado, que grava aqui usando a service_role (servidor).
-- O RLS abaixo garante que ninguém com a chave pública (anon) consiga ler,
-- alterar ou apagar nada — só o app logado (authenticated).
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.cadastros_advogados (
  id                 uuid primary key default gen_random_uuid(),
  nome_completo      text not null,
  cpf                text,                 -- só dígitos (ex.: 12345678900)
  oab                text,                 -- "SP 123456"
  endereco           text,
  cidade_principal   text,
  uf                 text,
  cidades_atendidas  text[] not null default '{}',
  telefone           text,                 -- só dígitos com DDD
  chave_pix          text,
  observacoes        text,
  -- 'pendente' (aguardando sua aprovação) | 'aprovado' | 'descartado'
  status             text not null default 'pendente',
  -- preenchido quando você aprova: id do advogado criado/atualizado
  advogado_id        uuid,
  created_at         timestamptz not null default now()
);

create index if not exists idx_cadastros_advogados_status
  on public.cadastros_advogados (status, created_at desc);

-- ─── Segurança (RLS) ─────────────────────────────────────────────────────────
alter table public.cadastros_advogados enable row level security;

-- Apenas usuários logados no app (authenticated) podem ver e gerenciar a caixa.
-- A chave pública (anon) fica sem nenhuma policy => acesso negado por padrão.
-- A rota de API usa a service_role, que ignora o RLS — é assim que o cadastro
-- público entra com segurança, sem abrir o banco.
drop policy if exists "cadastros_authenticated_all" on public.cadastros_advogados;
create policy "cadastros_authenticated_all"
  on public.cadastros_advogados
  for all
  to authenticated
  using (true)
  with check (true);

-- Realtime: para a caixa de entrada atualizar sozinha quando chega cadastro novo.
alter publication supabase_realtime add table public.cadastros_advogados;
