'use client'

import { useRouter } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { canGoBackInApp } from '@/lib/appHistory'

interface BotaoVoltarProps {
  // Rota usada quando NÃO há histórico interno para voltar (link aberto direto,
  // PWA vindo de uma notificação, aba nova, reload na tela de detalhe).
  fallback: string
  // Texto opcional ao lado da seta (ex.: "Voltar"). Sem isso, fica só a seta.
  label?: string
  size?: 'sm' | 'md' | 'lg'
  variant?: 'ghost' | 'secondary'
  className?: string
}

// Seta de "Voltar" que retorna para a tela de ONDE o usuário veio (Dashboard,
// Triagem, Histórico, busca...), e não para uma lista fixa. Cai no `fallback`
// só quando não há histórico interno.
export function BotaoVoltar({ fallback, label, size = 'sm', variant = 'ghost', className }: BotaoVoltarProps) {
  const router = useRouter()

  function voltar() {
    if (canGoBackInApp()) router.back()
    else router.push(fallback)
  }

  return (
    <Button type="button" variant={variant} size={size} onClick={voltar} className={className} aria-label="Voltar">
      <ArrowLeft className={label ? 'w-3.5 h-3.5' : 'w-4 h-4'} />{label}
    </Button>
  )
}
