'use client'

import { useState } from 'react'
import { ClipboardPaste, Calendar, PhoneCall } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Textarea } from '@/components/ui/Textarea'
import { useToast } from '@/context/ToastContext'
import { cn, formatPhone, hojeBR, somarDias } from '@/lib/utils'
import {
  lerAgendamentosColados, casarAgendamento,
  type AgendamentoColado, type CandidatoAgendamento,
} from '@/lib/agendamentosColados'

// Cola a lista que o Claude (chat) gera a partir dos prints do WhatsApp,
// mostra quem foi encontrado e agenda todos os retornos de uma vez.

interface Linha {
  item: AgendamentoColado
  porTelefone: boolean
  opcoes: CandidatoAgendamento[]
  escolhido: string          // chave do candidato ('' = nenhum)
  marcado: boolean
}

function descreverRetorno(item: AgendamentoColado): string {
  if (item.agora) return 'Ligar agora'
  const hoje = hojeBR()
  const ddmm = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`
  const dia = !item.data ? 'qualquer dia'
    : item.data === hoje ? `hoje ${ddmm(item.data)}`
    : item.data === somarDias(hoje, 1) ? `amanhã ${ddmm(item.data)}`
    : `${ddmm(item.data)}/${item.data.slice(0, 4)}`
  return `Retorno: ${dia} a partir das ${item.hora}`
}

export function ColarAgendamentos({
  open, onClose, candidatos, onAgendar,
}: {
  open: boolean
  onClose: () => void
  candidatos: CandidatoAgendamento[]
  onAgendar: (chave: string, retorno: { data?: string; hora: string }) => Promise<void>
}) {
  const { addToast } = useToast()
  const [texto, setTexto] = useState('')
  const [linhas, setLinhas] = useState<Linha[] | null>(null)
  const [salvando, setSalvando] = useState(false)

  function fechar() {
    if (salvando) return
    setTexto(''); setLinhas(null)
    onClose()
  }

  function lerLista() {
    const hoje = hojeBR()
    setLinhas(lerAgendamentosColados(texto).map((item) => {
      const { porTelefone, opcoes } = casarAgendamento(item, candidatos)
      const unico = opcoes.length === 1 ? opcoes[0].chave : ''
      const dataPassou = !!item.data && item.data < hoje
      return {
        item, porTelefone, opcoes,
        escolhido: unico,
        // Marca sozinho só o que está seguro: achado pelo telefone, sem erro, não é "agora"
        marcado: !!unico && porTelefone && !item.erro && !item.agora && !dataPassou,
      }
    }))
  }

  function alterar(i: number, patch: Partial<Linha>) {
    setLinhas((ls) => ls && ls.map((l, j) => (j === i ? { ...l, ...patch } : l)))
  }

  const selecionadas = (linhas ?? []).filter((l) => l.marcado && l.escolhido && !l.item.erro && !l.item.agora)

  async function agendarTodos() {
    setSalvando(true)
    let ok = 0
    let falhas = 0
    for (const l of selecionadas) {
      try {
        await onAgendar(l.escolhido, { data: l.item.data, hora: l.item.hora! })
        ok++
      } catch {
        falhas++
      }
    }
    setSalvando(false)
    if (ok > 0) addToast('success', `${ok} retorno${ok !== 1 ? 's' : ''} agendado${ok !== 1 ? 's' : ''}.`)
    if (falhas > 0) addToast('error', `${falhas} não ${falhas !== 1 ? 'foram salvos' : 'foi salvo'}. Verifique a conexão e tente de novo.`)
    if (falhas === 0) { setTexto(''); setLinhas(null); onClose() }
  }

  return (
    <Modal open={open} onClose={fechar} title="Colar agendamentos" size="lg">
      <div className="p-5 space-y-4">
        {!linhas ? (
          <>
            <p className="text-sm text-slate-600">
              Cole aqui a lista que o Claude gerou a partir dos prints (linhas com
              <span className="font-mono text-xs bg-slate-100 rounded px-1 mx-1">TELEFONE | DATA | HORA | NOME | RESPOSTA</span>).
            </p>
            <Textarea
              rows={10}
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              placeholder={'AGENDAMENTOS\n558199760196 | 06/11/2026 | 14:00 | Laurifrank Alves | "Bom dia 06/11 as 14:00"'}
              className="font-mono text-xs"
            />
            <div className="flex gap-2 justify-end">
              <Button variant="secondary" size="sm" onClick={fechar}>Cancelar</Button>
              <Button size="sm" onClick={lerLista} disabled={!texto.trim()}>
                <ClipboardPaste className="w-3.5 h-3.5" /> Ler lista
              </Button>
            </div>
          </>
        ) : (
          <>
            {linhas.length === 0 ? (
              <p className="text-sm text-red-600">
                Nenhuma linha no formato esperado. Confira se copiou o bloco com as linhas
                &quot;TELEFONE | DATA | HORA | NOME | RESPOSTA&quot;.
              </p>
            ) : (
              <ul className="space-y-2">
                {linhas.map((l, i) => {
                  const { item } = l
                  const dataPassou = !!item.data && item.data < hojeBR()
                  const escolhido = l.opcoes.find((o) => o.chave === l.escolhido)
                  const podeMarcar = !!l.escolhido && !item.erro && !item.agora
                  const aviso = item.erro ? item.erro
                    : l.opcoes.length === 0 ? 'Não encontrado entre as pesquisas pendentes'
                    : !l.porTelefone ? 'Achado só pelo nome — confira se é a pessoa certa'
                    : l.opcoes.length > 1 ? 'Mais de uma pesquisa com esse telefone — escolha'
                    : dataPassou ? 'Essa data já passou'
                    : null
                  return (
                    <li
                      key={item.linha}
                      className={cn(
                        'rounded-lg border px-3 py-2.5 text-sm',
                        l.marcado ? 'border-blue-200 bg-blue-50/50' : 'border-slate-200 bg-white',
                      )}
                    >
                      <div className="flex items-start gap-2.5">
                        <input
                          type="checkbox"
                          className="mt-1 w-4 h-4 accent-blue-600"
                          checked={l.marcado}
                          disabled={!podeMarcar}
                          onChange={(e) => alterar(i, { marcado: e.target.checked })}
                        />
                        <div className="flex-1 min-w-0 space-y-1">
                          <div className="flex flex-wrap items-baseline gap-x-2">
                            <span className="font-medium text-slate-800">
                              {escolhido?.nome || item.nome || '(sem nome)'}
                            </span>
                            {escolhido?.ccc && <span className="text-xs text-slate-500">{escolhido.ccc}</span>}
                            <span className="text-xs text-slate-400">{formatPhone(item.telefone.replace(/^55(?=\d{10,11}$)/, ''))}</span>
                          </div>
                          <p className={cn('text-xs font-medium', item.agora ? 'text-emerald-700' : 'text-blue-700')}>
                            {item.agora && <PhoneCall className="w-3 h-3 inline mr-1" />}
                            {item.erro ? '—' : descreverRetorno(item)}
                            {item.agora && ' (não agenda — ligue já)'}
                          </p>
                          {item.resposta && <p className="text-xs text-slate-500 italic truncate">&ldquo;{item.resposta}&rdquo;</p>}
                          {(l.opcoes.length > 1 || (!l.porTelefone && l.opcoes.length > 0)) && (
                            <select
                              value={l.escolhido}
                              onChange={(e) => alterar(i, { escolhido: e.target.value, marcado: !!e.target.value && !item.erro && !item.agora })}
                              className="w-full text-xs rounded-lg border border-slate-200 px-2 py-1.5 bg-white"
                            >
                              <option value="">— escolha a pessoa —</option>
                              {l.opcoes.map((o) => (
                                <option key={o.chave} value={o.chave}>{o.nome}{o.ccc ? ` · ${o.ccc}` : ''}</option>
                              ))}
                            </select>
                          )}
                          {aviso && <p className={cn('text-xs', item.erro || l.opcoes.length === 0 ? 'text-red-600' : 'text-amber-700')}>{aviso}</p>}
                        </div>
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}
            <div className="flex flex-wrap gap-2 justify-end items-center">
              <Button variant="secondary" size="sm" onClick={() => setLinhas(null)} disabled={salvando}>Voltar</Button>
              <Button size="sm" onClick={agendarTodos} disabled={selecionadas.length === 0 || salvando}>
                <Calendar className="w-3.5 h-3.5" />
                {salvando ? 'Agendando...' : `Agendar ${selecionadas.length}`}
              </Button>
            </div>
          </>
        )}
      </div>
    </Modal>
  )
}
