-- Remove diligências duplicadas do MESMO CCC (bug antigo da triagem, que gerava
-- 2 cards com o mesmo CCC). Deduplica por CCC, mas SÓ nos CCCs reais de evento
-- ("BR-..."). Placeholders como "AUDIENCIA"/"N/A" não começam com "BR-" e por isso
-- NÃO são tocados (são audiências/casos legítimos que só repetem o rótulo).
--
-- Regra de qual manter, por CCC: concluída > mais ligações > mais WA > mais antiga.
-- As demais do mesmo CCC são removidas.
--
-- Cada consulta abaixo é INDEPENDENTE. Rode uma por vez (selecione do "with"/"create"
-- até o ";" e clique Run).
-- ═════════════════════════════════════════════════════════════════════════════


-- ── CONSULTA A — CONFERIR (só leitura, não apaga nada) ───────────────────────
with ranked as (
  select
    d.id,
    row_number() over (
      partition by d.ccc
      order by
        (d.pesquisa_status = 'Concluída') desc,
        (select count(*) from ligacoes l where l.diligencia_id = d.id) desc,
        coalesce(d.pesquisa_tentativas_whatsapp, 0) desc,
        d.created_at asc
    ) as rn,
    count(*) over (partition by d.ccc) as grp
  from diligencias d
  where d.empresa_cliente <> 'V.TAL' and d.ccc like 'BR-%'
)
select d.ccc, d.vitima, d.pesquisa_status, d.created_at
from diligencias d
where d.id in (select id from ranked where grp > 1 and rn > 1)
order by d.ccc;


-- ── CONSULTA B — APAGAR (um único comando; faz tudo de uma vez) ──────────────
-- Só rode depois de conferir a Consulta A.
with ranked as (
  select
    d.id,
    row_number() over (
      partition by d.ccc
      order by
        (d.pesquisa_status = 'Concluída') desc,
        (select count(*) from ligacoes l where l.diligencia_id = d.id) desc,
        coalesce(d.pesquisa_tentativas_whatsapp, 0) desc,
        d.created_at asc
    ) as rn,
    count(*) over (partition by d.ccc) as grp
  from diligencias d
  where d.empresa_cliente <> 'V.TAL' and d.ccc like 'BR-%'
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


-- ── CONSULTA C — TRAVA (impede novas duplicatas do mesmo CCC "BR-...") ───────
-- Rode por último. Se der erro, sobrou alguma duplicata — me avise.
create unique index if not exists diligencias_ccc_bat_unico
  on diligencias (ccc) where ccc like 'BR-%';
