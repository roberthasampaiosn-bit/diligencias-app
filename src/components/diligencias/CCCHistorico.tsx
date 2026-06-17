import Link from 'next/link'
import { ClipboardList } from 'lucide-react'
import { Diligencia, EmpresaCliente } from '@/types'
import { StatusDiligenciaBadge } from '@/components/shared/StatusBadge'
import { formatCurrency, formatDate, tituloDiligencia } from '@/lib/utils'
import { Card, CardHeader, CardTitle, CardBody } from '@/components/ui/Card'

interface CCCHistoricoProps {
  ccc: string
  diligenciaAtualId: string
  todasDiligencias: Diligencia[]
}

export function CCCHistorico({ ccc, diligenciaAtualId, todasDiligencias }: CCCHistoricoProps) {
  // Só agrupa quando há um identificador real. CCC/Nº de processo vazio NÃO agrupa
  // — caso contrário todas as V.TAL (que chegam com CCC em branco) apareceriam
  // como histórico umas das outras, mesmo sendo eventos distintos.
  const cccTrim = ccc?.trim() ?? ''
  if (!cccTrim) return null

  // Mantém o histórico dentro do mesmo cliente (não mistura BAT com V.TAL).
  const atual = todasDiligencias.find((d) => d.id === diligenciaAtualId)
  const historico = todasDiligencias.filter(
    (d) =>
      d.id !== diligenciaAtualId &&
      (d.ccc?.trim() ?? '') === cccTrim &&
      (!atual || d.empresaCliente === atual.empresaCliente)
  )

  if (historico.length === 0) return null

  const ehVtal = atual?.empresaCliente === EmpresaCliente.VTAL
  const rotulo = ehVtal ? 'Histórico do processo' : 'Histórico do CCC'

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <ClipboardList className="w-4 h-4 text-slate-400" />
          <CardTitle>{rotulo} — {cccTrim}</CardTitle>
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
                  <p className="text-sm font-medium text-slate-800 truncate">{tituloDiligencia(d)}</p>
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
