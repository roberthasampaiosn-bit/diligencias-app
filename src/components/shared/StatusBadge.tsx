import { Badge } from '@/components/ui/Badge'
import { StatusDiligencia, StatusPagamento, StatusPesquisa } from '@/types'

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
