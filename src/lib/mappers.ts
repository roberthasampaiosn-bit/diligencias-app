import {
  Advogado, Diligencia, Ligacao, Evento, AvaliacaoAdvogado,
  TipoEvento, TipoDiligencia, ModoDiligencia,
  StatusDiligencia, StatusPagamento, StatusPesquisa,
  ResultadoLigacao, TipoOperador, StatusEvento,
} from '@/types'
import { AdvogadoRow, DiligenciaRow, LigacaoRow, EventoRow } from '@/types/db'

const LEGACY_PESQUISA_CONCLUIDA = new Set(['Respondida', 'Sem contato'])

function normalizePesquisaStatus(raw: string | null | undefined): StatusPesquisa {
  if (!raw) return StatusPesquisa.Pendente
  if (LEGACY_PESQUISA_CONCLUIDA.has(raw)) return StatusPesquisa.Concluida
  if (raw === StatusPesquisa.Concluida) return StatusPesquisa.Concluida
  return StatusPesquisa.Pendente
}

// ─── Advogado ─────────────────────────────────────────────────────────────────

export function toAdvogado(row: AdvogadoRow): Advogado {
  return {
    id: row.id,
    nomeCompleto: row.nome_completo,
    cpf: row.cpf,
    oab: row.oab,
    endereco: row.endereco,
    cidadePrincipal: row.cidade_principal,
    uf: row.uf,
    cidadesAtendidas: row.cidades_atendidas,
    telefone: row.telefone,
    whatsapp: row.whatsapp,
    chavePix: row.chave_pix,
    observacoes: row.observacoes ?? undefined,
    createdAt: row.created_at,
  }
}

export function fromAdvogado(
  a: Omit<Advogado, 'id' | 'createdAt'>,
): Omit<AdvogadoRow, 'id' | 'created_at' | 'updated_at'> {
  return {
    nome_completo: a.nomeCompleto,
    cpf: a.cpf,
    oab: a.oab,
    endereco: a.endereco,
    cidade_principal: a.cidadePrincipal,
    uf: a.uf,
    cidades_atendidas: a.cidadesAtendidas,
    telefone: a.telefone,
    whatsapp: a.whatsapp,
    chave_pix: a.chavePix,
    observacoes: a.observacoes ?? null,
  }
}

// ─── Ligação ──────────────────────────────────────────────────────────────────

export function toLigacao(row: LigacaoRow): Ligacao {
  return {
    id: row.id,
    data: row.data,
    hora: row.hora,
    duracao: row.duracao ?? undefined,
    resultado: (row.resultado as ResultadoLigacao) ?? undefined,
    observacao: row.observacao ?? undefined,
  }
}

// ─── Diligência ───────────────────────────────────────────────────────────────

