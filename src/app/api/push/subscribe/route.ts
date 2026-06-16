import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServiceClient } from '@/lib/supabaseServer'

// POST /api/push/subscribe
// Recebe a PushSubscription do navegador e a guarda em push_subscriptions.
export async function POST(req: NextRequest): Promise<NextResponse> {
  let sub: { endpoint?: string; keys?: { p256dh?: string; auth?: string } }
  try {
    sub = await req.json()
  } catch {
    return NextResponse.json({ error: 'JSON inválido.' }, { status: 400 })
  }

  if (!sub.endpoint || !sub.keys?.p256dh || !sub.keys?.auth) {
    return NextResponse.json({ error: 'Inscrição incompleta.' }, { status: 400 })
  }

  const supabase = createSupabaseServiceClient()
  const { error } = await supabase
    .from('push_subscriptions')
    .upsert(
      {
        endpoint: sub.endpoint,
        p256dh: sub.keys.p256dh,
        auth: sub.keys.auth,
      },
      { onConflict: 'endpoint' },
    )

  if (error) {
    console.error('[push/subscribe]', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}
