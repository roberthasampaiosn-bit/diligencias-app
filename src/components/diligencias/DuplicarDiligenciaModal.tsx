'use client'

import { useState } from 'react'
import { X, CopyPlus } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { useDiligencias } from '@/context/DiligenciasContext'
import { useToast } from '@/context/ToastContext'
import { TIPOS_DILIGENCIA_BAT, TIPOS_DILIGENCIA_VTAL } from '@/lib/constants'
import { formatDate } from '@/lib/utils'
import { Diligencia, EmpresaCliente, StatusPagamento, StatusPesquisa, TipoDiligencia } from '@/types'

// Duplicar uma diligência para uma ou várias datas (ex.: as tentativas de
// aditamento feitas em dias diferentes, lançadas no fim do mês). Copia CCC,
// advogado, cidade, BO/processo, local e dados do evento; a pessoa escolhe as
// datas e, se quiser, ajusta tipo, observação e valor.
// Documentos/assinaturas NÃO são copiados — cada cópia é uma diligência nova.

export function DuplicarDiligenciaModal({ d, onClose }: { d: Diligencia; onClose: () => void }) {
  const { createDiligencia } = useDiligencias()
  const { addToast } = useToast()
  const isVtal = d.empresaCliente === EmpresaCliente.VTAL
  const tiposBase = isVtal ? TIPOS_DILIGENCIA_VTAL : TIPOS_DILIGENCIA_BAT
  const tipos = tiposBase.includes(d.tipoDiligencia) ? tiposBase : [d.tipoDiligencia, ...tiposBase]

  const [datas, setDatas] = useState<string[]>([])
  const [novaData, setNovaData] = useState('')
  const [tipo, setTipo] = useState<string>(d.tipoDiligencia)
  const [observacoes, setObservacoes] = useState(d.observacoes ?? '')
  const [valor, setValor] = useState(String(d.valorDiligencia ?? 0))
  const [salvando, setSalvando] = useState(false)

  function adicionarData() {
    if (!novaData || datas.includes(novaData)) return
    setDatas((prev) => [...prev, novaData].sort())
    setNovaData('')
  }

  function trocarTipo(t: string) {
    setTipo(t)
    // Tentativa sem sucesso entra com 0,00 na planilha
    if (t === TipoDiligencia.TentativaAditamentoBO) {
      setValor('0')
      if (!observacoes.trim() || observacoes === d.observacoes) setObservacoes('Tentativa de aditamento de BO.')
    }
  }

  async function criar() {
    const lista = novaData && !datas.includes(novaData) ? [...datas, novaData] : datas
    if (!lista.length) return
    setSalvando(true)
    const v = parseFloat(valor.replace(',', '.')) || 0
    let ok = 0
    try {
      for (const data of lista) {
        await createDiligencia({
          empresaCliente: d.empresaCliente,
          ccc: d.ccc,
          vitima: d.vitima,
          telefoneVitima: d.telefoneVitima,
          cargo: d.cargo,
          empresa: d.empresa,
          cidade: d.cidade,
          uf: d.uf,
          tipoEvento: d.tipoEvento,
          tipoDiligencia: tipo as TipoDiligencia,
          tipoDiligenciaDescricao: tipo === d.tipoDiligencia ? d.tipoDiligenciaDescricao : undefined,
          modoDiligencia: d.modoDiligencia,
          advogadoId: d.advogadoId,
          valorDiligencia: v,
          observacoes: observacoes.trim() || undefined,
          dpRegistrou: d.dpRegistrou,
          status: d.status,
          // 0,00 = entra na planilha sem custo a pagar (mesma regra do formulário)
          statusPagamento: v > 0 ? StatusPagamento.Pendente : StatusPagamento.Pago,
          cicloFinalizado: false,
          pesquisa: { status: StatusPesquisa.Dispensada, historicoLigacoes: [], tentativasWhatsApp: 0 },
          anexos: {},
          // sem valor não há contrato/recibo a cobrar
          dispensarDocumentos: v > 0 ? undefined : true,
          incluirNaPlanilha: true,
          dataInformativo: d.dataInformativo,
          horaInformativo: d.horaInformativo,
          dataEvento: d.dataEvento,
          horaEvento: d.horaEvento,
          operacao: d.operacao,
          segmento: d.segmento,
          numeroBOProcesso: d.numeroBOProcesso,
          regiaoGtsc: d.regiaoGtsc,
          motoristaAgredido: d.motoristaAgredido,
          dataAtendimento: data,
          localAtendimento: d.localAtendimento,
          macro: d.macro,
          resultadoDemanda: d.resultadoDemanda,
          centroCusto: d.centroCusto,
        })
        ok++
      }
      addToast('success', `${ok} diligência${ok > 1 ? 's' : ''} criada${ok > 1 ? 's' : ''}.`)
      onClose()
    } catch {
      addToast('error', `Erro ao criar (${ok} de ${lista.length} criadas). Tente de novo.`)
    } finally {
      setSalvando(false)
    }
  }

  const total = datas.length + (novaData && !datas.includes(novaData) ? 1 : 0)

  return (
    <Modal open onClose={onClose} title="Duplicar diligência" size="md">
      <div className="p-5 space-y-4">
        <p className="text-sm text-slate-600">
          Copia <strong>{d.ccc || 'esta diligência'}</strong> ({d.cidade}/{d.uf}, {formatDate(d.dataAtendimento ?? d.createdAt.split('T')[0])})
          para as datas escolhidas. Documentos não são copiados.
        </p>

        <div>
          <p className="text-xs font-medium text-slate-600 mb-1">Datas</p>
          <div className="flex gap-2">
            <Input type="date" value={novaData} onChange={(e) => setNovaData(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); adicionarData() } }} />
            <Button variant="secondary" size="sm" onClick={adicionarData} disabled={!novaData}>Adicionar</Button>
          </div>
          {datas.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {datas.map((dt) => (
                <span key={dt} className="inline-flex items-center gap-1 bg-blue-50 text-blue-700 text-xs rounded-full px-2.5 py-1">
                  {formatDate(dt)}
                  <button type="button" onClick={() => setDatas((p) => p.filter((x) => x !== dt))} aria-label="Remover data">
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>

        <Select label="Tipo de diligência" value={tipo} onChange={(e) => trocarTipo(e.target.value)}
          options={tipos.map((t) => ({ value: t, label: t }))} />

        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-slate-600">Observação</label>
          <textarea value={observacoes} onChange={(e) => setObservacoes(e.target.value)} rows={2}
            className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>

        <Input label="Valor (R$) de cada uma" type="number" step="0.01" min="0" value={valor} onChange={(e) => setValor(e.target.value)} />

        <div className="flex justify-end gap-2 pt-1">
          <Button variant="secondary" size="sm" onClick={onClose}>Cancelar</Button>
          <Button variant="primary" size="sm" loading={salvando} disabled={total === 0} onClick={criar}>
            <CopyPlus className="w-3.5 h-3.5" /> Criar {total || ''} {total === 1 ? 'diligência' : 'diligências'}
          </Button>
        </div>
      </div>
    </Modal>
  )
}
