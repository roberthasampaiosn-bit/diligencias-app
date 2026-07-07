-- Remove diligências duplicadas criadas para o MESMO evento (bug antigo da triagem,
-- que gerava 2 cards com o mesmo CCC). Deduplica por evento_id (não por CCC), então
-- placeholders como "AUDIENCIA"/"N/A" (que não têm evento) NÃO são afetados.
--
-- Regra de qual manter, por evento: concluída > mais ligações > mais WA > mais antiga.
-- As demais do mesmo evento são removidas.
--
-- Cada consulta abaixo é INDEPENDENTE (não guarda nada entre Runs). Rode uma por vez.
-- ═════════════════════════════════════════════════════════════════════════════


-- ── CONSULTA A — CONFERIR (só leitura, não apaga nada) ───────────────────────
-- Selecione da linha "with" até o ";" e rode. Mostra o que será apagado.
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
select d.ccc, d.vitima, d.pesquisa_status, d.created_at
from diligencias d
where d.id in (select id from ranked where grp > 1 and rn > 1)
order by d.ccc;


-- ── CONSULTA B — APAGAR (um único comando; faz tudo de uma vez) ──────────────
-- Só rode depois de conferir a Consulta A. Selecione da linha "with" até o ";".
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
),
to_del as (
  select id from ranked where grp > 1 and rn > 1
),
del_ligs as (
  delete from ligacoes where diligencia_id in (select id from to_del)
),
upd_ev as (
  update eventos set diligencia_id = null where diligencia_id in (select id from to_del)
)
delete from diligencias where id in (select id from to_del);


-- ── CONSULTA C — TRAVA (impede novas duplicatas por evento) ──────────────────
-- Rode por último. Se der erro, sobrou alguma duplicata — me avise.
create unique index if not exists diligencias_evento_id_unico
  on diligencias (evento_id) where evento_id is not null;