export function toDiligencia(row: DiligenciaRow): Diligencia {
  return {
    id: row.id,
    ccc: row.ccc,
    vitima: row.vitima,
    telefoneVitima: row.telefone_vitima,
    cargo: row.cargo,
    empresa: row.empresa,
    cidade: row.cidade,
    uf: row.uf,
    tipoEvento: row.tipo_evento as TipoEvento,
    tipoDiligencia: row.tipo_diligencia as TipoDiligencia,
    modoDiligencia: row.modo_diligencia as ModoDiligencia,
    advogadoId: row.advogado_id,
    valorDiligencia: row.valor_diligencia ?? 0,
    observacoes: row.observacoes ?? undefined,
    dpRegistrou: row.dp_registrou ?? undefined,
    status: row.status as StatusDiligencia,
    statusPagamento: row.status_pagamento as StatusPagamento,
    cicloFinalizado: row.ciclo_finalizado,
    eventoId: row.evento_id ?? undefined,
    pesquisa: {
      status: normalizePesquisaStatus(row.pesquisa_status),
      dataEnvioWhatsApp: row.pesquisa_data_envio_whatsapp ?? undefined,
      mensagemEnviada: row.pesquisa_mensagem_enviada ?? undefined,
      respostaVitima: row.pesquisa_resposta_vitima ?? undefined,
      dataCombinada: row.pesquisa_data_combinada ?? undefined,
      observacoes: row.pesquisa_observacoes ?? undefined,
      historicoLigacoes: (row.ligacoes ?? []).map(toLigacao),
    },
    anexos: {
      contratoGerado: row.anexo_contrato_gerado ?? undefined,
      contratoAssinado: row.anexo_contrato_assinado ?? undefined,
      reciboGerado: row.anexo_recibo_gerado ?? undefined,
      reciboAssinado: row.anexo_recibo_assinado ?? undefined,
      comprovantePagamento: row.anexo_comprovante_pagamento ?? undefined,
      comprovanteServico: row.anexo_comprovante_servico ?? undefined,
    },
    avaliacao: row.avaliacao_nota != null ? {
      nota: row.avaliacao_nota as AvaliacaoAdvogado['nota'],
      observacao: row.avaliacao_observacao ?? undefined,
      contratariaNovamente: row.avaliacao_contratar_novamente ?? undefined,
    } : undefined,
    observacaoInterna: row.observacao_interna ?? undefined,
    zapsignDocumentIdContrato: row.zapsign_document_id_contrato ?? undefined,
    zapsignDocumentIdRecibo: row.zapsign_document_id_recibo ?? undefined,
    linkAssinaturaAdriana: row.link_assinatura_adriana ?? undefined,
    linkAssinaturaAdvogadoContrato: row.link_assinatura_advogado_contrato ?? undefined,
    linkAssinaturaAdvogadoRecibo: row.link_assinatura_advogado_recibo ?? undefined,
    statusAssinaturaContrato: (row.status_assinatura_contrato as 'pendente' | 'assinado') ?? undefined,
    statusAssinaturaRecibo: (row.status_assinatura_recibo as 'pendente' | 'assinado') ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export function fromDiligencia(
  d: Omit<Diligencia, 'id' | 'createdAt' | 'updatedAt'>,
): Omit<DiligenciaRow, 'id' | 'created_at' | 'updated_at' | 'ligacoes'> {
  return {
    ccc: d.ccc,
    vitima: d.vitima,
    telefone_vitima: d.telefoneVitima,
    cargo: d.cargo,
    empresa: d.empresa,
    cidade: d.cidade,
    uf: d.uf ?? '',
    tipo_evento: d.tipoEvento,
    tipo_diligencia: d.tipoDiligencia,
    modo_diligencia: d.modoDiligencia,
    advogado_id: d.advogadoId,
    valor_diligencia: d.valorDiligencia ?? null,
    observacoes: d.observacoes ?? null,
    dp_registrou: d.dpRegistrou ?? null,
    status: d.status,
    status_pagamento: d.statusPagamento,
    ciclo_finalizado: d.cicloFinalizado,
    evento_id: d.eventoId ?? null,
    pesquisa_status: d.pesquisa.status,
    pesquisa_data_envio_whatsapp: d.pesquisa.dataEnvioWhatsApp ?? null,
    pesquisa_mensagem_enviada: d.pesquisa.mensagemEnviada ?? null,
    pesquisa_resposta_vitima: d.pesquisa.respostaVitima ?? null,
    pesquisa_data_combinada: d.pesquisa.dataCombinada ?? null,
    pesquisa_observacoes: d.pesquisa.observacoes ?? null,
    anexo_contrato_gerado: d.anexos.contratoGerado ?? null,
    anexo_contrato_assinado: d.anexos.contratoAssinado ?? null,
    anexo_recibo_gerado: d.anexos.reciboGerado ?? null,
    anexo_recibo_assinado: d.anexos.reciboAssinado ?? null,
    anexo_comprovante_pagamento: d.anexos.comprovantePagamento ?? null,
    anexo_comprovante_servico: d.anexos.comprovanteServico ?? null,
    avaliacao_nota: d.avaliacao?.nota ?? null,
    avaliacao_observacao: d.avaliacao?.observacao ?? null,
    avaliacao_contratar_novamente: d.avaliacao?.contratariaNovamente ?? null,
    avaliacao_data: d.avaliacao ? new Date().toISOString() : null,
    observacao_interna: d.observacaoInterna ?? null,
    zapsign_document_id_contrato: d.zapsignDocumentIdContrato ?? null,
    zapsign_document_id_recibo: d.zapsignDocumentIdRecibo ?? null,
    link_assinatura_adriana: d.linkAssinaturaAdriana ?? null,
    link_assinatura_advogado_contrato: d.linkAssinaturaAdvogadoContrato ?? null,
    link_assinatura_advogado_recibo: d.linkAssinaturaAdvogadoRecibo ?? null,
    status_assinatura_contrato: d.statusAssinaturaContrato ?? null,
    status_assinatura_recibo: d.statusAssinaturaRecibo ?? null,
  }
}

// ─── Evento ───────────────────────────────────────────────────────────────────

export function toEvento(row: EventoRow): Evento {
  return {
    id: row.id,
    ccc: row.ccc,
    dataEvento: row.data_evento,
    horaEvento: row.hora_evento,
    dataRecebimento: row.data_informativo,
    horaRecebimento: row.hora_informativo,
    operacao: row.tipo_operador as TipoOperador,
    empresa: row.empresa,
    segmento: row.segmento,
    tipoEvento: row.classificacao_evento,
    nivelAgressao: row.nivel_agressao,
    motoristaAgredido: row.motorista_agredido,
    nomeVitima: row.nome_vitima ?? '',
    cargoVitima: row.cargo_vitima ?? '',
    telefoneVitima: row.telefone_vitima ?? '',
    cidade: row.cidade,
    uf: row.uf,
    gtsc: row.gtst,
    modalidade: (row.modalidade as 'presencial' | 'remota') ?? undefined,
    statusEvento: row.status_evento as StatusEvento,
    diligenciaId: row.diligencia_id ?? undefined,
    createdAt: row.created_at,
  }
}
