import webpush from 'web-push'

let configured = false

function ensureConfigured() {
  if (configured) return
  const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
  const priv = process.env.VAPID_PRIVATE_KEY
  const subject = process.env.VAPID_SUBJECT || 'mailto:contato@arodrigues.adv.br'
  if (!pub || !priv) throw new Error('VAPID keys não configuradas (NEXT_PUBLIC_VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY).')
  webpush.setVapidDetails(subject, pub, priv)
  configured = true
}

export interface StoredSubscription {
  endpoint: string
  p256dh: string
  auth: string
}

export interface PushPayload {
  title: string
  body: string
  url?: string
  tag?: string
}

/** Envia uma notificação. gone=true indica inscrição expirada (deve ser removida). */
export async function sendPush(
  sub: StoredSubscription,
  payload: PushPayload,
): Promise<{ ok: boolean; gone?: boolean }> {
  ensureConfigured()
  try {
    await webpush.sendNotification(
      { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
      JSON.stringify(payload),
    )
    return { ok: true }
  } catch (e: unknown) {
    const code = (e as { statusCode?: number })?.statusCode
    if (code === 404 || code === 410) return { ok: false, gone: true }
    console.error('[webpush] erro ao enviar', code, (e as { body?: string })?.body)
    return { ok: false }
  }
}
