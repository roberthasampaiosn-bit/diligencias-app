import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServiceClient } from '@/lib/supabaseServer'
import { sendPush, type StoredSubscription, type PushPayload } from '@/lib/webpush'
import { validarCPF, cleanPhone, toTitleCase } from '@/lib/utils'

// POST /api/cadastro-advogado
// Recebe o cadastro enviado pelo advogado no link público e grava na caixa de
// entrada (cadastros_advogados) usando a service_role. Esta é a ÚNICA porta que
// o formulário público usa — ele nunca fala direto com o banco, então não há
// como ler/alterar outros dados a partir do link.

interface Body {
  nomeCompleto?: string
  cpf?: string
  oab?: string
  endereco?: string
  cidadePrincipal?: string
  uf?: string
  cidadesAtendidas?: unknown
  telefone?: string
  chavePix?: string
  observacoes?: string
}

function str(v: unknown): string {
  return typeof v === 'string' ? v.trim() : ''
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  let body: Body
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'JSON inválido.' }, { status: 400 })
  }

  // ─── Validação (rede de segurança do lado do servidor) ──────────────────────
  const nomeCompleto = toTitleCase(str(body.nomeCompleto))
  if (nomeCompleto.length < 3) {
    return NextResponse.json({ error: 'Informe o nome completo.' }, { status: 400 })
  }

  const cpfDigits = str(body.cpf).replace(/\D/g, '')
  if (cpfDigits && !validarCPF(cpfDigits)) {
    return NextResponse.json({ error: 'CPF inválido.' }, { status: 400 })
  }

  const telefone = cleanPhone(str(body.telefone))
  if (telefone && (telefone.length < 10 || telefone.length > 11)) {
    return NextResponse.json({ error: 'Telefone deve ter DDD + número (10 ou 11 dígitos).' }, { status: 400 })
  }

  const cidadesAtendidas = Array.isArray(body.cidadesAtendidas)
    ? body.cidadesAtendidas.filter((c): c is string => typeof c === 'string' && c.trim().length > 0).map((c) => toTitleCase(c.trim()))
    : []

  const payload = {
    nome_completo: nomeCompleto,
    cpf: cpfDigits || null,
    oab: str(body.oab) || null,
    endereco: str(body.endereco) || null,
    cidade_principal: toTitleCase(str(body.cidadePrincipal)) || null,
    uf: str(body.uf).toUpperCase() || null,
    cidades_atendidas: cidadesAtendidas,
    telefone: telefone || null,
    chave_pix: str(body.chavePix) || null,
    observacoes: str(body.observacoes) || null,
    status: 'pendente',
  }

  const supabase = createSupabaseServiceClient()
  const { error } = await supabase.from('cadastros_advogados').insert(payload)
  if (error) {
    console.error('[cadastro-advogado] insert:', error.message)
    return NextResponse.json({ error: 'Não foi possível salvar. Tente novamente.' }, { status: 500 })
  }

  // ─── Avisa você por push (best-effort: não derruba o cadastro se falhar) ─────
  try {
    const { data: subs } = await supabase
      .from('push_subscriptions')
      .select('endpoint, p256dh, auth')
    const subscriptions = (subs ?? []) as StoredSubscription[]
    if (subscriptions.length > 0) {
      const notif: PushPayload = {
        title: 'Novo cadastro de advogado',
        body: `${nomeCompleto} enviou os dados pelo link. Toque para revisar e aprovar.`,
        url: '/cadastros',
        tag: 'novo-cadastro',
      }
      await Promise.all(subscriptions.map(async (sub) => {
        const r = await sendPush(sub, notif)
        if (r.gone) await supabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint)
      }))
    }
  } catch (e) {
    console.error('[cadastro-advogado] push falhou (ignorado):', e)
  }

  return NextResponse.json({ ok: true })
}
