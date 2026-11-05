'use client'

import { Star } from 'lucide-react'
import { Textarea } from '@/components/ui/Textarea'

export const NOTA_LABELS: Record<number, string> = {
  1: 'Ruim',
  2: 'Regular',
  3: 'Bom',
  4: 'Muito bom',
  5: 'Excelente',
}

export type NotaAdvogado = 1 | 2 | 3 | 4 | 5

// Campos da avaliação do advogado (nota, observação, contrataria novamente).
// Usado ao finalizar o ciclo e na fila "Avaliações para a Anne" do Dashboard.
export function AvaliacaoAdvogadoCampos({
  nota, setNota, obs, setObs, contratar, setContratar,
}: {
  nota: NotaAdvogado | null
  setNota: (n: NotaAdvogado) => void
  obs: string
  setObs: (v: string) => void
  contratar: boolean | undefined
  setContratar: (v: boolean | undefined) => void
}) {
  return (
    <>
      {/* Nota */}
      <div>
        <p className="text-xs font-semibold text-slate-700 mb-2">
          Nota do advogado <span className="text-red-500">*</span>
        </p>
        <div className="flex gap-2">
          {([1, 2, 3, 4, 5] as const).map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setNota(n)}
              className={`flex-1 flex flex-col items-center gap-1 py-2 rounded-xl border text-xs font-medium transition-colors ${
                nota === n
                  ? 'border-amber-400 bg-amber-50 text-amber-800'
                  : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300'
              }`}
            >
              <Star className={`w-5 h-5 ${nota !== null && n <= nota ? 'fill-amber-400 text-amber-400' : 'text-slate-300'}`} />
              {n}
            </button>
          ))}
        </div>
        {nota && (
          <p className="text-xs text-amber-700 mt-1.5 text-center font-medium">{NOTA_LABELS[nota]}</p>
        )}
      </div>

      {/* Observação */}
      <Textarea
        label="Observação"
        value={obs}
        onChange={(e) => setObs(e.target.value)}
        placeholder="Pontualidade, qualidade do serviço, comunicação..."
        rows={3}
      />

      {/* Contrataria novamente */}
      <div>
        <p className="text-xs font-semibold text-slate-700 mb-2">Contrataria novamente? <span className="text-slate-400">(opcional)</span></p>
        <div className="flex gap-2">
          {[
            { value: true, label: 'Sim' },
            { value: false, label: 'Não' },
          ].map((op) => (
            <button
              key={String(op.value)}
              type="button"
              onClick={() => setContratar(contratar === op.value ? undefined : op.value)}
              className={`flex-1 py-2 rounded-xl border text-sm font-medium transition-colors ${
                contratar === op.value
                  ? op.value ? 'border-emerald-400 bg-emerald-50 text-emerald-800' : 'border-red-300 bg-red-50 text-red-800'
                  : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300'
              }`}
            >
              {op.label}
            </button>
          ))}
        </div>
      </div>
    </>
  )
}
