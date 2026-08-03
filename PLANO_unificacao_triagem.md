# Plano — Unificar Triagem e Diligências

> Status: **proposta para revisão** (nada implementado ainda). Escrito em 31/07/2026.

## Objetivo

Acabar com o "cérebro dividido" do sistema: hoje um caso existe como **Evento** (na
triagem) e só vira **Diligência** quando a Anne processa. Isso obriga cada recurso a
ser feito duas vezes — e é por isso que "algumas coisas funcionam na diligência e
outras não na triagem" (ex.: WhatsApp em lote não tem checkbox nos cartões de triagem).

A ideia (do Roberta): **o evento do e-mail já nasce como uma diligência "a completar"**.
Aí existe *um tipo só* de coisa no sistema → todo recurso funciona em todo lugar.

## Causa raiz (confirmada no código)

- `src/app/(app)/pesquisa/page.tsx` tem DUAS listas: `lista` (diligências, com checkbox
  e lote) e `triagemPendentes` (eventos sem diligência, cartões âmbar **sem** checkbox).
- `criarDiligenciaDoEvento()` cria a diligência "na hora" quando você liga/manda WA num
  evento — gambiarra que mantém o evento como `pendente` e duplica a renderização.
- Modelo atual: `Evento.statusEvento` = `pendente | criado | arquivado`;
  `Diligencia.status` = `Em andamento | Realizada` (só dois).

## Estratégia recomendada: FLAG booleana, não novo status

Duas formas de marcar "diligência ainda incompleta":

| Abordagem | Prós | Contras |
|---|---|---|
| **(A) Flag `incompleta: boolean`** na diligência | Menos invasivo. `status` continua `Realizada`, então a fila de Pesquisa já pega. Financeiro/Relatórios já ignoram valor 0. | Precisa gate na flag em ~3 telas. |
| (B) Novo `StatusDiligencia.Rascunho` | Semântica explícita | Toca todo lugar que faz switch em status; badges, filtros, etc. Mais risco. |

**Recomendo a (A)** — flag `incompleta` (ou `dadosCompletos`). É a de menor risco porque
a maioria dos contadores financeiros **já** filtra por `valorDiligencia > 0`, e o
rascunho nasce com valor 0.

## Mudanças por arquivo

1. **Migração SQL** (`migration_diligencia_incompleta.sql`)
   - `ALTER TABLE diligencias ADD COLUMN incompleta boolean NOT NULL DEFAULT false;`
   - Backfill: criar uma diligência-rascunho (`incompleta=true`) para cada evento
     `statusEvento='pendente'` que ainda não tem `diligenciaId`, copiando os dados do
     e-mail (CCC, vítima, telefone, cargo, empresa, cidade/UF, tipoEvento, data/hora).
     Vincular `evento.diligencia_id` ↔ `diligencia.evento_id`.

2. **Nascimento do evento** — `src/app/api/email-entrada/route.ts` (~linha 276, o
   `insert` em `eventos`): após inserir o evento, inserir também a diligência-rascunho
   vinculada. (Alternativa mais robusta: trigger no Postgres, mas ficar no route.ts é
   mais simples de manter.)

3. **Tipos** — `src/types/index.ts` (`interface Diligencia`) e `src/types/db.ts`
   (`DiligenciaRow`): adicionar `incompleta`. Ajustar `src/lib/mappers.ts`.

4. **Tela Pesquisa** — `src/app/(app)/pesquisa/page.tsx`: **remover** `triagemPendentes`,
   `criarDiligenciaDoEvento`, e o bloco de cartões âmbar. Os rascunhos passam a entrar
   em `lista` como qualquer diligência → checkbox + WhatsApp em lote **de graça**.
   (É a correção que destrava a Anne.)

5. **Tela Triagem** — `src/app/(app)/triagem/page.tsx` + `components/triagem/EventoCard.tsx`:
   deixa de ser "eventos a criar" e passa a listar **diligências `incompleta=true`**.
   O botão vira "Completar dados" em vez de "Criar diligência".

6. **Contadores a revisar** (auditoria feita — ver seção abaixo).

## Auditoria dos contadores (o cuidado principal)

Rascunho **não** pode poluir números de serviço faturável. Situação de cada tela:

- ✅ **Financeiro** (`financeiro/page.tsx`): já filtra `valorDiligencia > 0 || incluirNaPlanilha`
  e por `statusPagamento`. Rascunho (valor 0) **já sai fora**. Sem mudança.
- ✅ **Relatórios** (`relatorios/page.tsx`): `batCC` também gate em `valor > 0 || incluirNaPlanilha`.
  Seguro. Conferir só contagens de presencial/remoto (rascunho tem modo vazio → não conta).
- ⚠️ **Dashboard** (`dashboard/page.tsx`): `total: all.length` e `pendentes: status===EmAndamento`
  contam **tudo**. Precisa excluir `incompleta` desses cards e do bloco "pendências".
- ⚠️ **Lista de Diligências** (`diligencias/page.tsx`): mostraria os rascunhos. Decidir:
  esconder por padrão **ou** adicionar chip "A completar". Recomendo esconder por padrão
  e ter o chip.

## Migração dos dados existentes

- Hoje há eventos `pendente` sem diligência. O backfill (item 1) cria os rascunhos.
- Eventos já `criado` (com diligência) — nada muda, `incompleta=false`.
- Rodar **DRY-RUN** primeiro (contar quantos rascunhos seriam criados) antes do commit.

## Riscos e mitigação

- **App em uso diário** → fazer fora do horário de pico; ter rollback pronto.
- **Duplicidade**: garantir que o backfill não crie rascunho para evento que já tem
  `diligenciaId`. Usar `NOT EXISTS`.
- **Realtime**: a tela de Pesquisa e Diligências usam Supabase realtime — testar que os
  rascunhos aparecem/somem ao vivo.

## Rollback

- `incompleta` tem default `false` → se algo der errado, basta parar de criar rascunhos;
  os já criados podem ser arquivados ou deletados por script (guardar os IDs criados no
  backfill).

## Ordem de execução sugerida

1. Migração + backfill em DRY-RUN → conferir contagem.
2. Tipos + mappers + flag.
3. Auto-criação no `email-entrada`.
4. Ajuste do Dashboard e da Lista de Diligências (contadores).
5. Reescrever Pesquisa (remover caminho da triagem) e Triagem (listar incompletas).
6. Backfill em COMMIT.
7. `git push origin main` → validar em produção com um caso real.

---

### Fase 1 alternativa (se quiser destravar a Anne antes da unificação)

Só adicionar checkbox + WhatsApp em lote nos cartões de triagem da tela de Pesquisa.
Baixo risco, não mexe em contadores nem migração. Não resolve o problema de fundo, mas
tira a dor imediata.
