'use client'

import { useState, useRef, useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { AlertCircle, Loader2, RefreshCw, X } from 'lucide-react'
import { Sidebar } from './Sidebar'
import { Topbar } from './Topbar'
import { ScrollButtons } from './ScrollButtons'
import { useDbStatus } from '@/context/AppContext'
import { ToastContainer } from '@/components/ui/Toast'
import { markAppEntry } from '@/lib/appHistory'

// Restaura a posição de scroll do container principal ao voltar para uma tela.
// O scroll fica no <main overflow-y-auto> (não na janela), então o Next não
// restaura sozinho — guardamos o scrollTop por rota no sessionStorage.
function useMainScrollRestoration(ref: React.RefObject<HTMLElement | null>) {
  const pathname = usePathname()
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const key = 'scroll:' + pathname
    let restoring = true // enquanto restaura, não grava (evita zerar o valor salvo)
    let raf = 0

    const onScroll = () => {
      if (restoring) return
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(() => {
        try { sessionStorage.setItem(key, String(el.scrollTop)) } catch { /* ignore */ }
      })
    }
    el.addEventListener('scroll', onScroll, { passive: true })

    let saved = 0
    try { saved = Number(sessionStorage.getItem(key)) || 0 } catch { /* ignore */ }
    // Tenta por um curto período porque a altura da lista pode crescer conforme
    // ela renderiza (dados vêm do contexto, geralmente já em cache ao voltar).
    const start = performance.now()
    const step = () => {
      el.scrollTop = saved
      if (performance.now() - start < 400 && Math.abs(el.scrollTop - saved) > 1) {
        requestAnimationFrame(step)
      } else {
        restoring = false
      }
    }
    requestAnimationFrame(step)

    return () => {
      el.removeEventListener('scroll', onScroll)
      cancelAnimationFrame(raf)
    }
  }, [ref, pathname])
}

interface AppShellProps {
  children: React.ReactNode
  title?: string
}

export function AppShell({ children, title }: AppShellProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const mainRef = useRef<HTMLElement>(null)
  const { loading, error, refetch } = useDbStatus()
  const [dismissedError, setDismissedError] = useState<string | null>(null)

  // Marca a entrada no app (uma vez) para o "Voltar" saber quando há histórico
  // interno, e restaura o scroll do <main> ao navegar entre telas.
  useEffect(() => { markAppEntry() }, [])
  useMainScrollRestoration(mainRef)

  const showError = !!error && error !== dismissedError

  return (
    <div className="flex h-full bg-slate-50">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <Topbar onMenuClick={() => setSidebarOpen(true)} />

        {showError && (
          <div className="flex items-center gap-3 bg-red-50 border-b border-red-200 px-4 py-2.5 text-sm text-red-700">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span className="flex-1">{error}</span>
            <button
              onClick={() => { setDismissedError(null); refetch() }}
              className="flex-shrink-0 inline-flex items-center gap-1 rounded-md border border-red-300 bg-white/70 px-2 py-1 font-medium hover:bg-white hover:text-red-900"
            >
              <RefreshCw className="w-3.5 h-3.5" /> Tentar novamente
            </button>
            <button
              onClick={() => setDismissedError(error)}
              className="flex-shrink-0 hover:text-red-900"
              aria-label="Fechar"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        <main ref={mainRef} className="flex-1 overflow-y-auto p-4 lg:p-6 relative">
          {loading ? (
            <div className="flex items-center justify-center py-32">
              <div className="flex flex-col items-center gap-3 text-slate-400">
                <Loader2 className="w-8 h-8 animate-spin" />
                <span className="text-sm">Carregando...</span>
              </div>
            </div>
          ) : (
            children
          )}
        </main>
      </div>

      <ScrollButtons targetRef={mainRef} />
      <ToastContainer />
    </div>
  )
}
