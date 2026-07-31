'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { FileWarning, FileCheck2, ChevronDown, ChevronRight, FileText } from 'lucide-react'
import { Diligencia } from '@/types'
import { documentosFaltando, prontaParaPdfFinal, tituloDiligencia } from '@/lib/utils'

// Data que define o "mês" da pendência: atendimento → evento → criação.
function mesDaDiligencia(d: Diligencia): string {
  return (d.dataAtendimento ?? d.dataEvento ?? d.createdAt ?? '').slice(0, 7) // "YYYY-MM"
}

const MESES_PT = [
  'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
]

function rotuloMes(chave: string): string {
  const [ano, mes] = chave.split('-')
  const nome = MESES_PT[Number(mes) - 1] ?? mes
  return `${nome}/${ano}`
}

const DOC_CURTO: Record<string, string> = {
  'Contrato assinado': 'Contrato',
  'Recibo assinado': 'Recibo',
  'Comprovante de pagamento': 'Comp. pagamento',
  'Comprovante de serviço': 'Comp. serviço',
}

interface ItemPendencia {
  d: Diligencia
  faltam: string[]      // vazio quando é "pronta para PDF"
}

function ListaExpandivel({
  titulo,
  cor,
  Icone,
  itens,
  vazio,
}: {
  titulo: string
  cor: 'amber' | 'blue'
  Icone: typeof FileWarning
  itens: ItemPendencia[]
  vazio: string
}) {
  const [aberto, setAberto] = useState(false)
  const cores = cor === 'amber'
    ? { card: 'bg-amber-50 border-amber-200 hover:bg-amber-100', icon: 'text-amber-600', num: 'text-amber-800', txt: 'text-amber-700' }
    : { card: 'bg-blue-50 border-blue-200 hover:bg-blue-100', icon: 'text-blue-600', num: 'text-blue-800', txt: 'text-blue-700' }

  return (
    <div className={`border rounded-xl overflow-hidden ${cor === 'amber' ? 'border-amber-200' : 'border-blue-200'}`}>
      <button
        onClick={() => setAberto((v) => !v)}
        className={`w-full flex items-center gap-3 p-4 transition-colors ${cores.card}`}
      >
        <Icone className={`w-5 h-5 flex-shrink-0 ${cores.icon}`} />
        <div className="flex-1 text-left">
          <p className={`text-xs font-medium ${cores.txt}`}>{titulo}</p>
          <p className={`text-xl font-bold ${cores.num}`}>{itens.length}</p>
        </div>
        {itens.length > 0 && (aberto
          ? <ChevronDown className={`w-4 h-4 ${cores.icon}`} />
          : <ChevronRight className={`w-4 h-4 ${cores.icon}`} />)}
      </button>

      {aberto && (
        <div className="bg-white divide-y divide-slate-50 max-h-96 overflow-y-auto">
          {itens.length === 0 ? (
            <p className="text-xs text-slate-400 text-center py-4">{vazio}</p>
          ) : (
            itens.map(({ d, faltam }) => (
              <Link
                key={d.id}
                href={`/diligencias/${d.id}`}
                className="block px-4 py-2.5 hover:bg-slate-50 transition-colors"
              >
                <p className="text-sm font-medium text-slate-800">{tituloDiligencia(d)}</p>
                <p className="text-xs text-slate-500">
                  {d.ccc ? `${d.ccc} · ` : ''}{d.cidade}/{d.uf}
                  {faltam.length > 0 && (
                    <span className="text-amber-600">
                      {' · '}falta{faltam.length > 1 ? 'm' : ''}: {faltam.map((x) => DOC_CURTO[x] ?? x).join(', ')}
                    </span>
                  )}
                </p>
              </Link>
            ))
          )}
        </div>
      )}
    </div>
  )
}

export function PendenciasDocumentais({ diligencias }: { diligencias: Diligencia[] }) {
  // Meses que têm alguma pendência documental (faltando ou pronta-sem-PDF).
  const { porMes, mesesOrdenados } = useMemo(() => {
    const porMes = new Map<string, { faltam: ItemPendencia[]; prontas: ItemPendencia[] }>()
    for (const d of diligencias) {
      const faltam = documentosFaltando(d)
      const pronta = prontaParaPdfFinal(d)
      if (faltam.length === 0 && !pronta) continue
      const mes = mesDaDiligencia(d)
      if (!mes) continue
      if (!porMes.has(mes)) porMes.set(mes, { faltam: [], prontas: [] })
      const grupo = porMes.get(mes)!
      if (faltam.length > 0) grupo.faltam.push({ d, faltam })
      else grupo.prontas.push({ d, faltam: [] })
    }
    const mesesOrdenados = Array.from(porMes.keys()).sort((a, b) => b.localeCompare(a)) // recente primeiro
    return { porMes, mesesOrdenados }
  }, [diligencias])

  // Mês selecionado: mês atual se tiver pendência, senão o mais recente que tiver.
  const mesAtual = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`
  const mesPadrao = mesesOrdenados.includes(mesAtual) ? mesAtual : mesesOrdenados[0]
  const [mesSel, setMesSel] = useState<string>(mesPadrao ?? mesAtual)

  const grupo = porMes.get(mesSel) ?? { faltam: [], prontas: [] }
  const total = grupo.faltam.length + grupo.prontas.length

  // Ordena cada lista por data mais recente primeiro.
  const faltam = [...grupo.faltam].sort((a, b) => mesDaDiligencia(b.d).localeCompare(mesDaDiligencia(a.d)))
  const prontas = [...grupo.prontas].sort((a, b) => mesDaDiligencia(b.d).localeCompare(mesDaDiligencia(a.d)))

  return (
    <div>
      <div className="flex items-center gap-3 mb-3 flex-wrap">
        <h2 className="text-sm font-semibold text-slate-700 flex items-center gap-1.5">
          <FileText className="w-4 h-4 text-blue-500" /> Pendências de documentos
        </h2>
        {mesesOrdenados.length > 0 && (
          <select
            value={mesSel}
            onChange={(e) => setMesSel(e.target.value)}
            className="text-xs border border-slate-200 rounded-lg px-2 py-1.5 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-200 capitalize"
          >
            {mesesOrdenados.map((m) => (
              <option key={m} value={m}>{rotuloMes(m)}</option>
            ))}
          </select>
        )}
      </div>

      {mesesOrdenados.length === 0 || total === 0 ? (
        <div className="border border-slate-200 rounded-xl p-4 bg-slate-50 text-center">
          <p className="text-sm text-slate-500">
            {mesesOrdenados.length === 0
              ? 'Nenhuma pendência de documentos. Tudo em dia! 🎉'
              : `Nenhuma pendência em ${rotuloMes(mesSel)}.`}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <ListaExpandivel
            titulo="Faltam documentos"
            cor="amber"
            Icone={FileWarning}
            itens={faltam}
            vazio="Nenhuma neste mês."
          />
          <ListaExpandivel
            titulo="Prontas para o PDF final"
            cor="blue"
            Icone={FileCheck2}
            itens={prontas}
            vazio="Nenhuma neste mês."
          />
        </div>
      )}
    </div>
  )
}
