import Link from 'next/link'
import { ClipboardList } from 'lucide-react'
import { Diligencia } from '@/types'
import { StatusDiligenciaBadge } from '@/components/shared/StatusBadge'
import { formatCurrency, formatDate } from '@/lib/utils'
import { Card, CardHeader, CardTitle, CardBody } from '@/components/ui/Card'

interface CCCHistoricoProps {
  ccc: string
  diligenciaAtualId: string
  todasDiligencias: Diligencia[]
}

export function CCCHistorico({ ccc, diligenciaAtualId, todasDiligencias }: CCCHistoricoProps) {
  const historico = todasDiligencias.filter(
    (d) => d.ccc === ccc && d.id !== diligenciaAtualId
  )

  if (historico.length === 0) return null

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <ClipboardList className="w-4 h-4 text-slate-400" />
          <CardTitle>Histórico do CCC — {ccc}</CardTitle>
        </div>
      </CardHeader>
      <CardBody className="p-0">
        <ul className="divide-y divide-slate-50">
          {historico.map((d) => (
            <li key={d.id}>
              <Link
                href={`/diligencias/${d.id}`}
                className="flex items-center gap-3 px-5 py-3 hover:bg-slate-50 transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-800 truncate">{d.vitima}</p>
                  <p className="text-xs text-slate-500">{formatDate(d.createdAt)} · {d.tipoDiligencia}</p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <StatusDiligenciaBadge status={d.status} />
                  <span className="text-sm font-semibold text-slate-700">{formatCurrency(d.valorDiligencia)}</span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      </CardBody>
    </Card>
  )
}
