'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { Star, ChevronDown, ChevronRight, ExternalLink } from 'lucide-react'
import { Diligencia } from '@/types'
import { useAdvogados } from '@/context/AdvogadosContext'
import { useDiligencias } from '@/context/DiligenciasContext'
import { useToast } from '@/context/ToastContext'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { EmpresaBadge } from '@/components/shared/StatusBadge'
import { AvaliacaoAdvogadoCampos, NotaAdvogado } from '@/components/diligencias/AvaliacaoAdvogadoCampos'
import { formatDate, tituloDiligencia } from '@/lib/utils'

// Data da diligência para dar contexto: atendimento → evento → criação.
function dataDaDiligencia(d: Diligencia): string {
  return d.dataAtendimento ?? d.dataEvento ?? d.createdAt?.split('T')[0] ?? ''
}

// Fila "Avaliações para a Anne": ciclos finalizados com "A Anne vai avaliar".
// Só aparece quando há alguma pendente.
export function AvaliacoesAnne({ diligencias }: { diligencias: Diligencia[] }) {
  const { advogadoMap } = useAdvogados()
  const { updateDiligencia } = useDiligencias()
  const { addToast } = useToast()
  const [aberto, setAberto] = useState(false)

  const [alvo, setAlvo] = useState<Diligencia | null>(null)
  const [nota, setNota] = useState<NotaAdvogado | null>(null)
  const [obs, setObs] = useState('')
  const [contratar, setContratar] = useState<boolean | undefined>(undefined)
  const [salvando, setSalvando] = useState(false)

  const pendentes = useMemo(
    () => diligencias
      .filter((d) => d.avaliacaoPendenteAnne && !d.avaliacao)
      .sort((a, b) => dataDaDiligencia(a).localeCompare(dataDaDiligencia(b))), // mais antiga primeiro
    [diligencias],
  )

  if (pendentes.length === 0) return null

  const nomeAdv = (d: Diligencia) => advogadoMap.get(d.advogadoId)?.nomeCompleto || 'Advogado não definido'

  function abrir(d: Diligencia) {
    setAlvo(d); setNota(null); setObs(''); setContratar(undefined)
  }

  async function salvar() {
    if (!alvo || !nota) return
    setSalvando(true)
    try {
      await updateDiligencia(alvo.id, {
        avaliacao: { nota, observacao: obs.trim() || undefined, contratariaNovamente: contratar },
        avaliacaoPendenteAnne: false,
      })
      addToast('success', 'Avaliação salva.')
      setAlvo(null)
    } catch {
      // updateDiligencia já mostra o erro
    } finally {
      setSalvando(false)
    }
  }

  return (
    <div>
      <div className="border border-amber-200 rounded-xl overflow-hidden">
        <button
          onClick={() => setAberto((v) => !v)}
          className="w-full flex items-center gap-3 p-4 bg-amber-50 hover:bg-amber-100 transition-colors"
        >
          <Star className="w-5 h-5 flex-shrink-0 text-amber-500 fill-amber-400" />
          <div className="flex-1 text-left">
            <p className="text-xs font-medium text-amber-700">Avaliações para a Anne</p>
            <p className="text-xl font-bold text-amber-800">{pendentes.length}</p>
          </div>
          {aberto
            ? <ChevronDown className="w-4 h-4 text-amber-600" />
            : <ChevronRight className="w-4 h-4 text-amber-600" />}
        </button>

        {aberto && (
          <ul className="bg-white divide-y divide-slate-100 max-h-[28rem] overflow-y-auto">
            {pendentes.map((d) => (
              <li key={d.id} className="flex items-center gap-3 px-4 py-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-800 truncate">{nomeAdv(d)}</p>
                  <p className="text-xs text-slate-500 truncate">
                    {d.ccc ? `CCC ${d.ccc} · ` : ''}{d.cidade}{d.uf ? `/${d.uf}` : ''}
                    {dataDaDiligencia(d) && ` · ${formatDate(dataDaDiligencia(d))}`}
                  </p>
                </div>
                <EmpresaBadge empresaCliente={d.empresaCliente} />
                <Button size="sm" variant="primary" onClick={() => abrir(d)}>
                  <Star className="w-3.5 h-3.5" /> Avaliar
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <Modal open={!!alvo} onClose={() => setAlvo(null)} title="Avaliar advogado" size="md">
        {alvo && (
          <div className="p-5 space-y-5">
            {/* Contexto para lembrar de qual diligência é */}
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-1">
              <div className="flex items-center gap-2">
                <p className="text-sm font-semibold text-slate-800 flex-1 min-w-0 truncate">{nomeAdv(alvo)}</p>
                <EmpresaBadge empresaCliente={alvo.empresaCliente} />
              </div>
              <p className="text-xs text-slate-600">
                {alvo.ccc && <><strong>CCC {alvo.ccc}</strong> · </>}
                {alvo.cidade}{alvo.uf ? `/${alvo.uf}` : ''}
                {dataDaDiligencia(alvo) && <> · {formatDate(dataDaDiligencia(alvo))}</>}
              </p>
              {tituloDiligencia(alvo) && (
                <p className="text-xs text-slate-500 truncate">{tituloDiligencia(alvo)}{alvo.tipoDiligencia ? ` · ${alvo.tipoDiligencia}` : ''}</p>
              )}
              <Link
                href={`/diligencias/${alvo.id}`}
                className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline pt-0.5"
              >
                <ExternalLink className="w-3 h-3" /> Abrir diligência
              </Link>
            </div>

            <AvaliacaoAdvogadoCampos
              nota={nota} setNota={setNota}
              obs={obs} setObs={setObs}
              contratar={contratar} setContratar={setContratar}
            />

            <div className="flex gap-2 justify-end pt-1">
              <Button variant="secondary" size="sm" onClick={() => setAlvo(null)}>Cancelar</Button>
              <Button variant="success" size="sm" onClick={salvar} disabled={!nota || salvando}>
                {salvando ? 'Salvando...' : 'Salvar avaliação'}
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
