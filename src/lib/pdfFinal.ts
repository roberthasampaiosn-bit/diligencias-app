import { PDFDocument } from 'pdf-lib'

export interface ItemPDFFinal {
  url: string
  nome: string
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

export async function gerarPDFFinal(ccc: string, itens: ItemPDFFinal[]): Promise<void> {
  const merged = await PDFDocument.create()

  const resultados = await Promise.allSettled(
    itens.map(async ({ url, nome }) => {
      const res = await fetch(url)
      if (!res.ok) throw new Error(`Falha ao buscar ${nome}: ${res.status}`)
      const contentType = res.headers.get('content-type') ?? ''
      const tipo = detectarTipo(url, contentType)
      const bytes = await res.arrayBuffer()

      if (tipo === 'pdf') {
        const srcDoc = await PDFDocument.load(bytes)
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
      } else {
        throw new Error(`Formato não suportado para ${nome}`)
      }
    }),
  )

  const erros = resultados
    .filter((r): r is PromiseRejectedResult => r.status === 'rejected')
    .map((r) => r.reason as Error)

  if (erros.length > 0 && erros.length === itens.length) {
    throw new Error('Nenhum arquivo pôde ser processado.')
  }

  if (merged.getPageCount() === 0) {
    throw new Error('Nenhuma página foi gerada.')
  }

  const pdfBytes = await merged.save()
  const blob = new Blob([pdfBytes.buffer as ArrayBuffer], { type: 'application/pdf' })
  const objectUrl = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = objectUrl
  a.download = `diligencia-${ccc}.pdf`
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
