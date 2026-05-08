import { Badge } from '@/components/ui/Badge'
import { StatusDiligencia, StatusPagamento, StatusPesquisa, EmpresaCliente } from '@/types'

export function StatusDiligenciaBadge({ status }: { status: StatusDiligencia }) {
  if (status === StatusDiligencia.Realizada) return <Badge variant="success">{status}</Badge>
  return <Badge variant="warning">{status}</Badge>
}

export function StatusPagamentoBadge({ status }: { status: StatusPagamento }) {
  if (status === StatusPagamento.Pago) return <Badge variant="success">{status}</Badge>
  return <Badge variant="slate">{status}</Badge>
}

export function StatusPesquisaBadge({ status }: { status: StatusPesquisa }) {
  if (status === StatusPesquisa.Concluida) return <Badge variant="success">{status}</Badge>
  return <Badge variant="warning">{status}</Badge>
}

export function EmpresaBadge({ empresaCliente }: { empresaCliente: EmpresaCliente | string }) {
  if (empresaCliente === EmpresaCliente.VTAL) {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-bold bg-purple-100 text-purple-700 border border-purple-200">
        V.TAL
      </span>
    )
  }
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-bold bg-blue-100 text-blue-700 border border-blue-200">
      BAT BRASIL
    </span>
  )
}
