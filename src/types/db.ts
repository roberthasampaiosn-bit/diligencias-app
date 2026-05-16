// Raw shapes returned by Supabase queries (snake_case).
// These are never exposed outside the service layer — use app types instead.

export interface AdvogadoRow {
  id: string
  nome_completo: string
  cpf: string | null
  oab: string
  oab_numero: string | null
  endereco: string
  cidade_principal: string
  uf: string
  cidades_atendidas: string[]
  telefone: string
  whatsapp: string | null
  chave_pix: string | null
  observacoes: string | null
  created_at: string
  updated_at: string
}

export interface LigacaoRow {
  id: string
  diligencia_id: string
  data: string
  hora: string
  duracao: string | null
  resultado: string | null
  observacao: string | null
  created_at: string
}

export interface DiligenciaRow {
  id: string
  empresa_cliente: string          // cliente do escritório (BAT BRASIL | V.TAL)
  ccc: string
  vitima: string
  telefone_vitima: string
  cargo: string
  empresa: string                  // empresa da vítima (texto livre)
  cidade: string
  uf: string
  tipo_evento: string
  tipo_diligencia: string
  tipo_diligencia_descricao: string | null
  modo_diligencia: string
  advogado_id: string
  valor_diligencia: number | null
  observacoes: string | null
  dp_registrou: string | null
  status: string
  status_pagamento: string
  ciclo_finalizado: boolean
  evento_id: string | null
  pesquisa_status: string
  pesquisa_data_envio_whatsapp: string | null
  pesquisa_mensagem_enviada: string | null
  pesquisa_resposta_vitima: string | null
  pesquisa_data_combinada: string | null
  pesquisa_observacoes: string | null
  anexo_contrato_gerado: string | null
  anexo_contrato_assinado: string | null
  anexo_recibo_gerado: string | null
  anexo_recibo_assinado: string | null
  anexo_comprovante_pagamento: string | null
  anexo_comprovante_servico: string | null
  avaliacao_nota: number | null
  avaliacao_observacao: string | null
  avaliacao_contratar_novamente: boolean | null
  avaliacao_data: string | null
  observacao_interna: string | null
  // Data/hora do informativo (email recebido)
  data_informativo?: string | null
  hora_informativo?: string | null
  // Campos BAT — evento / ligação / operação
  hora_evento?: string | null
  data_ligacao_advogado?: string | null
  hora_ligacao_advogado?: string | null
  operacao?: string | null
  segmento?: string | null
  sobra_mercadoria?: string | null
  numero_bo_processo?: string | null
  regiao_gtsc?: string | null
  motorista_agredido?: string | null
  // Campos de pesquisa — entrevistador e hora
  pesquisa_entrevistador?: string | null
  pesquisa_hora_entrevista?: string | null
  // Campos específicos V.TAL
  data_atendimento?: string | null
  macro?: string | null
  local_atendimento?: string | null
  resultado_demanda?: string | null
  centro_custo?: string | null
  // Dispensar documentos
  dispensar_documentos?: boolean | null
  // ZapSign — assinatura digital
  zapsign_document_id_contrato?: string | null
  zapsign_document_id_recibo?: string | null
  link_assinatura_adriana?: string | null
  link_assinatura_advogado_contrato?: string | null
  link_assinatura_advogado_recibo?: string | null
  status_assinatura_contrato?: string | null
  status_assinatura_recibo?: string | null
  created_at: string
  updated_at: string
  ligacoes?: LigacaoRow[]
}

export interface ConsultaPlacaRow {
  id: string
  placa: string
  solicitante: string
  data_consulta: string
  resultado: string | null
  observacoes: string | null
  anexo_resultado: string | null
  valor: number | null
  comprovante_pagamento: string | null
  created_at: string
  updated_at: string
}

export interface EventoRow {
  id: string
  ccc: string
  data_evento: string
  hora_evento: string
  data_informativo: string
  hora_informativo: string
  tipo_operador: string
  empresa: string
  segmento: string
  classificacao_evento: string
  nivel_agressao: number
  motorista_agredido: boolean
  nome_vitima?: string | null
  cargo_vitima?: string | null
  telefone_vitima?: string | null
  cidade: string
  uf: string
  gtst: string
  modalidade?: string | null
  status_evento: string
  diligencia_id: string | null
  created_at: string
}
