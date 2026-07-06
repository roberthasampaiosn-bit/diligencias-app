import { supabase } from '@/lib/supabase'

export type AcaoLog =
  | 'criou_diligencia'
  | 'editou_diligencia'
  | 'marcou_realizada'
  | 'registrou_pagamento'
  | 'finalizou_ciclo'
  | 'registrou_ligacao'
  | 'enviou_whatsapp'
  | 'atualizou_pesquisa'
  | 'reabriu_pesquisa'
  | 'removeu_anexo'
  | 'adicionou_anexo'

export interface AuditEntry {
  usuarioEmail: string
  acao: AcaoLog
  entidadeId?: string
  detalhes?: string
}

export async function logAudit(entry: AuditEntry): Promise<void> {
  const { error } = await supabase.from('audit_log').insert({
    usuario_email: entry.usuarioEmail,
    acao: entry.acao,
    entidade_id: entry.entidadeId ?? null,
    detalhes: entry.detalhes ?? null,
  })
  if (error) console.warn('[auditLog] falha ao gravar:', error.message)
}

export interface AuditLogRow {
  id: string
  usuario_email: string
  acao: string
  entidade_id: string | null
  detalhes: string | null
  created_at: string
}

export async function fetchAuditLog(limit = 200): Promise<AuditLogRow[]> {
  const { data, error } = await supabase
    .from('audit_log')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) throw error
  return data as AuditLogRow[]
}
