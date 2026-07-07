-- Remove diligências duplicadas criadas para o MESMO evento (bug antigo da triagem,
-- que gerava 2 cards com o mesmo CCC). Deduplica por evento_id (não por CCC), então
-- placeholders como "AUDIENCIA"/"N/A" (que não têm evento) NÃO são afetados.
--
-- Regra de qual manter, por evento: a mais "completa" —
--   1) concluída antes de pendente
--   2) mais ligações
--   3) mais envios de WhatsApp
--   4) a mais antiga (registro original)
-- As demais do mesmo evento são removidas.

-- ── PASSO 1: montar a lista das duplicatas a remover ─────────────────────────
create temp table _dups_del as
with ranked as (
  select
    d.id,
    row_number() over (
      partition by d.evento_id
      order by
        (d.pesquisa_status = 'Concluída') desc,
        (select count(*) from ligacoes l where l.diligencia_id = d.id) desc,
        coalesce(d.pesquisa_tentativas_whatsapp, 0) desc,
        d.created_at asc
    ) as rn,
    count(*) over (partition by d.evento_id) as grp
  from diligencias d
  where d.evento_id is not null
)
select id from ranked where grp > 1 and rn > 1;

-- ── PASSO 2 (confira!): veja exatamente o que será apagado ───────────────────
select ccc, vitima, pesquisa_status, created_at
from diligencias
where id in (select id from _dups_del)
order by ccc;

-- ── PASSO 3: só rode depois de conferir o passo 2 ────────────────────────────
-- Remove dependências e as diligências duplicadas.
delete from ligacoes where diligencia_id in (select id from _dups_del);
update eventos set diligencia_id = null where diligencia_id in (select id from _dups_del);
delete from diligencias where id in (select id from _dups_del);

drop table _dups_del;

-- ── PASSO 4: trava definitiva — impede 2 diligências para o mesmo evento ─────
-- (só roda limpo se não sobrar nenhuma duplicata; se falhar, ainda há dups)
create unique index if not exists diligencias_evento_id_unico
  on diligencias (evento_id) where evento_id is not null;
