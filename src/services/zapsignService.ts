// ─── ZapSign — Assinatura Digital ────────────────────────────────────────────
// Documentação da API: https://app.zapsign.com.br/docs
// Variáveis de ambiente necessárias (não configuradas — placeholders):
//   NEXT_PUBLIC_ZAPSIGN_API_TOKEN
//   NEXT_PUBLIC_ZAPSIGN_EMAIL_ADRIANA
//   NEXT_PUBLIC_ZAPSIGN_TELEFONE_ADRIANA

// ─── Tipos ───────────────────────────────────────────────────────────────────

export interface ZapSignSigner {
  name: string
  email: string
  phone_country: string
  phone_number: string
  auth_mode: 'assinaturaTela' | 'tokenEmail' | 'tokenSms'
  send_automatic_email: boolean
  send_automatic_whatsapp: boolean
}

export interface ZapSignCreatePayload {
  name: string
  lang: 'pt-BR' | 'en'
  signers: ZapSignSigner[]
  // Na implementação real: fornecer um dos dois abaixo:
  // base64_pdf?: string   // PDF em base64
  // url_pdf?: string      // URL pública do PDF
}

export interface ZapSignSignerResponse {
  token: string
  name: string
  sign_url: string
  status: 'pending' | 'signed'
}

export interface ZapSignResponse {
  token: string
  name: string
  status: string
  signers: ZapSignSignerResponse[]
}

// ─── Webhook (estrutura para implementação futura) ────────────────────────────
// Endpoint a criar: POST /api/zapsign/webhook
// Configurar URL no painel ZapSign: https://app.zapsign.com.br > Configurações > Webhooks
// Verificar autenticidade via token no header Authorization

export type ZapSignWebhookEvent =
  | 'doc_signed'      // todos os signatários assinaram
  | 'doc_completed'   // documento finalizado
  | 'signer_signed'   // um signatário específico assinou

export interface ZapSignWebhookPayload {
  event_type: ZapSignWebhookEvent
  document: { token: string; name: string; status: string }
  signer?: { token: string; name: string; sign_url: string }
}

// Stub — implementar em /src/app/api/zapsign/webhook/route.ts
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function processWebhookEvent(_payload: ZapSignWebhookPayload): void {
  // TODO: ao receber 'doc_completed', atualizar anexo contratoAssinado / reciboAssinado
  //       usando patchAnexo(diligenciaId, 'contratoAssinado', url_do_documento)
}

// ─── Signatária fixa: Ana Rodrigues Advocacia (contratante) ──────────────────

export const SIGNER_ADRIANA: ZapSignSigner = {
  name: 'Ana Rodrigues',
  email: process.env.NEXT_PUBLIC_ZAPSIGN_EMAIL_ADRIANA ?? 'PLACEHOLDER_EMAIL_ADRIANA@email.com',
  phone_country: '55',
  phone_number: process.env.NEXT_PUBLIC_ZAPSIGN_TELEFONE_ADRIANA ?? '11999999999',
  auth_mode: 'assinaturaTela',
  send_automatic_email: false,
  send_automatic_whatsapp: false,
}

// ─── Builder: signatário a partir dos dados do advogado ──────────────────────

export function buildSignerAdvogado(advogado: {
  nomeCompleto: string
  telefone: string
  whatsapp?: string
}): ZapSignSigner {
  return {
    name: advogado.nomeCompleto,
    // Email do advogado não está no cadastro atual — placeholder até o campo ser adicionado
    email: 'PLACEHOLDER_EMAIL_ADVOGADO@email.com',
    phone_country: '55',
    phone_number: (advogado.whatsapp || advogado.telefone).replace(/\D/g, ''),
    auth_mode: 'assinaturaTela',
    send_automatic_email: false,
    send_automatic_whatsapp: false,
  }
}

// ─── sendToZapSign — REMOVIDO ─────────────────────────────────────────────────
// Não usar esta função. O envio à API ZapSign é feito server-side pela rota:
//   POST /api/zapsign/enviar
// Usar diretamente em componentes client-side exporia o ZAPSIGN_API_TOKEN.
//
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function sendToZapSign(
  _filename: string,
  _signers: ZapSignSigner[],
): Promise<ZapSignResponse> {
  throw new Error(
    '[ZapSign] sendToZapSign não deve ser chamado no cliente. ' +
    'Use POST /api/zapsign/enviar para enviar documentos à API ZapSign.',
  )
}

// ─── Helper: extrai link de assinatura do advogado na resposta ───────────────

export function getAdvogadoSignUrl(
  response: ZapSignResponse,
  advogadoName: string,
): string {
  const signer = response.signers.find((s) => s.name === advogadoName)
  // Fallback: último signatário (assumindo ordem: Adriana primeiro, advogado depois)
  return signer?.sign_url ?? response.signers.at(-1)?.sign_url ?? ''
}

// ─── Helper: monta URL do WhatsApp para o advogado ───────────────────────────

export function buildWhatsAppZapSign(
  whatsapp: string | undefined,
  nomeAdvogado: string,
  ccc: string,
  tipoDoc: 'contrato' | 'recibo',
  signUrl: string,
): string {
  const primeiro = nomeAdvogado.split(' ')[0]
  const msg = `Olá ${primeiro}, segue o link para assinatura do ${tipoDoc} referente à diligência ${ccc}:\n${signUrl}`
  const numero = (whatsapp ?? '').replace(/\D/g, '')
  return `https://wa.me/55${numero}?text=${encodeURIComponent(msg)}`
}

// ─── Helper: monta URL do WhatsApp para Adriana (contratante) ────────────────

export function buildWhatsAppAdriana(
  ccc: string,
  tipoDoc: 'contrato' | 'recibo',
  signUrl: string,
): string {
  const telefone = (
    process.env.NEXT_PUBLIC_ZAPSIGN_TELEFONE_ADRIANA ?? ''
  ).replace(/\D/g, '')
  const msg = `Adriana, segue o link para assinatura do ${tipoDoc} referente à diligência ${ccc}:\n${signUrl}`
  return `https://wa.me/55${telefone}?text=${encodeURIComponent(msg)}`
}
