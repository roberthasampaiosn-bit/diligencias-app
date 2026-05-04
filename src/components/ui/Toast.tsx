'use client'

import { CheckCircle2, XCircle, Info, X } from 'lucide-react'
import { useToast, Toast, ToastType } from '@/context/ToastContext'

const STYLES: Record<ToastType, { container: string; icon: React.ReactNode }> = {
  success: {
    container: 'bg-emerald-50 border-emerald-200 text-emerald-800',
    icon: <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />,
  },
  error: {
    container: 'bg-red-50 border-red-200 text-red-800',
    icon: <XCircle className="w-4 h-4 text-red-500 flex-shrink-0" />,
  },
  info: {
    container: 'bg-blue-50 border-blue-200 text-blue-800',
    icon: <Info className="w-4 h-4 text-blue-500 flex-shrink-0" />,
  },
}

function ToastItem({ toast }: { toast: Toast }) {
  const { removeToast } = useToast()
  const { container, icon } = STYLES[toast.type]

  return (
    <div className={`flex items-center gap-3 px-4 py-3 rounded-xl border shadow-md text-sm font-medium ${container}`}>
      {icon}
      <span className="flex-1">{toast.message}</span>
      <button
        onClick={() => removeToast(toast.id)}
        className="flex-shrink-0 opacity-60 hover:opacity-100 transition-opacity"
        aria-label="Fechar"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  )
}

export function ToastContainer() {
  const { toasts } = useToast()
  if (toasts.length === 0) return null

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none">
      {toasts.map((t) => (
        <div key={t.id} className="pointer-events-auto">
          <ToastItem toast={t} />
        </div>
      ))}
    </div>
  )
}
