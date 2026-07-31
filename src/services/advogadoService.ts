import { Advogado } from '@/types'
import { normalizarBusca } from '@/lib/utils'

// Funções puras — sem estado interno.

export function makeAdvogado(data: Omit<Advogado, 'id' | 'createdAt'>): Advogado {
  return {
    ...data,
    id: `adv-${Date.now()}`,
    createdAt: new Date().toISOString(),
  }
}

export function searchAdvogados(advogados: Advogado[], termo: string): Advogado[] {
  if (!termo.trim()) return advogados
  const q = normalizarBusca(termo)
  const qDigits = q.replace(/\D/g, '')

  const scored = advogados.map((a) => {
    let score = 0
    if (normalizarBusca(a.nomeCompleto).includes(q)) score += 4
    if (normalizarBusca(a.cidadePrincipal).includes(q)) score += 3
    if (a.cidadesAtendidas.some((c) => normalizarBusca(c).includes(q))) score += 3
    if (normalizarBusca(a.observacoes).includes(q)) score += 2
    if (qDigits && a.telefone.replace(/\D/g, '').includes(qDigits)) score += 2
    if (qDigits && a.whatsapp?.replace(/\D/g, '').includes(qDigits)) score += 2
    if (normalizarBusca(a.oab).includes(q)) score += 1
    if (qDigits && a.cpf?.replace(/\D/g, '').includes(qDigits)) score += 1
    return { a, score }
  })

  return scored.filter((x) => x.score > 0).sort((a, b) => b.score - a.score).map((x) => x.a)
}
