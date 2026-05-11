'use client'

import { memo } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  LayoutDashboard, FileSearch, ClipboardList, Users,
  DollarSign, MessageSquare, FileText, Scale, X, BarChart3, CarFront, LogOut,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuth } from '@/context/AuthContext'

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/triagem', label: 'Triagem', icon: FileSearch },
  { href: '/diligencias', label: 'Diligências', icon: ClipboardList },
  { href: '/advogados', label: 'Advogados', icon: Users },
  { href: '/financeiro', label: 'Financeiro', icon: DollarSign },
  { href: '/pesquisa', label: 'Pesquisa', icon: MessageSquare },
  { href: '/documentos', label: 'Documentos', icon: FileText },
  { href: '/relatorios', label: 'Relatórios', icon: BarChart3 },
  { href: '/consulta-placas', label: 'Consulta de Placas', icon: CarFront },
]

interface SidebarProps {
  open: boolean
  onClose: () => void
}

export const Sidebar = memo(function Sidebar({ open, onClose }: SidebarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const { user, signOut } = useAuth()

  async function handleSignOut() {
    await signOut()
    router.replace('/login')
  }

  const userEmail = user?.email ?? ''
  const userName = userEmail.split('@')[0].split('.')[0]
  const displayName = userName.charAt(0).toUpperCase() + userName.slice(1)

  return (
    <>
      {open && (
        <div className="fixed inset-0 z-20 bg-black/40 lg:hidden" onClick={onClose} />
      )}

      <aside
        className={cn(
          'fixed top-0 left-0 z-30 h-full w-64 bg-slate-900 flex flex-col transition-transform duration-300',
          'lg:translate-x-0 lg:static lg:z-auto',
          open ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-700">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-8 h-8 bg-blue-600 rounded-lg">
              <Scale className="w-4 h-4 text-white" />
            </div>
            <div>
              <p className="text-white font-semibold text-sm leading-tight">ARodrigues</p>
            </div>
          </div>
          <button onClick={onClose} className="lg:hidden text-slate-400 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <nav className="flex-1 px-3 py-4 overflow-y-auto">
          <ul className="space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon
              const active = pathname === item.href || pathname.startsWith(item.href + '/')
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={onClose}
                    className={cn(
                      'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all',
                      active
                        ? 'bg-blue-600 text-white'
                        : 'text-slate-400 hover:text-white hover:bg-slate-800'
                    )}
                  >
                    <Icon className="w-4 h-4 flex-shrink-0" />
                    {item.label}
                  </Link>
                </li>
              )
            })}
          </ul>
        </nav>

        <div className="px-4 py-4 border-t border-slate-700 space-y-3">
          <div className="flex items-center gap-3 px-2">
            <div className="w-7 h-7 rounded-full bg-blue-600 flex items-center justify-center flex-shrink-0">
              <span className="text-white text-xs font-bold">{displayName.charAt(0)}</span>
            </div>
            <div className="min-w-0">
              <p className="text-slate-200 text-sm font-medium truncate">{displayName}</p>
              <p className="text-slate-500 text-xs truncate">{userEmail}</p>
            </div>
          </div>
          <button
            onClick={handleSignOut}
            className="flex items-center gap-2 w-full px-3 py-2 rounded-lg text-sm text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <LogOut className="w-4 h-4" /> Sair
          </button>
        </div>
      </aside>
    </>
  )
})
