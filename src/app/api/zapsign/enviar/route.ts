import { NextRequest, NextResponse } from 'next/server'

// POST /api/zapsign/enviar
// Envia um PDF (base64) para a ZapSign e retorna o token do documento e os
// links de assinatura. Não escreve no banco — o cliente faz isso via
// updateDiligencia após receber a resposta.

export interface EnviarZapSignBody {
  pdfBase64: string
  filename: string
  // 'contrato_recibo' = contrato + recibo mesclados num único documento (advogado
  // assina uma vez só; Adriana também assina, como no contrato).
  tipo: 'contrato' | 'recibo' | 'contrato_recibo'
  diligenciaId?: string
  nomeAdvogado: string
  whatsappAdvogado: string
}

export interface EnviarZapSignResult {
  documentToken: string
  linkAdriana?: string   // apenas no contrato
  linkAdvogado: string
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const body = (await req.json()) as EnviarZapSignBody
  const { pdfBase64, filename, tipo, nomeAdvogado, whatsappAdvogado } = body

  const apiToken = process.env.ZAPSIGN_API_TOKEN
  if (!apiToken) {
    return NextResponse.json({ error: 'ZAPSIGN_API_TOKEN não configurado.' }, { status: 500 })
  }

  const emailAdriana =
    process.env.ZAPSIGN_EMAIL_ADRIANA ??
    process.env.NEXT_PUBLIC_ZAPSIGN_EMAIL_ADRIANA ??
    'adriana@placeholder.com'

  const telefoneAdriana =
    process.env.ZAPSIGN_TELEFONE_ADRIANA ??
    process.env.NEXT_PUBLIC_ZAPSIGN_TELEFONE_ADRIANA ??
    '11999999999'

  const telefoneAdvogado = whatsappAdvogado.replace(/\D/g, '')

  const signerAdriana = {
    name: 'Adriana Rodrigues',
    email: emailAdriana,
    phone_country: '55',
    phone_number: telefoneAdriana.replace(/\D/g, ''),
    auth_mode: 'assinaturaTela',
    send_automatic_email: false,
    send_automatic_whatsapp: false,
  }

  const signerAdvogado = {
    name: nomeAdvogado,
    email: 'nao-informado@placeholder.com',
    phone_country: '55',
    phone_number: telefoneAdvogado,
    auth_mode: 'assinaturaTela',
    send_automatic_email: false,
    send_automatic_whatsapp: false,
  }

  // Contrato (e contrato+recibo mesclado): Adriana primeiro, advogado segundo.
  // Recibo sozinho: apenas advogado.
  const precisaAdriana = tipo === 'contrato' || tipo === 'contrato_recibo'
  const signers = precisaAdriana ? [signerAdriana, signerAdvogado] : [signerAdvogado]

  const zapRes = await fetch('https://api.zapsign.com.br/api/v1/docs/', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiToken}`,
    },
    body: JSON.stringify({
      name: filename,
      lang: 'pt-BR',
      base64_pdf: pdfBase64,
      signers,
      ...(process.env.APP_URL
        ? { webhook_url: `${process.env.APP_URL}/api/zapsign/webhook` }
        : {}),
    }),
  })

  if (!zapRes.ok) {
    const errText = await zapRes.text()
    console.error('[enviar] ZapSign erro:', zapRes.status, errText)
    return NextResponse.json(
      { error: `ZapSign API ${zapRes.status}: ${errText}` },
      { status: 502 },
    )
  }

  const zapData = await zapRes.json()
  // zapData.token  = token do documento
  // zapData.signers = [{ token, name, sign_url, status }]

  const documentToken: string = zapData.token
  const signersList: Array<{ name: string; sign_url: string }> = zapData.signers ?? []

  let linkAdriana: string | undefined
  let linkAdvogado: string

  if (precisaAdriana) {
    linkAdriana = signersList.find((s) => s.name === 'Adriana Rodrigues')?.sign_url ?? signersList[0]?.sign_url
    linkAdvogado = signersList.find((s) => s.name === nomeAdvogado)?.sign_url ?? signersList[1]?.sign_url ?? ''
  } else {
    linkAdvogado = signersList[0]?.sign_url ?? ''
  }

  const result: EnviarZapSignResult = { documentToken, linkAdriana, linkAdvogado }
  return NextResponse.json(result)
}
