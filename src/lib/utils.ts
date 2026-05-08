import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCPF(cpf: string): string {
  const digits = cpf.replace(/\D/g, '')
  return digits.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4')
}

export function maskCPF(value: string): string {
  const d = value.replace(/\D/g, '').slice(0, 11)
  if (d.length <= 3) return d
  if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`
  if (d.length <= 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`
}

export function validarCPF(cpf: string): boolean {
  const d = cpf.replace(/\D/g, '')
  if (d.length !== 11) return false
  if (/^(\d)\1{10}$/.test(d)) return false
  let sum = 0
  for (let i = 0; i < 9; i++) sum += parseInt(d[i]) * (10 - i)
  let rem = (sum * 10) % 11
  if (rem === 10 || rem === 11) rem = 0
  if (rem !== parseInt(d[9])) return false
  sum = 0
  for (let i = 0; i < 10; i++) sum += parseInt(d[i]) * (11 - i)
  rem = (sum * 10) % 11
  if (rem === 10 || rem === 11) rem = 0
  return rem === parseInt(d[10])
}

export function formatPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '')
  if (digits.length === 11) {
    return digits.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3')
  }
  return digits.replace(/(\d{2})(\d{4})(\d{4})/, '($1) $2-$3')
}

export function cleanPhone(phone: string): string {
  return phone.replace(/\D/g, '')
}

const TITLE_PREPS = new Set(['de', 'da', 'do', 'dos', 'das', 'e', 'a', 'o', 'em', 'na', 'no', 'nas', 'nos'])

export function toTitleCase(str: string): string {
  if (!str) return str
  return str
    .toLowerCase()
    .split(' ')
    .map((word, i) => (i === 0 || !TITLE_PREPS.has(word)) ? word.charAt(0).toUpperCase() + word.slice(1) : word)
    .join(' ')
}

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value)
}

export function formatDate(dateStr: string): string {
  if (!dateStr) return '-'
  const [year, month, day] = dateStr.split('-')
  return `${day}/${month}/${year}`
}

export function formatDateTime(dateStr: string): string {
  if (!dateStr) return '-'
  const date = new Date(dateStr)
  return date.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function getGreeting(): string {
  const hour = new Date().getHours()
  if (hour < 12) return 'Bom dia'
  if (hour < 18) return 'Boa tarde'
  return 'Boa noite'
}

export function getFirstNames(fullName: string, count: 2 | 3 = 2): string {
  const names = fullName.trim().split(' ')
  return names.slice(0, count).join(' ')
}

export function numberToWords(value: number): string {
  const units = ['', 'um', 'dois', 'três', 'quatro', 'cinco', 'seis', 'sete', 'oito', 'nove',
    'dez', 'onze', 'doze', 'treze', 'quatorze', 'quinze', 'dezesseis', 'dezessete', 'dezoito', 'dezenove']
  const tens = ['', '', 'vinte', 'trinta', 'quarenta', 'cinquenta', 'sessenta', 'setenta', 'oitenta', 'noventa']
  const hundreds = ['', 'cento', 'duzentos', 'trezentos', 'quatrocentos', 'quinhentos',
    'seiscentos', 'setecentos', 'oitocentos', 'novecentos']

  if (value === 0) return 'zero reais'
  if (value === 100) return 'cem reais'

  const reais = Math.floor(value)
  const centavos = Math.round((value - reais) * 100)

  function convert(n: number): string {
    if (n === 0) return ''
    if (n < 20) return units[n]
    if (n < 100) {
      const t = tens[Math.floor(n / 10)]
      const u = units[n % 10]
      return u ? `${t} e ${u}` : t
    }
    if (n === 100) return 'cem'
    const h = hundreds[Math.floor(n / 100)]
    const rest = convert(n % 100)
    return rest ? `${h} e ${rest}` : h
  }

  let result = ''
  if (reais >= 1000) {
    const mil = Math.floor(reais / 1000)
    const resto = reais % 1000
    result += mil === 1 ? 'mil' : `${convert(mil)} mil`
    if (resto > 0) result += ` e ${convert(resto)}`
  } else {
    result = convert(reais)
  }

  result += reais === 1 ? ' real' : ' reais'

  if (centavos > 0) {
    result += ` e ${convert(centavos)} ${centavos === 1 ? 'centavo' : 'centavos'}`
  }

  return result
}

export function timeElapsed(dateStr: string): string {
  const now = new Date()
  const date = new Date(dateStr)
  const diffMs = now.getTime() - date.getTime()
  const diffMinutes = Math.floor(diffMs / (1000 * 60))
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

  if (diffMinutes < 60) return `há ${diffMinutes} min`
  if (diffHours < 24) return `há ${diffHours}h`
  if (diffDays === 1) return 'há 1 dia'
  if (diffDays < 30) return `há ${diffDays} dias`
  const diffMonths = Math.floor(diffDays / 30)
  return `há ${diffMonths} mês${diffMonths > 1 ? 'es' : ''}`
}

export function normalizarPlaca(placa: string): string {
  return placa.replace(/[-\s]/g, '').toUpperCase()
}

// Aceita padrão antigo (ABC1234) e Mercosul (ABC1D23).
// Retorna null se válida, ou string com mensagem de erro se inválida.
export function erroPlaca(placa: string): string | null {
  const p = normalizarPlaca(placa)
  if (p.length === 0) return 'Placa é obrigatória.'
  if (p.length !== 7) return 'A placa deve ter exatamente 7 caracteres (ex: ABC1234 ou ABC1D23).'
  if (!/^[A-Z]{3}(\d{4}|\d[A-Z]\d{2})$/.test(p)) {
    return 'Formato inválido. Use ABC1234 (padrão antigo) ou ABC1D23 (Mercosul).'
  }
  return null
}

export function validarPlaca(placa: string): boolean {
  return erroPlaca(placa) === null
}

export function buildWhatsAppUrl(phone: string, message: string): string {
  const digits = cleanPhone(phone)
  const encoded = encodeURIComponent(message)
  return `https://wa.me/55${digits}?text=${encoded}`
}

export function buildPesquisaMessage(vitima: string, tipoEvento: string): string {
  const greeting = getGreeting()
  const firstName = getFirstNames(vitima, 2)
  return `${greeting}, ${firstName}! Tudo bem?\n\nMeu nome é Ana Rodrigues, sou advogada e estou entrando em contato a respeito do evento de ${tipoEvento.toLowerCase()} ocorrido.\n\nGostaria de conversar brevemente para entender como você está e como posso ajudá-lo(a). Você tem disponibilidade?\n\nAguardo seu retorno. Obrigada!`
}

// ─── CCC BAT BRASIL ───────────────────────────────────────────────────────────

const REGEX_CCC_BAT = /^BR-\d{10}$/

export function normalizarCccBat(valor: string): string {
  let v = valor.trim().toUpperCase().replace(/\s+/g, '')
  // Auto-inserir hífen se usuário digitou sem ele: BR2026030019 → BR-2026030019
  if (/^BR\d/.test(v)) {
    v = 'BR-' + v.slice(2)
  }
  return v
}

// Retorna mensagem de erro ou string vazia se válido
export function validarCccBat(valor: string): string {
  const v = normalizarCccBat(valor)
  if (!v) return 'CCC obrigatório'
  if (!REGEX_CCC_BAT.test(v)) return 'Formato esperado: BR-2026030019'
  return ''
}
