'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { Users, Plus, Phone, MessageCircle, MapPin, DollarSign } from 'lucide-react'
import { useAdvogados } from '@/context/AdvogadosContext'
import { useDiligencias } from '@/context/DiligenciasContext'
import { searchAdvogados } from '@/services/advogadoService'
import { Card, CardHeader, CardBody } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { SearchInput } from '@/components/ui/SearchInput'
import { EmptyState } from '@/components/ui/EmptyState'
import { formatPhone, formatCurrency } from '@/lib/utils'
import { StatusPagamento } from '@/types'

export default function AdvogadosPage() {
  const { advogados } = useAdvogados()
  const { diligencias } = useDiligencias()
  const [search, setSearch] = useState('')

  const lista = useMemo(
    () => searchAdvogados(advogados, search),
    [advogados, search],
  )

  // O(N+M): para cada advogado, busca a diligência paga mais recente
  const ultimoValorPago = useMemo(() => {
    const map = new Map<string, number | null>()
    for (const adv of advogados) map.set(adv.id, null)

    for (const d of diligencias) {
      if (d.statusPagamento !== StatusPagamento.Pago) continue
      const atual = map.get(d.advogadoId)
      // undefined = advogado não está na lista (ignora); null ou valor menor = atualiza
      if (atual === undefined) continue
      // Mantém o valor da diligência mais recente (createdAt como proxy de ordem)
      // Para simplificar: qualquer diligência paga substitui null; se já há um valor,
      // comparamos por createdAt usando o índice da diligência no array (ordem do fetch desc)
      if (atual === null) {
        map.set(d.advogadoId, d.valorDiligencia)
      }
      // As diligências são buscadas em ordem desc (createdAt), então o primeiro que aparecer
      // já é o mais recente — não precisa substituir novamente.
    }
    return map
  }, [advogados, diligencias])

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Advogados</h1>
          <p className="text-sm text-slate-500 mt-0.5">{advogados.length} advogados cadastrados</p>
        </div>
        <Link href="/advogados/novo">
          <Button size="md"><Plus className="w-4 h-4" /> Novo advogado</Button>
        </Link>
      </div>

      <Card>
        <CardHeader>
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="Nome, cidade, telefone, observações..."
            className="sm:w-80"
          />
        </CardHeader>

        {lista.length === 0 ? (
          <EmptyState
            icon={Users}
            title="Nenhum advogado encontrado"
            action={
              <Link href="/advogados/novo">
                <Button size="sm"><Plus className="w-3.5 h-3.5" /> Novo advogado</Button>
              </Link>
            }
          />
        ) : (
          <CardBody className="p-0">

            {/* ── Mobile ── */}
            <div className="sm:hidden divide-y divide-slate-50">
              {lista.map((a) => {
                const ultimoValor = ultimoValorPago.get(a.id)
                const cidadesExtra = a.cidadesAtendidas.filter(
                  (c) => c.toLowerCase() !== a.cidadePrincipal.toLowerCase(),
                )
                return (
                  <Link key={a.id} href={`/advogados/${a.id}`} className="block px-4 py-3.5 hover:bg-slate-50">
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <p className="font-semibold text-slate-800 text-sm">{a.nomeCompleto}</p>
                      <span className={`text-xs font-semibold whitespace-nowrap ${ultimoValor != null ? 'text-emerald-600' : 'text-slate-400'}`}>
                        {ultimoValor != null ? formatCurrency(ultimoValor) : 'Sem histórico'}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-slate-400 mb-1.5">
                      <span className="flex items-center gap-1">
                        <MapPin className="w-3 h-3" />{a.cidadePrincipal}/{a.uf}
                      </span>
                      <span className="flex items-center gap-1">
                        <Phone className="w-3 h-3" />{formatPhone(a.telefone)}
                      </span>
                    </div>
                    {cidadesExtra.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {cidadesExtra.slice(0, 3).map((c) => (
                          <span key={c} className="bg-slate-100 text-slate-500 text-xs px-1.5 py-0.5 rounded">
                            {c}
                          </span>
                        ))}
                        {cidadesExtra.length > 3 && (
                          <span className="bg-slate-100 text-slate-400 text-xs px-1.5 py-0.5 rounded">
                            +{cidadesExtra.length - 3}
                          </span>
                        )}
                      </div>
                    )}
                  </Link>
                )
              })}
            </div>

            {/* ── Desktop ── */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100">
                    {['Nome', 'Cidade principal', 'Cidades atendidas', 'Último valor pago', 'Contato', 'Ação'].map((h) => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {lista.map((a) => {
                    const ultimoValor = ultimoValorPago.get(a.id)
                    const cidadesExtra = a.cidadesAtendidas.filter(
                      (c) => c.toLowerCase() !== a.cidadePrincipal.toLowerCase(),
                    )
                    return (
                      <tr key={a.id} className="hover:bg-slate-50 transition-colors">

                        {/* Nome */}
                        <td className="px-4 py-3">
                          <Link href={`/advogados/${a.id}`} className="font-medium text-slate-800 hover:text-blue-600 hover:underline">
                            {a.nomeCompleto}
                          </Link>
                        </td>

                        {/* Cidade principal */}
                        <td className="px-4 py-3 text-slate-600">
                          <span className="flex items-center gap-1">
                            <MapPin className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                            {a.cidadePrincipal}/{a.uf}
                          </span>
                        </td>

                        {/* Cidades atendidas (sem repetir a principal) */}
                        <td className="px-4 py-3">
                          {cidadesExtra.length === 0 ? (
                            <span className="text-xs text-slate-400">—</span>
                          ) : (
                            <div className="flex flex-wrap gap-1">
                              {cidadesExtra.slice(0, 3).map((c) => (
                                <span key={c} className="bg-slate-100 text-slate-600 text-xs px-1.5 py-0.5 rounded">
                                  {c}
                                </span>
                              ))}
                              {cidadesExtra.length > 3 && (
                                <span className="bg-slate-100 text-slate-400 text-xs px-1.5 py-0.5 rounded">
                                  +{cidadesExtra.length - 3}
                                </span>
                              )}
                            </div>
                          )}
                        </td>

                        {/* Último valor pago */}
                        <td className="px-4 py-3">
                          {ultimoValor != null ? (
                            <span className="inline-flex items-center gap-1 text-sm font-semibold text-emerald-600">
                              <DollarSign className="w-3.5 h-3.5" />
                              {formatCurrency(ultimoValor)}
                            </span>
                          ) : (
                            <span className="text-xs text-slate-400">Sem histórico</span>
                          )}
                        </td>

                        {/* Contato */}
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <a href={`tel:${a.telefone}`} className="text-slate-400 hover:text-blue-600 transition-colors" title="Ligar">
                              <Phone className="w-3.5 h-3.5" />
                            </a>
                            <a href={`https://wa.me/55${a.whatsapp}`} target="_blank" rel="noopener noreferrer" className="text-slate-400 hover:text-green-600 transition-colors" title="WhatsApp">
                              <MessageCircle className="w-3.5 h-3.5" />
                            </a>
                            <span className="text-xs text-slate-500">{formatPhone(a.telefone)}</span>
                          </div>
                        </td>

                        {/* Ação */}
                        <td className="px-4 py-3">
                          <Link href={`/advogados/${a.id}`}>
                            <Button variant="ghost" size="sm">Ver perfil</Button>
                          </Link>
                        </td>

                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

          </CardBody>
        )}
      </Card>
    </div>
  )
}
