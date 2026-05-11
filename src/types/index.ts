// ─── Enums ────────────────────────────────────────────────────────────────────

export enum EmpresaCliente {
  BatBrasil = 'BAT BRASIL',
  VTAL = 'V.TAL',
}

export function normalizeEmpresa(value: string): EmpresaCliente {
  return value === EmpresaCliente.VTAL ? EmpresaCliente.VTAL : EmpresaCliente.BatBrasil
}

export enum StatusDiligencia {
  EmAndamento = 'Em andamento',
  Realizada = 'Realizada',
}

export enum ModoDiligencia {
  Presencial = 'Presencial',
  Remoto = 'Remoto',
}

export enum TipoDiligencia {
  // BAT BRASIL — Delegacia / Tribunal
  RegistroBO = 'Registro de BO na DP',
  AditamentoBO = 'Aditamento de BO',
  DepoimentoOitivaReconhecimento = 'Depoimento / Oitiva / Reconhecimento na DP',
  AcompanhamentoFlagrante = 'Acompanhamento de flagrante',
  ExtracaoCopiasDP = 'Extração de cópias na DP',
  AudienciaTJ = 'Audiência no TJ',
  CopiasTJ = 'Cópias de processo no TJ',
  // V.TAL
  PrisaoFlagrante = 'Prisão em flagrante',
  EngajamentoMP = 'Engajamento com MP / Juízo',
  RepresentacaoLegal = 'Representação legal',
  ProtocoloOficio = 'Protocolo / Ofício',
  ConsultaProcessual = 'Consulta processual',
  Relatorio = 'Relatório',
  Reuniao = 'Reunião',
  AudienciaCustodia = 'Audiência de custódia',
  // Geral
  Outro = 'Outro',
}

export enum TipoEvento {
  Roubo = 'Roubo',
  Tentativa = 'Tentativa',
  FatoSuspeito = 'Fato suspeito',
  Furto = 'Furto',
  AcidenteSemVitima = 'Acidente sem vítima',
  AcidenteComVitima = 'Acidente com vítima',
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
  oab: string
  endereco: string
  cidadePrincipal: string
  uf: string
  cidadesAtendidas: string[]
  telefone: string
  cpf?: string
  whatsapp?: string
  chavePix?: string
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
  horaEntrevista?: string
  entrevistador?: string
  historicoLigacoes: Ligacao[]
  observacoes?: string
}

// ─── Diligência ───────────────────────────────────────────────────────────────

export interface Diligencia {
  id: string
  empresaCliente: EmpresaCliente   // cliente do escritório (BAT BRASIL | V.TAL)
  ccc: string
  vitima: string
  telefoneVitima: string
  cargo: string
  empresa: string                  // empresa da vítima (texto livre)
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
  tipoDiligenciaDescricao?: string  // preenchido quando tipoDiligencia === 'Outro'
  // Data/hora do informativo (email recebido)
  dataInformativo?: string
  horaInformativo?: string
  // Campos BAT — evento / ligação / operação
  horaEvento?: string
  dataLigacaoAdvogado?: string
  horaLigacaoAdvogado?: string
  operacao?: string
  segmento?: string
  sobraMercadoria?: string
  numeroBOProcesso?: string
  regiaoGtsc?: string
  motoristaAgredido?: string
  // Campos específicos V.TAL (opcionais para BAT BRASIL)
  dataAtendimento?: string
  macro?: string
  localAtendimento?: string
  resultadoDemanda?: string
  centroCusto?: string
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

// ─── Consulta de Placa ────────────────────────────────────────────────────────

export type ResultadoConsultaPlaca = 'Localizada' | 'Não localizada'

export interface ConsultaPlaca {
  id: string
  placa: string
  solicitante: string
  dataConsulta: string
  resultado?: ResultadoConsultaPlaca
  observacoes?: string
  // preenchidos apenas quando resultado = 'Localizada'
  anexoResultado?: string
  valor?: number
  comprovantePagamento?: string
  createdAt: string
  updatedAt: string
}
