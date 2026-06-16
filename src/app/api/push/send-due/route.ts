import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServiceClient } from '@/lib/supabaseServer'
import { sendPush, type StoredSubscription, type PushPayload } from '@/lib/webpush'
import { StatusDiligencia, StatusPesquisa } from '@/types'

// GET/POST /api/push/send-due?secret=CRON_SECRET
// Alvo do agendador (cron externo). Procura retornos de pesquisa cuja data/hora
// agendada já chegou e que ainda não foram avisados, e dispara o push.
// Dedupe via coluna pesquisa_retorno_notificado_para (guarda "YYYY-MM-DD HH:MM").

const LOOKBACK_MS = 12 * 60 * 60 * 1000 // não avisa retornos vencidos há mais de 12h

function parseScheduled(dataCombinada: string | null, hora: string | null): { key: string; when: Date } | null {
  if (!dataCombinada) return null
  // Apenas horário "HH:MM" (qualquer dia) → não dá para agendar um dia específico
  if (/^\d{2}:\d{2}$/.test(dataCombinada)) return null

  let datePart = dataCombinada
  let timePart = hora || ''
  const sep = dataCombinada.includes(' ') ? ' ' : dataCombinada.includes('T') ? 'T' : null
  if (sep) {
    datePart = dataCombinada.slice(0, dataCombinada.indexOf(sep))
    if (!timePart) timePart = dataCombinada.slice(dataCombinada.indexOf(sep) + 1, dataCombinada.indexOf(sep) + 6)
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(datePart)) return null
  if (!/^\d{2}:\d{2}/.test(timePart)) timePart = '09:00'
  timePart = timePart.slice(0, 5)

  // Interpreta a data/hora agendada como horário de Brasília
  const when = new Date(`${datePart}T${timePart}:00-03:00`)
  if (isNaN(when.getTime())) return null
  return { key: `${datePart} ${timePart}`, when }
}

async function handle(req: NextRequest): Promise<NextResponse> {
  const secret = process.env.CRON_SECRET
  const provided = req.nextUrl.searchParams.get('secret') || req.headers.get('x-cron-secret')
  if (!secret || provided !== secret) {
    return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 })
  }

  const supabase = createSupabaseServiceClient()

  const { data: dils, error } = await supabase
    .from('diligencias')
    .select('id, vitima, status, pesquisa_status, pesquisa_data_combinada, pesquisa_hora_entrevista, pesquisa_retorno_notificado_para')
    .eq('status', StatusDiligencia.Realizada)
    .not('pesquisa_data_combinada', 'is', null)

  if (error) {
    console.error('[push/send-due] query diligencias:', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // 'when' já é instante absoluto (data/hora BRT com offset -03:00),
  // então comparamos com o instante real atual.
  const agora = new Date()
  type Due = { id: string; vitima: string; key: string; time: string }
  const due: Due[] = []
  for (const d of dils ?? []) {
    if (d.pesquisa_status === StatusPesquisa.Concluida) continue
    const sched = parseScheduled(d.pesquisa_data_combinada, d.pesquisa_hora_entrevista ?? null)
    if (!sched) continue
    const diff = agora.getTime() - sched.when.getTime()
    if (diff < 0 || diff > LOOKBACK_MS) continue           // ainda não chegou, ou muito antigo
    if (d.pesquisa_retorno_notificado_para === sched.key) continue // já avisado
    due.push({ id: d.id, vitima: d.vitima || 'Pesquisa', key: sched.key, time: sched.key.slice(11) })
  }

  if (due.length === 0) {
    return NextResponse.json({ ok: true, enviados: 0, devidos: 0 })
  }

  const { data: subs } = await supabase
    .from('push_subscriptions')
    .select('endpoint, p256dh, auth')

  const subscriptions = (subs ?? []) as StoredSubscription[]
  let enviados = 0

  for (const item of due) {
    const payload: PushPayload = {
      title: 'Retorno de pesquisa agendado',
      body: `${item.vitima} — hora de retornar o contato (agendado ${item.time}).`,
      url: '/pesquisa',
      tag: `retorno-${item.id}`,
    }
    for (const sub of subscriptions) {
      const r = await sendPush(sub, payload)
      if (r.ok) enviados++
      else if (r.gone) {
        await supabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint)
      }
    }
    // Marca como avisado (mesmo sem inscrições, evita reprocessar)
    await supabase
      .from('diligencias')
      .update({ pesquisa_retorno_notificado_para: item.key })
      .eq('id', item.id)
  }

  return NextResponse.json({ ok: true, devidos: due.length, enviados, inscricoes: subscriptions.length })
}

export async function GET(req: NextRequest) { return handle(req) }
export async function POST(req: NextRequest) { return handle(req) }
