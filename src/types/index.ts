// ─── Enums ────────────────────────────────────────────────────────────────────

export enum StatusDiligencia {
  EmAndamento = 'Em andamento',
  Realizada = 'Realizada',
}

export enum ModoDiligencia {
  Presencial = 'Presencial',
  Remoto = 'Remoto',
}

export enum TipoDiligencia {
  Acompanhamento = 'Acompanhamento',
  Oitiva = 'Oitiva',
  Levantamento = 'Levantamento',
  Pericia = 'Perícia',
  Outro = 'Outro',
}

export enum TipoEvento {
  Agressao = 'Agressão',
  Assalto = 'Assalto',
  Acidente = 'Acidente',
  Ameaca = 'Ameaça',
  Furto = 'Furto',
  Outro = 'Outro',
}

export enum StatusPesquisa {
  Pendente = 'Pendente',
  Concluida = 'Concluída',
}

export enum ResultadoLigacao {
  NaoAtendeu = 'Não atendeu',
  PediuRetorno = 'Pediu retorno',
  Respondeu = 'Respondeu',
}

export enum StatusPagamento {
  Pendente = 'Pendente',
  Pago = 'Pago',
}

export enum TipoOperador {
  Proprio = 'Próprio',
  Terceirizado = 'Terceirizado',
  Agregado = 'Agregado',
}

export enum StatusEvento {
  Pendente = 'pendente',
  Criado = 'criado',
  Arquivado = 'arquivado',
}

// ─── Avaliação ────────────────────────────────────────────────────────────────

export interface AvaliacaoAdvogado {
  nota: 1 | 2 | 3 | 4 | 5
  observacao?: string
  contratariaNovamente?: boolean
}

// ─── Advogado ─────────────────────────────────────────────────────────────────

export interface Advogado {
  id: string
  nomeCompleto: string
  cpf: string
  oab: string
  endereco: string
  cidadePrincipal: string
  uf: string
  cidadesAtendidas: string[]
  telefone: string
  whatsapp: string
  chavePix: string
  observacoes?: string
  createdAt: string
}

// ─── Evento ───────────────────────────────────────────────────────────────────

export interface Evento {
  id: string
  ccc: string
  dataEvento: string
  horaEvento: string
  dataRecebimento: string
  horaRecebimento: string
  operacao: TipoOperador
  empresa: string
  segmento: string
  tipoEvento: string
  nivelAgressao: number
  motoristaAgredido: boolean
  nomeVitima: string
  cargoVitima: string
  telefoneVitima: string
  cidade: string
  uf: string
  gtsc: string
  modalidade?: 'presencial' | 'remota'
  statusEvento: StatusEvento
  diligenciaId?: string
  createdAt: string
}

// ─── Anexos ───────────────────────────────────────────────────────────────────

export interface Anexos {
  contratoGerado?: string
  contratoAssinado?: string
  reciboGerado?: string
  reciboAssinado?: string
  comprovantePagamento?: string
  comprovanteServico?: string
}

// ─── Ligação ──────────────────────────────────────────────────────────────────

export interface Ligacao {
  id: string
  data: string
  hora: string
  duracao?: string
  resultado?: ResultadoLigacao
  observacao?: string
}

// ─── Pesquisa ─────────────────────────────────────────────────────────────────

export interface Pesquisa {
  status: StatusPesquisa
  dataEnvioWhatsApp?: string
  mensagemEnviada?: string
  respostaVitima?: string
  dataCombinada?: string
  historicoLigacoes: Ligacao[]
  observacoes?: string
}

// ─── Diligência ───────────────────────────────────────────────────────────────

export interface Diligencia {
  id: string
  ccc: string
  vitima: string
  telefoneVitima: string
  cargo: string
  empresa: string
  cidade: string
  uf: string
  tipoEvento: TipoEvento
  tipoDiligencia: TipoDiligencia
  modoDiligencia: ModoDiligencia
  advogadoId: string
  valorDiligencia: number
  observacoes?: string
  dpRegistrou?: string
  status: StatusDiligencia
  statusPagamento: StatusPagamento
  cicloFinalizado: boolean
  pesquisa: Pesquisa
  anexos: Anexos
  eventoId?: string
  avaliacao?: AvaliacaoAdvogado
  observacaoInterna?: string
  // ZapSign — assinatura digital
  zapsignDocumentIdContrato?: string
  zapsignDocumentIdRecibo?: string
  linkAssinaturaAdriana?: string
  linkAssinaturaAdvogadoContrato?: string
  linkAssinaturaAdvogadoRecibo?: string
  statusAssinaturaContrato?: 'pendente' | 'assinado'
  statusAssinaturaRecibo?: 'pendente' | 'assinado'
  createdAt: string
  updatedAt: string
}

// ─── Dashboard Stats ──────────────────────────────────────────────────────────

export interface DashboardStats {
  eventosNovos: number
  diligenciasEmAndamento: number
  diligenciasRealizadas: number
  pesquisasPendentes: number
  pesquisasConcluidas: number
  ciclosFinalizados: number
  totalDiligencias: number
  valorTotalPago: number
}

// ─── Financeiro Stats ─────────────────────────────────────────────────────────

export interface FinanceiroStats {
  totalPagoMes: number
  totalPendenteMes: number
  totalAtrasado: number
  countPagoMes: number
  countPendenteMes: number
  countAtrasado: number
}
