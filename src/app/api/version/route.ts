import { NextResponse } from 'next/server'

// GET /api/version
// Retorna o identificador da versão ATUALMENTE publicada (o deploy mais recente
// em produção). O navegador compara com a versão que ele carregou
// (NEXT_PUBLIC_BUILD_ID embutido no bundle) para saber se saiu versão nova.
//
// Precisa ser SEMPRE dinâmica e sem cache — senão devolveria uma versão velha.
export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET(): Promise<NextResponse> {
  const version =
    process.env.VERCEL_GIT_COMMIT_SHA ||
    process.env.NEXT_PUBLIC_BUILD_ID ||
    'dev'
  return NextResponse.json(
    { version },
    { headers: { 'Cache-Control': 'no-store, max-age=0' } },
  )
}
