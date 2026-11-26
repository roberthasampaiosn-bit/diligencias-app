import { PDFDocument } from 'pdf-lib'
import { supabase } from '@/lib/supabase'

export interface ItemPDFFinal {
  url: string
  nome: string
}

// Junta vários PDFs (em base64) num único PDF, retornando base64 — usado para
// enviar contrato + recibo como UM documento só ao ZapSign (uma assinatura).
export async function mesclarPdfsBase64(base64List: string[]): Promise<string> {
  const merged = await PDFDocument.create()
  for (const b64 of base64List) {
    const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0))
    const src = await PDFDocument.load(bytes, { ignoreEncryption: true })
    const paginas = await merged.copyPages(src, src.getPageIndices())
    paginas.forEach((p) => merged.addPage(p))
  }
  const out = await merged.save()
  // Uint8Array -> base64 em blocos (evita estouro de pilha em PDFs grandes)
  let binary = ''
  const chunk = 0x8000
  for (let i = 0; i < out.length; i += chunk) {
    binary += String.fromCharCode(...out.subarray(i, i + chunk))
  }
  return btoa(binary)
}

function detectarTipo(url: string, contentType: string): 'pdf' | 'jpg' | 'png' | 'desconhecido' {
  const ct = contentType.toLowerCase()
  if (ct.includes('pdf')) return 'pdf'
  if (ct.includes('jpeg') || ct.includes('jpg')) return 'jpg'
  if (ct.includes('png')) return 'png'

  const u = url.toLowerCase().split('?')[0]
  if (u.endsWith('.pdf')) return 'pdf'
  if (u.endsWith('.jpg') || u.endsWith('.jpeg')) return 'jpg'
  if (u.endsWith('.png')) return 'png'

  return 'desconhecido'
}

// Monta o PDF final (bytes) juntando os anexos na ordem de `itens`.
// `erros` = arquivos que não puderam entrar (o restante é gerado mesmo assim).
export async function montarPDFFinal(itens: ItemPDFFinal[]): Promise<{ bytes: Uint8Array; erros: Error[] }> {
  const merged = await PDFDocument.create()

  // Baixa e decodifica todos os arquivos em paralelo, mas preserva a ordem do array `itens`
  // (allSettled resolve na ordem de entrada, independentemente de qual download terminar antes).
  const resultados = await Promise.allSettled(
    itens.map(async ({ url, nome }) => {
      const res = await fetch(url)
      if (!res.ok) throw new Error(`Falha ao buscar ${nome}: ${res.status}`)
      const contentType = res.headers.get('content-type') ?? ''
      const tipo = detectarTipo(url, contentType)
      if (tipo === 'desconhecido') throw new Error(`Formato não suportado para ${nome}`)
      const bytes = await res.arrayBuffer()
      return { tipo, bytes }
    }),
  )

  // Adiciona as páginas em sequência, respeitando a ordem de `itens`.
  // Cada item é isolado em try/catch: um arquivo problemático não derruba o PDF
  // inteiro, apenas entra na lista de erros (gera o restante mesmo assim).
  const erros: Error[] = []
  for (const r of resultados) {
    if (r.status === 'rejected') {
      erros.push(r.reason as Error)
      continue
    }
    const { tipo, bytes } = r.value
    try {
      if (tipo === 'pdf') {
        // ignoreEncryption: PDFs assinados (ZapSign) costumam vir criptografados;
        // sem isso o pdf-lib recusa carregar e o PDF final falha por inteiro.
        const srcDoc = await PDFDocument.load(bytes, { ignoreEncryption: true })
        const indices = srcDoc.getPageIndices()
        const paginas = await merged.copyPages(srcDoc, indices)
        paginas.forEach((p) => merged.addPage(p))
      } else if (tipo === 'jpg') {
        const img = await merged.embedJpg(bytes)
        const { width, height } = img.scale(1)
        const page = merged.addPage([width, height])
        page.drawImage(img, { x: 0, y: 0, width, height })
      } else if (tipo === 'png') {
        const img = await merged.embedPng(bytes)
        const { width, height } = img.scale(1)
        const page = merged.addPage([width, height])
        page.drawImage(img, { x: 0, y: 0, width, height })
      }
    } catch (err) {
      erros.push(err as Error)
    }
  }

  if (erros.length > 0 && erros.length === itens.length) {
    throw new Error('Nenhum arquivo pôde ser processado.')
  }

  if (merged.getPageCount() === 0) {
    throw new Error('Nenhuma página foi gerada.')
  }

  return { bytes: await merged.save(), erros }
}

