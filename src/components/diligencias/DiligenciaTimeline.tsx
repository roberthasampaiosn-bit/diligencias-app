import { CheckCircle2, Circle } from 'lucide-react'
import { Diligencia, StatusDiligencia, StatusPagamento } from '@/types'
import { cn } from '@/lib/utils'

interface Step {
  label: string
  done: boolean
  current: boolean
}

function getSteps(d: Diligencia): Step[] {
  const criada = true
  const advContratado = !!d.advogadoId
  const realizada = d.status === StatusDiligencia.Realizada
  const paga = d.statusPagamento === StatusPagamento.Pago
  const docsConcluidos =
    !!d.anexos.contratoAssinado &&
    !!d.anexos.reciboAssinado &&
    !!d.anexos.comprovantePagamento &&
    !!d.anexos.comprovanteServico

  const steps = [
    { label: 'Criada', done: criada, current: false },
    { label: 'Advogado contratado', done: advContratado, current: !advContratado },
    { label: 'Realizada', done: realizada, current: advContratado && !realizada },
    { label: 'Paga', done: paga, current: realizada && !paga },
    { label: 'Docs concluídos', done: docsConcluidos, current: paga && !docsConcluidos },
  ]

  // marca current apenas no primeiro não-done
  let foundCurrent = false
  return steps.map((s) => {
    if (!s.done && !foundCurrent) {
      foundCurrent = true
      return { ...s, current: true }
    }
    return { ...s, current: false }
  })
}

export function DiligenciaTimeline({ diligencia }: { diligencia: Diligencia }) {
  const steps = getSteps(diligencia)

  return (
    <div className="bg-white border border-slate-200 rounded-xl px-5 py-4">
      <div className="flex items-center justify-between overflow-x-auto gap-1">
        {steps.map((step, i) => (
          <div key={step.label} className="flex items-center flex-1 min-w-0">
            <div className="flex flex-col items-center gap-1 flex-shrink-0">
              <div className={cn(
                'w-7 h-7 rounded-full flex items-center justify-center transition-all',
                step.done
                  ? 'bg-emerald-500'
                  : step.current
                  ? 'bg-blue-600 ring-4 ring-blue-100'
                  : 'bg-slate-200'
              )}>
                {step.done
                  ? <CheckCircle2 className="w-4 h-4 text-white" />
                  : <Circle className={cn('w-3.5 h-3.5', step.current ? 'text-white' : 'text-slate-400')} />
                }
              </div>
              <span className={cn(
                'text-xs text-center leading-tight whitespace-nowrap',
                step.done ? 'text-emerald-700 font-medium'
                  : step.current ? 'text-blue-700 font-semibold'
                  : 'text-slate-400'
              )}>
                {step.label}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div className={cn(
                'flex-1 h-0.5 mx-1 mb-4',
                step.done ? 'bg-emerald-400' : 'bg-slate-200'
              )} />
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
