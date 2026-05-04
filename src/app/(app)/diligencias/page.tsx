'use client'

import { useState, useMemo, memo, Suspense, useTransition } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { ClipboardList, Plus, MapPin } from 'lucide-react'
import { useDiligencias } from '@/context/DiligenciasContext'
import { useAdvogados } from '@/context/AdvogadosContext'
import { Card, CardHeader, CardBody } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { SearchInput } from '@/components/ui/SearchInput'
import { EmptyState } from '@/components/ui/EmptyState'
import { StatusDiligenciaBadge, StatusPagamentoBadge } from '@/components/shared/StatusBadge'
import { formatCurrency } from '@/lib/utils'
import { Diligencia, StatusDiligencia, ModoDiligencia, Advogado } from '@/types'

// ── Row memoizado ─────────────────────────────────────────────────────────────

const DiligenciaRowDesktop = memo(function DiligenciaRowDesktop({
  d, adv,
}: { d: Diligencia; adv: Advogado | undefined }) {
  const router = useRouter()
  return (
    <tr
      className="hover:bg-slate-50 cursor-pointer transition-colors"
      onClick={() => router.push(`/diligencias/${d.id}`)}
    >
      <td className="px-4 py-3">
        <span className="font-mono text-xs font-semibold text-blue-700">{d.ccc}</span>
      </td>
      <td className="px-4 py-3">
        <p className="font-medium text-slate-800 truncate max-w-[180px]">{d.vitima}</p>
        <p className="text-xs text-slate-400">{d.tipoEvento}</p>
      </td>
      <td className="px-4 py-3 text-slate-600 whitespace-nowrap">{d.cidade}/{d.uf}</td>
      <td className="px-4 py-3">
        <p className="text-slate-600 truncate max-w-[160px]">{adv?.nomeCompleto ?? '—'}</p>
      </td>
      <td className="px-4 py-3 font-semibold text-slate-700 whitespace-nowrap">{formatCurrency(d.valorDiligencia)}</td>
      <td className="px-4 py-3"><StatusDiligenciaBadge status={d.status} /></td>
      <td className="px-4 py-3">
        {d.modoDiligencia === ModoDiligencia.Remoto
          ? <span className="text-xs text-slate-400">—</span>
          : <StatusPagamentoBadge status={d.statusPagamento} />
        }
      </td>
      <td className="px-4 py-3">
        {d.cicloFinalizado
          ? <span className="text-xs text-emerald-600 font-medium">✓ Diligência concluída</span>
          : <span className="text-xs text-slate-400">—</span>
        }
      </td>
    </tr>
  )
})

// ── Page Content ──────────────────────────────────────────────────────────────

function DiligenciasContent() {
  const searchParams = useSearchParams()
  const { diligencias } = useDiligencias()
  const { advogadoMap } = useAdvogados()
  const [, startTransition] = useTransition()
  const [search, setSearch] = useState(searchParams.get('ccc') || '')
  const [filtroStatus, setFiltroStatus] = useState<'todos' | StatusDiligencia>('todos')
  const [filtroModo, setFiltroModo] = useState<'todos' | ModoDiligencia>('todos')

  const lista = useMemo(() => {
    let l = diligencias
    if (filtroStatus !== 'todos') l = l.filter((d) => d.status === filtroStatus)
    if (filtroModo !== 'todos') l = l.filter((d) => d.modoDiligencia === filtroModo)
    if (search) {
      const q = search.toLowerCase()
      l = l.filter(
        (d) =>
          d.ccc.toLowerCase().includes(q) ||
          d.vitima.toLowerCase().includes(q) ||
          d.empresa.toLowerCase().includes(q) ||
          d.cidade.toLowerCase().includes(q)
      )
    }
    return l
  }, [diligencias, search, filtroStatus, filtroModo])

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Diligências</h1>
          <p className="text-sm text-slate-500 mt-0.5">{diligencias.length} diligências cadastradas</p>
        </div>
        <Link href="/diligencias/nova">
          <Button size="md"><Plus className="w-4 h-4" /> Nova diligência</Button>
        </Link>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row gap-3 flex-wrap">
            <SearchInput value={search} onChange={setSearch} placeholder="CCC, vítima, empresa..." className="sm:w-64" />
            <div className="flex gap-1.5 flex-wrap">
              {(['todos', StatusDiligencia.EmAndamento, StatusDiligencia.Realizada] as const).map((f) => (
                <button key={f} onClick={() => startTransition(() => setFiltroStatus(f))}
                  className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${filtroStatus === f ? (f === StatusDiligencia.EmAndamento ? 'bg-amber-500 text-white' : f === StatusDiligencia.Realizada ? 'bg-emerald-600 text-white' : 'bg-blue-600 text-white') : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
                  {f === 'todos' ? 'Todos' : f}
                </button>
              ))}
              <button
                onClick={() => startTransition(() => setFiltroModo(filtroModo === ModoDiligencia.Presencial ? 'todos' : ModoDiligencia.Presencial))}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${filtroModo === ModoDiligencia.Presencial ? 'bg-blue-700 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
                Presencial
              </button>
              <button
                onClick={() => startTransition(() => setFiltroModo(filtroModo === ModoDiligencia.Remoto ? 'todos' : ModoDiligencia.Remoto))}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${filtroModo === ModoDiligencia.Remoto ? 'bg-purple-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
                Remoto
              </button>
            </div>
          </div>
        </CardHeader>

        {lista.length === 0 ? (
          <EmptyState icon={ClipboardList} title="Nenhuma diligência encontrada"
            action={<Link href="/diligencias/nova"><Button size="sm"><Plus className="w-3.5 h-3.5" /> Nova</Button></Link>} />
        ) : (
          <CardBody className="p-0">
            {/* Mobile */}
            <div className="sm:hidden divide-y divide-slate-50">
              {lista.map((d) => (
                <Link key={d.id} href={`/diligencias/${d.id}`} className="block px-4 py-3.5 hover:bg-slate-50">
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <p className="font-semibold text-slate-800 text-sm truncate">{d.vitima}</p>
                    <StatusDiligenciaBadge status={d.status} />
                  </div>
                  <p className="text-xs text-blue-600 font-mono mb-1">{d.ccc}</p>
                  <div className="flex items-center gap-3 text-xs text-slate-500">
                    <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{d.cidade}/{d.uf}</span>
                    <span>{formatCurrency(d.valorDiligencia)}</span>
                  </div>
                  <div className="flex items-center justify-between mt-1.5">
                    <p className="text-xs text-slate-400 truncate">{advogadoMap.get(d.advogadoId)?.nomeCompleto}</p>
                    {d.modoDiligencia === ModoDiligencia.Remoto
                      ? <span className="text-xs text-slate-400">—</span>
                      : <StatusPagamentoBadge status={d.statusPagamento} />
                    }
                  </div>
                </Link>
              ))}
            </div>
            {/* Desktop */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100">
                    {['CCC', 'Vítima', 'Cidade/UF', 'Advogado', 'Valor', 'Status', 'Pagamento', 'Conclusão'].map((h) => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {lista.map((d) => (
                    <DiligenciaRowDesktop key={d.id} d={d} adv={advogadoMap.get(d.advogadoId)} />
                  ))}
                </tbody>
              </table>
            </div>
          </CardBody>
        )}
      </Card>
    </div>
  )
}

export default function DiligenciasPage() {
  return <Suspense><DiligenciasContent /></Suspense>
}