export async function gerarPDFFinal(nomeArquivo: string, itens: ItemPDFFinal[]): Promise<void> {
  const { bytes: pdfBytes, erros } = await montarPDFFinal(itens)
  const blob = new Blob([pdfBytes.buffer as ArrayBuffer], { type: 'application/pdf' })
  const objectUrl = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = objectUrl
  a.download = nomeArquivo.toLowerCase().endsWith('.pdf') ? nomeArquivo : `${nomeArquivo}.pdf`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(objectUrl)

  if (erros.length > 0) {
    throw new Error(
      `PDF gerado, mas ${erros.length} arquivo(s) não puderam ser incluídos.`,
    )
  }
}

// ─── Salvar direto no Google Drive ───────────────────────────────────────────
// O PDF vai do navegador DIRETO para um Google Apps Script (publicado pela conta
// dona das pastas — ver scripts/drive-salvar-pdf.gs), que grava em
// "<Cliente>/<MM - Mês AAAA>/". Não passa pela Vercel (limite de 4,5 MB por
// requisição). O app só assina a autorização em /api/drive/assinar — o segredo
// compartilhado nunca vai para o navegador.

export interface ResultadoDrive {
  url: string      // link do arquivo no Drive
  pasta: string    // ex.: "BAT - Souza Cruz / 09 - Setembro 2026"
  substituiu: boolean
  avisoErros?: string
}

function bytesParaBase64(bytes: Uint8Array): string {
  let binary = ''
  const chunk = 0x8000
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk))
  }
  return btoa(binary)
}

export async function salvarPDFFinalNoDrive(
  nomeArquivo: string,
  itens: ItemPDFFinal[],
  destino: { empresa: string; ano: string; mes: string },
): Promise<ResultadoDrive> {
  const nome = nomeArquivo.toLowerCase().endsWith('.pdf') ? nomeArquivo : `${nomeArquivo}.pdf`
  const { bytes, erros } = await montarPDFFinal(itens)

  // Só quem está logado no app consegue autorização (a rota confere o token).
  const { data: { session } } = await supabase.auth.getSession()
  const assRes = await fetch('/api/drive/assinar', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session?.access_token ?? ''}`,
    },
    body: JSON.stringify({ nome, ...destino }),
  })
  const ass = await assRes.json().catch(() => ({}))
  if (!assRes.ok) throw new Error(ass.error ?? `Falha ao autorizar o envio ao Drive (${assRes.status}).`)

  // text/plain = requisição "simples" (sem preflight CORS), que o Apps Script aceita.
  let out: { ok?: boolean; error?: string; url?: string; pasta?: string; substituiu?: boolean } | null = null
  try {
    const res = await fetch(ass.scriptUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ ...ass.payload, pdfBase64: bytesParaBase64(bytes) }),
    })
    out = await res.json().catch(() => null)
  } catch {
    throw new Error('Não foi possível falar com o Google Drive. Verifique a internet e tente de novo.')
  }
  if (!out?.ok || !out.url) throw new Error(out?.error ?? 'O Google Drive não confirmou o envio.')

  return {
    url: out.url,
    pasta: out.pasta ?? '',
    substituiu: !!out.substituiu,
    avisoErros: erros.length > 0 ? `${erros.length} arquivo(s) não puderam ser incluídos no PDF.` : undefined,
  }
}
