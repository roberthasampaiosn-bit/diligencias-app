'use client'

import { useEffect, useState } from 'react'
import { fetchAuditLog, AuditLogRow } from '@/services/auditLogDB'
import { ClipboardList } from 'lucide-react'
import Link from 'next/link'

const ACAO_LABEL: Record<string, string> = {
  criou_diligencia: 'Criou diligência',
  editou_diligencia: 'Editou diligência',
  marcou_realizada: 'Marcou como realizada',
  registrou_pagamento: 'Registrou pagamento',
  finalizou_ciclo: 'Finalizou ciclo',
  registrou_ligacao: 'Registrou ligação',
  enviou_whatsapp: 'Enviou WhatsApp',
  atualizou_pesquisa: 'Atualizou pesquisa',
  adicionou_anexo: 'Adicionou anexo',
  removeu_anexo: 'Removeu anexo',
}

const ACAO_COR: Record<string, string> = {
  criou_diligencia: 'bg-blue-100 text-blue-800',
  editou_diligencia: 'bg-yellow-100 text-yellow-800',
  marcou_realizada: 'bg-green-100 text-green-800',
  registrou_pagamento: 'bg-emerald-100 text-emerald-800',
  finalizou_ciclo: 'bg-purple-100 text-purple-800',
  registrou_ligacao: 'bg-sky-100 text-sky-800',
  enviou_whatsapp: 'bg-teal-100 text-teal-800',
  atualizou_pesquisa: 'bg-orange-100 text-orange-800',
  adicionou_anexo: 'bg-slate-100 text-slate-700',
  removeu_anexo: 'bg-red-100 text-red-700',
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

export default function HistoricoPage() {
  const [logs, setLogs] = useState<AuditLogRow[]>([])
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState<string | null>(null)

  useEffect(() => {
    fetchAuditLog(300)
      .then(setLogs)
      .catch(() => setErro('Não foi possível carregar o histórico.'))
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <ClipboardList className="w-6 h-6 text-slate-600" />
        <h1 className="text-xl font-bold text-slate-900">Histórico de Ações</h1>
      </div>

      {loading && <p className="text-slate-500 text-sm">Carregando...</p>}
      {erro && <p className="text-red-600 text-sm">{erro}</p>}

      {!loading && !erro && logs.length === 0 && (
        <p className="text-slate-500 text-sm">Nenhuma ação registrada ainda.</p>
      )}

      {!loading && logs.length > 0 && (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50">
                <th className="text-left px-4 py-3 font-semibold text-slate-600">Data/Hora</th>
                <th className="text-left px-4 py-3 font-semibold text-slate-600">Usuário</th>
                <th className="text-left px-4 py-3 font-semibold text-slate-600">Ação</th>
                <th className="text-left px-4 py-3 font-semibold text-slate-600">Diligência</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <tr key={log.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3 text-slate-500 whitespace-nowrap">{formatDate(log.created_at)}</td>
                  <td className="px-4 py-3 text-slate-700 font-medium">
                    {log.usuario_email.split('@')[0]}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${ACAO_COR[log.acao] ?? 'bg-slate-100 text-slate-700'}`}>
                      {ACAO_LABEL[log.acao] ?? log.acao}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {log.detalhes && log.entidade_id ? (
                      <Link
                        href={`/diligencias/${log.entidade_id}`}
                        className="text-blue-600 hover:underline font-mono text-xs"
                      >
                        {log.detalhes}
                      </Link>
                    ) : (
                      <span className="text-slate-400 text-xs">{log.detalhes ?? '—'}</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
