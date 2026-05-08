// ─── BAT BRASIL ───────────────────────────────────────────────────────────────

export const TIPOS_EVENTO_BAT = [
  'Roubo',
  'Tentativa',
  'Fato Suspeito',
  'Furto',
  'Acidente sem vítima',
  'Acidente com vítima',
  'Outro',
] as const

export type TipoEventoBat = typeof TIPOS_EVENTO_BAT[number]

const _MAPA_TIPO_EVENTO_BAT: Record<string, TipoEventoBat> = {
  'roubo': 'Roubo',
  'tentativa': 'Tentativa',
  'tentaiva': 'Tentativa',
  'fato suspeito': 'Fato Suspeito',
  'fato_suspeito': 'Fato Suspeito',
  'furto': 'Furto',
  'acidente': 'Outro',              // genérico → Outro
  'acidente sem vítima': 'Acidente sem vítima',
  'acidente sem vitima': 'Acidente sem vítima',
  'acidente com vítima': 'Acidente com vítima',
  'acidente com vitima': 'Acidente com vítima',
  'roubo/lesão': 'Roubo',          // Roubo/Lesão → Roubo
  'roubo/lesao': 'Roubo',
  'roubo lesão': 'Roubo',
  'roubo lesao': 'Roubo',
  'próprio': 'Outro',               // Próprio → Outro
  'proprio': 'Outro',
  'outro': 'Outro',
}

export function normalizarTipoEventoBat(valor: string): TipoEventoBat {
  return _MAPA_TIPO_EVENTO_BAT[valor.trim().toLowerCase()] ?? 'Outro'
}

// Modo de assistência jurídica BAT — "Remota" é o termo oficial, "Remoto" é variação
export const MODOS_ASSISTENCIA_BAT = ['Presencial', 'Remota'] as const
export type ModoAssistenciaBat = typeof MODOS_ASSISTENCIA_BAT[number]

export function normalizarModoAssistenciaBat(valor: string): ModoAssistenciaBat {
  const k = valor.trim().toLowerCase()
  if (k === 'presencial') return 'Presencial'
  return 'Remota'
}

// Campos booleanos BAT (motorista agredido, sobra de mercadoria, pesquisa)
export function normalizarSimNao(valor: string): string {
  const k = valor.trim().toLowerCase()
  if (['sim', 's', 'sím'].includes(k)) return 'Sim'
  if (['não', 'nao', 'n', 'não'].includes(k)) return 'Não'
  return ''
}

// ─── V.TAL ────────────────────────────────────────────────────────────────────

export const MACROS_VTAL = [
  'PRISÃO E CUSTÓDIA',
  'DILIGÊNCIAS E DESLOCAMENTOS',
  'RELATÓRIOS TÉCNICOS E JURÍDICOS',
  'ARTICULAÇÃO INSTITUCIONAL',
  'REUNIÕES E ARTICULAÇÃO ESTRATÉGICA',
  'ACOMPANHAMENTO DE COLABORADORES',
  'DEPOIMENTOS E REPRESENTAÇÃO LEGAL',
  'GESTÃO DOCUMENTAL E OFÍCIOS',
  'ANÁLISE PROCESSUAL E CONSULTAS',
] as const

export type MacroVtal = typeof MACROS_VTAL[number]

export const STATUS_VTAL = ['Em tratamento', 'Concluído'] as const
export type StatusVtal = typeof STATUS_VTAL[number]

export function normalizarStatusVtal(valor: string): StatusVtal {
  const k = valor.trim().toLowerCase()
  if (k === 'concluido' || k === 'concluído') return 'Concluído'
  return 'Em tratamento'
}

export const MODOS_ATENDIMENTO_VTAL = ['Online', 'Presencial'] as const
export type ModoAtendimentoVtal = typeof MODOS_ATENDIMENTO_VTAL[number]
