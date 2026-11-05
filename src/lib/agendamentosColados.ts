import { hojeBR, normalizarBusca, somarDias, telefoneCasaBusca } from '@/lib/utils'

// ─── "Colar agendamentos" ─────────────────────────────────────────────────────
// Lê a lista que o Claude (chat) devolve a partir dos prints do WhatsApp:
//
//   AGENDAMENTOS
//   TELEFONE | DATA | HORA | NOME | RESPOSTA
//   558199760196 | 06/11/2026 | 14:00 | Laurifrank Alves | "Bom dia 06/11 as 14:00"
//
// DATA = dd/mm/aaaa (ou dd/mm), QUALQUER ou AGORA. Linhas fora desse formato
// (cabeçalho, ```, texto solto) são ignoradas.

export interface AgendamentoColado {
  linha: number
  telefone: string           // só dígitos, como veio
  data?: string              // "AAAA-MM-DD" — ausente em QUALQUER / AGORA
  qualquerDia: boolean
  agora: boolean
  hora?: string              // "HH:MM"
  nome: string
  resposta: string
  erro?: string
}

function lerHora(s: string): string | undefined {
  const m = s.trim().match(/^(\d{1,2})(?:\s*[:h]\s*(\d{2}))?\s*h?$/i)
  if (!m) return undefined
  const h = Number(m[1])
  const min = Number(m[2] ?? '0')
  if (h > 23 || min > 59) return undefined
  return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`
}

function lerData(s: string): string | undefined {
  const palavra = normalizarBusca(s)
  if (palavra === 'hoje') return hojeBR()
  if (palavra === 'amanha') return somarDias(hojeBR(), 1)
  const m = s.trim().match(/^(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?$/)
  if (!m) return undefined
  const dia = Number(m[1])
  const mes = Number(m[2])
  let ano = m[3] ? Number(m[3]) : Number(hojeBR().slice(0, 4))
  if (ano < 100) ano += 2000
  if (dia < 1 || dia > 31 || mes < 1 || mes > 12) return undefined
  return `${ano}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`
}

export function lerAgendamentosColados(texto: string): AgendamentoColado[] {
  const out: AgendamentoColado[] = []
  texto.split(/\r?\n/).forEach((bruta, i) => {
    const campos = bruta.split('|').map((c) => c.trim())
    if (campos.length < 3) return
    const telefone = campos[0].replace(/\D/g, '')
    if (telefone.length < 8) return // cabeçalho "TELEFONE | DATA | ..." e afins

    const dataTxt = (campos[1] ?? '').toUpperCase()
    const item: AgendamentoColado = {
      linha: i + 1,
      telefone,
      qualquerDia: dataTxt.startsWith('QUALQUER'),
      agora: dataTxt.startsWith('AGORA'),
      hora: lerHora(campos[2] ?? ''),
      nome: campos[3] ?? '',
      resposta: (campos.slice(4).join(' | ') || '').replace(/^["“]|["”]$/g, ''),
    }
    if (!item.qualquerDia && !item.agora) {
      item.data = lerData(campos[1] ?? '')
      if (!item.data) item.erro = `Data não entendida: "${campos[1] ?? ''}"`
    }
    if (!item.agora && !item.hora && !item.erro) item.erro = `Horário não entendido: "${campos[2] ?? ''}"`
    out.push(item)
  })
  return out
}

// ─── Casar cada linha com uma pesquisa pendente ───────────────────────────────

export interface CandidatoAgendamento {
  chave: string              // "d:<id>" (diligência) ou "e:<id>" (evento da triagem)
  nome: string
  telefones: string
  ccc: string
}

// Telefone primeiro; sem telefone que bata, tenta pelo nome (que vem da saudação
// "Bom dia, NOME!" — confira, porque o nome pode estar errado no envio).
export function casarAgendamento(
  item: AgendamentoColado,
  candidatos: CandidatoAgendamento[],
): { porTelefone: boolean; opcoes: CandidatoAgendamento[] } {
  const porTel = candidatos.filter((c) => telefoneCasaBusca(c.telefones, item.telefone))
  if (porTel.length > 0) return { porTelefone: true, opcoes: porTel }
  const partes = normalizarBusca(item.nome).split(' ').filter((p) => p.length > 2)
  if (partes.length === 0) return { porTelefone: false, opcoes: [] }
  const porNome = candidatos.filter((c) => {
    const n = normalizarBusca(c.nome)
    return partes.every((p) => n.includes(p))
  })
  return { porTelefone: false, opcoes: porNome }
}
