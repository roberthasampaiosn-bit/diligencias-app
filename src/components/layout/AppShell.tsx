'use client'

import { useState } from 'react'
import { AlertCircle, Loader2, X } from 'lucide-react'
import { Sidebar } from './Sidebar'
import { Topbar } from './Topbar'
import { useDbStatus } from '@/context/AppContext'
import { ToastContainer } from '@/components/ui/Toast'

interface AppShellProps {
  children: React.ReactNode
  title?: string
}

export function AppShell({ children, title }: AppShellProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const { loading, error } = useDbStatus()
  const [dismissedError, setDismissedError] = useState<string | null>(null)

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
              onClick={() => setDismissedError(error)}
              className="flex-shrink-0 hover:text-red-900"
              aria-label="Fechar"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        <main className="flex-1 overflow-y-auto p-4 lg:p-6 relative">
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

      <ToastContainer />
    </div>
  )
}
