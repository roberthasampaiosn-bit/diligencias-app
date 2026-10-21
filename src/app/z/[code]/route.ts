import { NextResponse } from 'next/server'
import { decodeZapSignToken } from '@/services/zapsignService'

// GET /z/<código>
// Link curto de assinatura enviado pelo WhatsApp. Redireciona para a página de
// assinatura do ZapSign. Existe porque o WhatsApp passou a tratar o token do
// ZapSign (um UUID) como "chave Pix aleatória": o link deixava de ser clicável
// e o toque só copiava a "chave Pix". O código aqui não tem formato de UUID.
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ code: string }> },
): Promise<NextResponse> {
  const { code } = await params
  const token = decodeZapSignToken(code)
  if (!token) {
    return new NextResponse('Link de assinatura inválido.', { status: 404 })
  }
  return NextResponse.redirect(`https://app.zapsign.com.br/verificar/${token}`, 302)
}
