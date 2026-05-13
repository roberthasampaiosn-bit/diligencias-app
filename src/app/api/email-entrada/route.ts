import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServiceClient } from '@/lib/supabaseServer'

// POST /api/email-entrada
// Chamado pelo Power Automate quando chega um email "Security Incident Report".
// Payload esperado:
//   { emailBody: string (HTML), receivedAt: string (ISO 8601), subject?: string }
// Header obrigatório:
//   x-webhook-secret: <EMAIL_WEBHOOK_SECRET>

// ─── Helpers de parsing ───────────────────────────────────────────────────────

function stripHtml(html: string): string {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<\/div>/gi, '\n')
    .replace(/<\/tr>/gi, '\n')
    .replace(/<\/td>/gi, ' ')
    .replace(/<\/th>/gi, ' ')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\n[ \t]+/g, '\n')
    .trim()
}

function extractField(text: string, label: string): string {
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const regex = new RegExp(`${escaped}\\s*:?\\s*(.+?)(?=\\r?\\n|$)`, 'im')
  const m = text.match(regex)
  return m ? m[1].trim() : ''
}

// Extrai um campo dentro de uma seção específica do texto
function extractAfterSection(text: string, sectionLabel: string, fieldLabel: string): string {
  const sectionEscaped = sectionLabel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const idx = text.search(new RegExp(sectionEscaped, 'i'))
  if (idx < 0) return ''
  return extractField(text.slice(idx), fieldLabel)
}

function extractNivelAgressao(text: string): number {
  const raw = extractField(text, 'Nível de Agressão')
  const m = raw.match(/^(\d+)/)
  return m ? parseInt(m[1], 10) : 0
}

function isoToDateAndTime(iso: string): { date: string; time: string } {
  // receivedAt chega como UTC; converter para horário de Brasília (UTC-3)
  const d = new Date(iso)
  const brt = new Date(d.getTime() - 3 * 60 * 60 * 1000)
  const date = brt.toISOString().split('T')[0]               // YYYY-MM-DD
  const time = brt.toISOString().split('T')[1].slice(0, 5)   // HH:MM
  return { date, time }
}

// ─── Handler ──────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest): Promise<NextResponse> {
  // 1. Autenticação simples via header
// const secret = process.env.EMAIL_WEBHOOK_SECRET
// if (secret) {
//   const provided = req.headers.get('x-webhook-secret')
//   if (provided !== secret) {
//     console.warn('[email-entrada] Secret inválido.')
//     return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 })
//   }
// }

  // 2. Parse do payload
  let payload: { emailBody: string; receivedAt: string; subject?: string }
  try {
    payload = await req.json()
  } catch {
    return NextResponse.json({ error: 'JSON inválido.' }, { status: 400 })
  }

  const { emailBody, receivedAt, subject } = payload
  if (!emailBody || !receivedAt) {
    return NextResponse.json(
      { error: 'Campos obrigatórios: emailBody, receivedAt.' },
      { status: 400 },
    )
  }

  // 3. Extrair texto limpo do HTML
  const text = stripHtml(emailBody)
  console.log('[email-entrada] Subject:', subject)
  console.log('[email-entrada] Texto extraído (primeiros 800 chars):\n', text.slice(0, 800))

  // 4. Extrair campos do email
  const ccc                 = extractField(text, 'ID do evento')
  const dataEvento          = extractField(text, 'Data')           // já vem YYYY-MM-DD
  const horaEvento          = extractField(text, 'Hora')           // HH:MM
  const tipoOperador        = extractField(text, 'Tipo de Operador')
  const empresa             = extractField(text, 'Nome da Empresa')
  const segmento            = extractField(text, 'Segmento')
  const classificacaoEvento = extractField(text, 'Classificação do evento')
  const nivelAgressao       = extractNivelAgressao(text)
  const cidade              = extractField(text, 'Cidade')
  const uf                  = extractField(text, 'Estado')
  const gtsc                = extractField(text, 'GTSC')

  // Dados da vítima ficam na seção "Envolvidos"
  const nomeVitima     = extractAfterSection(text, 'Envolvidos', 'Nome')
  const cargoVitima    = extractAfterSection(text, 'Envolvidos', 'Cargo')
  const telefoneVitima = extractAfterSection(text, 'Envolvidos', 'Telefone')

  // Motorista agredido: nível > 1 E cargo menciona "motorista"
  const motoristaAgredido =
    nivelAgressao > 1 && cargoVitima.toLowerCase().includes('motorista')

  // Data/hora do informativo = quando o email chegou (horário Brasília)
  const { date: dataInformativo, time: horaInformativo } = isoToDateAndTime(receivedAt)

  if (!ccc) {
    console.error('[email-entrada] "ID do evento" não encontrado. Texto:\n', text.slice(0, 1000))
    return NextResponse.json(
      { error: 'Campo "ID do evento" não encontrado no corpo do email.' },
      { status: 422 },
    )
  }

  console.log('[email-entrada] Campos extraídos:', {
    ccc, dataEvento, horaEvento, tipoOperador, empresa, segmento,
    classificacaoEvento, nivelAgressao, cidade, uf, gtsc,
    nomeVitima, cargoVitima, telefoneVitima, motoristaAgredido,
    dataInformativo, horaInformativo,
  })

  const supabase = createSupabaseServiceClient()

  // 5. Verificar duplicata pelo CCC
  const { data: existentes } = await supabase
    .from('eventos')
    .select('id')
    .eq('ccc', ccc)
    .limit(1)

  if (existentes && existentes.length > 0) {
    console.log(`[email-entrada] Evento ${ccc} já existe — ignorando.`)
    return NextResponse.json({ ok: true, skipped: true, ccc, reason: 'duplicate' })
  }

  // 6. Inserir evento na triagem
  const row = {
    ccc,
    data_evento:          dataEvento,
    hora_evento:          horaEvento,
    data_informativo:     dataInformativo,
    hora_informativo:     horaInformativo,
    tipo_operador:        tipoOperador,
    empresa,
    segmento,
    classificacao_evento: classificacaoEvento,
    nivel_agressao:       nivelAgressao,
    motorista_agredido:   motoristaAgredido,
    nome_vitima:          nomeVitima  || null,
    cargo_vitima:         cargoVitima || null,
    telefone_vitima:      telefoneVitima || null,
    cidade,
    uf,
    gtst:                 gtsc,
    modalidade:           null,
    status_evento:        'pendente',
    diligencia_id:        null,
  }

  const { data: novo, error } = await supabase
    .from('eventos')
    .insert(row)
    .select()
    .single()

  if (error) {
    console.error('[email-entrada] Erro ao inserir evento:', error.message, error.details)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  console.log(`[email-entrada] ✓ Evento criado: ${ccc} (id=${novo.id})`)
  return NextResponse.json({ ok: true, ccc, eventoId: novo.id })
}
