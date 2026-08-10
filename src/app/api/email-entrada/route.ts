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

// Fatia uma sequência de dígitos que pode conter VÁRIOS telefones grudados
// (ex.: 2 vítimas cujos números vieram colados: "11999999999" + "21988888888"
// = "1199999999921988888888"). Telefones BR têm 11 dígitos (celular, 3º dígito
// após o DDD costuma ser 9) ou 10 (fixo). Enquanto sobrar bloco válido, consome
// 11 quando parece celular, senão 10 — assim não vira um número gigante único.
function splitPhoneDigits(digits: string): string[] {
  if (!digits) return []
  if (digits.length <= 11) return [digits]
  const out: string[] = []
  let rest = digits
  while (rest.length >= 12) {
    const take = rest[2] === '9' ? 11 : 10
    out.push(rest.slice(0, take))
    rest = rest.slice(take)
  }
  if (rest.length) out.push(rest)
  return out
}

// Converte a "Data" do e-mail para ISO (YYYY-MM-DD). Aceita ISO e o formato
// brasileiro DD/MM/YYYY, COM ou SEM hora depois ("04/08/2026 00:00"). Sempre
// devolve ISO — NUNCA repassa "DD/MM/YYYY" adiante, senão o Postgres interpreta
// como MM/DD e troca o dia pelo mês (bug que fez eventos de agosto caírem em
// abril/maio). Se não reconhecer o formato, devolve '' (melhor vazio que trocado).
function normalizeDate(value: string | null | undefined): string {
  if (!value) return ''
  const s = String(value).trim()
  const pad = (n: string) => n.padStart(2, '0')
  // ISO no início, com ou sem hora: 2026-08-04 / 2026-8-4 10:00
  const iso = s.match(/(\d{4})-(\d{1,2})-(\d{1,2})/)
  if (iso) return `${iso[1]}-${pad(iso[2])}-${pad(iso[3])}`
  // DD/MM/YYYY no início, com ou sem hora: 04/08/2026 00:00
  const br = s.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/)
  if (br) return `${br[3]}-${pad(br[2])}-${pad(br[1])}`
  return ''
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
  const dataEvento          = extractField(text, 'Data')           // DD/MM/YYYY ou ISO
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
  const telefoneVitimaRaw = extractAfterSection(text, 'Envolvidos', 'Telefone')
  // Normaliza múltiplos telefones (2 vítimas). Separa por ";" "," "/" " e " ou
  // quebra de linha; para cada trecho, limpa os dígitos e, se vierem grudados,
  // fatia em telefones válidos. Rejunta com ";" para o pareamento nome<->telefone.
  const telefoneVitima = telefoneVitimaRaw
    .split(/[;,/]|\s+e\s+|\n/i)
    .flatMap((p) => splitPhoneDigits(p.replace(/\D/g, '')))
    .filter(Boolean)
    .join(';')

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

  // 5. Verificar se já existe evento com este CCC
  const { data: existentes } = await supabase
    .from('eventos')
    .select('id, classificacao_evento, nivel_agressao, motorista_agredido, nome_vitima, cargo_vitima, telefone_vitima, empresa, segmento, tipo_operador, cidade, uf, gtst, hora_evento, data_evento')
    .eq('ccc', ccc)
    .limit(1)

  if (existentes && existentes.length > 0) {
    const existente = existentes[0]

    // Identificar campos que mudaram em relação ao registro existente
    const patch: Record<string, unknown> = {}
    if (classificacaoEvento && existente.classificacao_evento !== classificacaoEvento)
      patch.classificacao_evento = classificacaoEvento
    if (nivelAgressao !== existente.nivel_agressao)
      patch.nivel_agressao = nivelAgressao
    if (motoristaAgredido !== existente.motorista_agredido)
      patch.motorista_agredido = motoristaAgredido
    if (nomeVitima && existente.nome_vitima !== nomeVitima)
      patch.nome_vitima = nomeVitima
    if (cargoVitima && existente.cargo_vitima !== cargoVitima)
      patch.cargo_vitima = cargoVitima
    if (telefoneVitima && existente.telefone_vitima !== telefoneVitima)
      patch.telefone_vitima = telefoneVitima
    if (empresa && existente.empresa !== empresa)
      patch.empresa = empresa
    if (segmento && existente.segmento !== segmento)
      patch.segmento = segmento
    if (tipoOperador && existente.tipo_operador !== tipoOperador)
      patch.tipo_operador = tipoOperador
    if (cidade && existente.cidade !== cidade)
      patch.cidade = cidade
    if (uf && existente.uf !== uf)
      patch.uf = uf
    if (horaEvento && existente.hora_evento !== horaEvento)
      patch.hora_evento = horaEvento
    if (normalizeDate(dataEvento) && existente.data_evento !== normalizeDate(dataEvento))
      patch.data_evento = normalizeDate(dataEvento)

    if (Object.keys(patch).length === 0) {
      console.log(`[email-entrada] Evento ${ccc} já existe com mesmos dados — ignorando.`)
      return NextResponse.json({ ok: true, skipped: true, ccc, reason: 'duplicate' })
    }

    // Há diferenças: atualizar e sinalizar para revisão
    patch.foi_atualizado = true

    const { error: updateError } = await supabase
      .from('eventos')
      .update(patch)
      .eq('id', existente.id)

    if (updateError) {
      console.error('[email-entrada] Erro ao atualizar evento:', updateError.message)
      return NextResponse.json({ error: updateError.message }, { status: 500 })
    }

    console.log(`[email-entrada] ✓ Evento ${ccc} atualizado — campos:`, Object.keys(patch))
    return NextResponse.json({ ok: true, updated: true, ccc, eventoId: existente.id, camposAlterados: Object.keys(patch).filter(k => k !== 'foi_atualizado') })
  }

  // 6. Inserir evento na triagem
  const row = {
    ccc,
    data_evento:          normalizeDate(dataEvento),
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

  // Unificação Triagem × Diligências: o evento já nasce com uma diligência-rascunho
  // vinculada (incompleta = true). Assim ele aparece na fila de Pesquisa como um card
  // normal (com checkbox → WhatsApp em lote) e todo o app o trata como diligência.
  // A Anne "completa" depois (modo/advogado/valores). Nunca bloqueia a criação do
  // evento: se a diligência falhar, o evento continua criado e visível na Triagem.
  if (ccc && ccc.trim()) {
    try {
      const rascunho = {
        empresa_cliente:  'BAT BRASIL',
        ccc,
        vitima:           (nomeVitima || '').replace(/^[\s:]+/, '').trim(),
        telefone_vitima:  telefoneVitima || '',
        cargo:            cargoVitima || '',
        empresa:          empresa || '',
        cidade:           cidade || '',
        uf:               uf || '',
        tipo_evento:      classificacaoEvento || 'Outro',
        tipo_diligencia:  'Suporte Jurídico Remoto',
        modo_diligencia:  'Remoto',
        advogado_id:      null,
        valor_diligencia: null,
        status:           'Realizada',
        status_pagamento: 'Pendente',
        ciclo_finalizado: false,
        incompleta:       true,
        evento_id:        novo.id,
        pesquisa_status:  'Pendente',
        data_evento:      normalizeDate(dataEvento),
        hora_evento:      horaEvento || null,
        data_atendimento: normalizeDate(dataEvento),
        segmento:         segmento || null,
        operacao:         tipoOperador || null,
        dp_registrou:     '',
      }
      // O evento PERMANECE 'pendente' na Triagem de propósito: é lá que a Roberta
      // verifica, classifica (presencial/remoto) e completa. O evento só sai da
      // Triagem quando ela clicar em "criar diligência / criar e concluir"
      // (grava status_evento='criado'). A diligência-rascunho fica vinculada
      // pelo evento_id só para a busca/rastreamento.
      const { error: rascunhoError } = await supabase.from('diligencias').insert(rascunho)
      if (rascunhoError) {
        console.error('[email-entrada] Aviso: falha ao criar diligência-rascunho:', rascunhoError.message)
      } else {
        console.log(`[email-entrada] ✓ Diligência-rascunho criada para ${ccc}`)
      }
    } catch (err) {
      console.error('[email-entrada] Aviso: exceção ao criar diligência-rascunho:', err)
    }
  }

  return NextResponse.json({ ok: true, ccc, eventoId: novo.id })
}
