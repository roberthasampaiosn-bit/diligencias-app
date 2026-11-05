'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { ChevronLeft, ChevronRight, CopyPlus, ExternalLink, Sheet, Target } from 'lucide-react'
import { useDiligencias } from '@/context/DiligenciasContext'
import { useAdvogados } from '@/context/AdvogadosContext'
import { Card, CardBody } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { DuplicarDiligenciaModal } from '@/components/diligencias/DuplicarDiligenciaModal'
import { formatCurrency, formatDate, cn } from '@/lib/utils'
import { Diligencia, EmpresaCliente } from '@/types'

// "Planilha do mês": as mesmas linhas que vão para a planilha oficial de cada
// cliente, dentro do app — para a equipe parar de manter planilha manual.
// BAT: linhas com custo (valor > 0) OU marcadas "incluir na planilha" (0,00) —
// mesma regra do export de Relatórios. V.TAL: todas as diligências V.TAL.

const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']

function mesAtual(): string {
  const n = new Date()
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}`
}
function somaMes(ym: string, delta: number): string {
  const [y, m] = ym.split('-').map(Number)
  const d = new Date(y, m - 1 + delta, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}
const dataDe = (d: Diligencia) => d.dataAtendimento ?? d.createdAt.split('T')[0]

// Meta do mês fica no navegador de quem usa (conveniência; não é dado oficial)
function lerMeta(ym: string): string {
  try { return localStorage.getItem(`meta-planilha-bat-${ym}`) ?? '' } catch { return '' }
}
function gravarMeta(ym: string, v: string) {
  try { localStorage.setItem(`meta-planilha-bat-${ym}`, v) } catch { /* sem storage */ }
}

export default function PlanilhaPage() {
  const { diligencias } = useDiligencias()
  const { advogadoMap } = useAdvogados()
  const [mes, setMes] = useState(mesAtual)
  const [cliente, setCliente] = useState<EmpresaCliente>(EmpresaCliente.BatBrasil)
  const [duplicando, setDuplicando] = useState<Diligencia | null>(null)
  const [meta, setMeta] = useState(() => lerMeta(mesAtual()))
  function irParaMes(delta: number) {
    const novo = somaMes(mes, delta)
    setMes(novo)
    setMeta(lerMeta(novo))
  }

  const linhas = useMemo(() => {
    return diligencias
      .filter((d) => !d.incompleta && d.empresaCliente === cliente && dataDe(d).startsWith(mes))
      .filter((d) => cliente === EmpresaCliente.VTAL || (d.valorDiligencia ?? 0) > 0 || d.incluirNaPlanilha)
      .sort((a, b) => dataDe(a).localeCompare(dataDe(b)) || (a.ccc || '').localeCompare(b.ccc || ''))
  }, [diligencias, cliente, mes])

  // BAT fora da planilha (valor 0 e sem "incluir") — ex.: Fadel e suporte remoto
  const foraDaPlanilha = useMemo(() => cliente === EmpresaCliente.VTAL ? 0 : diligencias.filter((d) =>
    !d.incompleta && d.empresaCliente === cliente && dataDe(d).startsWith(mes) &&
    !((d.valorDiligencia ?? 0) > 0 || d.incluirNaPlanilha)).length, [diligencias, cliente, mes])

  const comValor = linhas.filter((d) => (d.valorDiligencia ?? 0) > 0)
  const total = comValor.reduce((s, d) => s + (d.valorDiligencia ?? 0), 0)
  const metaN = parseInt(meta) || 0
  const faltam = Math.max(0, metaN - linhas.length)
  const [ano, mm] = mes.split('-')
  const advNome = (id: string) => advogadoMap.get(id)?.nomeCompleto ?? '—'

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2"><Sheet className="w-5 h-5" /> Planilha do mês</h1>
          <p className="text-sm text-slate-500 mt-0.5">As linhas que vão para a planilha oficial do cliente</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" onClick={() => irParaMes(-1)} aria-label="Mês anterior"><ChevronLeft className="w-4 h-4" /></Button>
          <span className="text-sm font-semibold text-slate-700 w-32 text-center">{MESES[Number(mm) - 1]} {ano}</span>
          <Button variant="secondary" size="sm" onClick={() => irParaMes(1)} aria-label="Próximo mês"><ChevronRight className="w-4 h-4" /></Button>
        </div>
      </div>

      <div className="flex gap-2">
        {[EmpresaCliente.BatBrasil, EmpresaCliente.VTAL].map((c) => (
          <button key={c} onClick={() => setCliente(c)}
            className={cn('px-4 py-1.5 rounded-full text-sm font-medium border',
              cliente === c ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50')}>
            {c === EmpresaCliente.BatBrasil ? 'BAT (Souza Cruz)' : 'V.TAL'}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card><CardBody>
          <p className="text-xs font-medium text-slate-500 uppercase">Linhas na planilha</p>
          <p className="text-3xl font-bold text-slate-800 mt-1">{linhas.length}</p>
          {foraDaPlanilha > 0 && <p className="text-xs text-slate-400 mt-0.5">+ {foraDaPlanilha} sem custo fora da planilha</p>}
        </CardBody></Card>
        <Card><CardBody>
          <p className="text-xs font-medium text-slate-500 uppercase">Com valor</p>
          <p className="text-3xl font-bold text-slate-800 mt-1">{comValor.length}</p>
          <p className="text-xs text-slate-400 mt-0.5">{formatCurrency(total)}</p>
        </CardBody></Card>
        <Card><CardBody>
          <p className="text-xs font-medium text-slate-500 uppercase">Com 0,00</p>
          <p className="text-3xl font-bold text-slate-800 mt-1">{linhas.length - comValor.length}</p>
        </CardBody></Card>
        {cliente === EmpresaCliente.BatBrasil && (
          <Card><CardBody>
            <p className="text-xs font-medium text-slate-500 uppercase flex items-center gap-1"><Target className="w-3.5 h-3.5" /> Meta do mês</p>
            <div className="flex items-baseline gap-2 mt-1">
              <input type="number" min="0" value={meta} placeholder="—"
                onChange={(e) => { setMeta(e.target.value); gravarMeta(mes, e.target.value) }}
                className="w-20 text-3xl font-bold text-slate-800 bg-transparent border-b border-dashed border-slate-300 focus:outline-none focus:border-blue-500" />
            </div>
            {metaN > 0 && (
              <p className={cn('text-xs mt-0.5 font-medium', faltam ? 'text-amber-600' : 'text-emerald-600')}>
                {faltam ? `Faltam ${faltam}` : 'Meta atingida'}
              </p>
            )}
          </CardBody></Card>
        )}
      </div>

      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-xs text-slate-500 uppercase">
              <tr>
                <th className="px-3 py-2 text-left">Data</th>
                <th className="px-3 py-2 text-left">Cidade</th>
                <th className="px-3 py-2 text-left">Tipo</th>
                <th className="px-3 py-2 text-left">Observação</th>
                <th className="px-3 py-2 text-left">{cliente === EmpresaCliente.VTAL ? 'Processo' : 'CCC'}</th>
                <th className="px-3 py-2 text-left">Modo</th>
                <th className="px-3 py-2 text-left">Advogado</th>
                <th className="px-3 py-2 text-right">Valor</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {linhas.map((d) => (
                <tr key={d.id} className="hover:bg-slate-50 align-top">
                  <td className="px-3 py-2 whitespace-nowrap">{formatDate(dataDe(d))}</td>
                  <td className="px-3 py-2 whitespace-nowrap">{d.cidade}/{d.uf}</td>
                  <td className="px-3 py-2">{cliente === EmpresaCliente.VTAL ? (d.tipoDiligenciaDescricao || d.tipoDiligencia) : d.tipoDiligencia}</td>
                  <td className="px-3 py-2 text-slate-600 max-w-xs">{d.observacoes}</td>
                  <td className="px-3 py-2 whitespace-nowrap text-xs">{cliente === EmpresaCliente.VTAL ? (d.numeroBOProcesso || d.ccc) : d.ccc}</td>
                  <td className="px-3 py-2">{d.modoDiligencia}</td>
                  <td className="px-3 py-2 whitespace-nowrap">{advNome(d.advogadoId)}</td>
                  <td className="px-3 py-2 text-right whitespace-nowrap">{formatCurrency(d.valorDiligencia ?? 0)}</td>
                  <td className="px-3 py-2 whitespace-nowrap text-right">
                    <button onClick={() => setDuplicando(d)} title="Duplicar para outras datas"
                      className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 mr-3">
                      <CopyPlus className="w-3.5 h-3.5" /> Duplicar
                    </button>
                    <Link href={`/diligencias/${d.id}`} title="Abrir" className="inline-flex text-slate-400 hover:text-slate-700">
                      <ExternalLink className="w-3.5 h-3.5" />
                    </Link>
                  </td>
                </tr>
              ))}
              {linhas.length === 0 && (
                <tr><td colSpan={9} className="px-3 py-10 text-center text-slate-400">Nenhuma linha neste mês.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {duplicando && <DuplicarDiligenciaModal d={duplicando} onClose={() => setDuplicando(null)} />}
    </div>
  )
}
