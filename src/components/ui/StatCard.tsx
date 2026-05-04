import { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

interface StatCardProps {
  title: string
  value: string | number
  icon: LucideIcon
  color?: 'blue' | 'emerald' | 'amber' | 'red' | 'purple' | 'slate'
  subtitle?: string
  className?: string
}

const colors = {
  blue: { bg: 'bg-blue-50', icon: 'bg-blue-600', text: 'text-blue-600' },
  emerald: { bg: 'bg-emerald-50', icon: 'bg-emerald-600', text: 'text-emerald-600' },
  amber: { bg: 'bg-amber-50', icon: 'bg-amber-500', text: 'text-amber-600' },
  red: { bg: 'bg-red-50', icon: 'bg-red-600', text: 'text-red-600' },
  purple: { bg: 'bg-purple-50', icon: 'bg-purple-600', text: 'text-purple-600' },
  slate: { bg: 'bg-slate-50', icon: 'bg-slate-600', text: 'text-slate-600' },
}

export function StatCard({ title, value, icon: Icon, color = 'blue', subtitle, className }: StatCardProps) {
  const c = colors[color]
  return (
    <div className={cn('bg-white rounded-xl border border-slate-200 shadow-sm p-5', className)}>
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wide truncate">{title}</p>
          <p className="mt-1.5 text-2xl font-bold text-slate-800">{value}</p>
          {subtitle && <p className="mt-0.5 text-xs text-slate-400">{subtitle}</p>}
        </div>
        <div className={cn('flex items-center justify-center w-10 h-10 rounded-lg flex-shrink-0', c.icon)}>
          <Icon className="w-5 h-5 text-white" />
        </div>
      </div>
    </div>
  )
}
