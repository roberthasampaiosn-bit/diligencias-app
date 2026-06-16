'use client'

import { useEffect, useState } from 'react'
import { BellRing, BellOff, Loader2, Share } from 'lucide-react'
import { useToast } from '@/context/ToastContext'
import {
  pushSupported, isStandalone, registerServiceWorker, getPushStatus, enablePush,
} from '@/lib/push'

type State = 'loading' | 'unsupported' | 'needs-install' | 'denied' | 'subscribed' | 'idle'

export function PushButton() {
  const { addToast } = useToast()
  const [state, setState] = useState<State>('loading')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let cancel = false
    ;(async () => {
      if (!pushSupported()) { if (!cancel) setState('unsupported'); return }
      // iOS exige o app instalado na tela inicial para permitir push
      const iOS = /iphone|ipad|ipod/i.test(navigator.userAgent)
      if (iOS && !isStandalone()) { if (!cancel) setState('needs-install'); return }
      await registerServiceWorker()
      const st = await getPushStatus()
      if (!cancel) setState(st === 'unsupported' ? 'unsupported' : st)
    })()
    return () => { cancel = true }
  }, [])

  if (state === 'loading' || state === 'unsupported') return null

  if (state === 'needs-install') {
    return (
      <span
        className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg border border-blue-200 bg-blue-50 text-blue-700"
        title="No iPhone: toque em Compartilhar e em 'Adicionar à Tela de Início' para ativar as notificações"
      >
        <Share className="w-3.5 h-3.5" />
        <span className="hidden sm:inline">Instalar p/ notificar</span>
        <span className="sm:hidden">Instalar</span>
      </span>
    )
  }

  if (state === 'denied') {
    return (
      <span
        className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg border border-slate-200 text-slate-400"
        title="Notificações bloqueadas — reative nas configurações do navegador/app"
      >
        <BellOff className="w-3.5 h-3.5" />
        <span className="hidden sm:inline">Bloqueadas</span>
      </span>
    )
  }

  const subscribed = state === 'subscribed'

  async function handleClick() {
    setBusy(true)
    try {
      const r = await enablePush()
      if (r.ok) {
        setState('subscribed')
        addToast('success', 'Notificações ativadas neste aparelho.')
      } else {
        addToast('error', r.reason ?? 'Não foi possível ativar.')
        const st = await getPushStatus()
        setState(st === 'unsupported' ? 'unsupported' : st)
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <button
      onClick={handleClick}
      disabled={busy || subscribed}
      title={subscribed ? 'Notificações ativas neste aparelho — toque para reativar se parar' : 'Ativar notificações de retorno agendado'}
      className={`inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg border transition-colors disabled:opacity-70 ${
        subscribed
          ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
          : 'border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100'
      }`}
    >
      {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <BellRing className="w-3.5 h-3.5" />}
      <span className="hidden sm:inline">{subscribed ? 'Notificações ativas' : 'Ativar notificações'}</span>
      <span className="sm:hidden">{subscribed ? 'Ativas' : 'Notificar'}</span>
    </button>
  )
}
