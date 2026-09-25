import { PDFDocument } from 'pdf-lib'

// Junta várias fotos/PDFs (na ordem recebida) num único PDF — usado no
// "Comprovante de serviço" quando a advogada manda cada página numa foto.
// Fotos viram uma página A4 cada (retrato ou paisagem, conforme a foto), já
// reduzidas e comprimidas para o PDF final não ficar pesado.

const A4: [number, number] = [595.28, 841.89]
const MARGEM = 18
const LADO_MAX_PX = 2000
const QUALIDADE_JPEG = 0.82

export function ehPdf(file: File): boolean {
  return file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')
}

export function ehImagem(file: File): boolean {
  return file.type.startsWith('image/') || /\.(jpe?g|png|heic|heif|webp)$/i.test(file.name)
}

// Redesenha a foto num canvas (respeita a rotação EXIF do celular) e devolve JPEG.
async function imagemParaJpeg(file: File): Promise<{ bytes: ArrayBuffer; largura: number; altura: number }> {
  const url = URL.createObjectURL(file)
  try {
    const img = new Image()
    img.src = url
    await img.decode().catch(() => {
      throw new Error(`Não foi possível ler a imagem "${file.name}".`)
    })
    const escala = Math.min(1, LADO_MAX_PX / Math.max(img.naturalWidth, img.naturalHeight))
    const largura = Math.round(img.naturalWidth * escala)
    const altura = Math.round(img.naturalHeight * escala)
    const canvas = document.createElement('canvas')
    canvas.width = largura
    canvas.height = altura
    const ctx = canvas.getContext('2d')!
    ctx.fillStyle = '#fff'
    ctx.fillRect(0, 0, largura, altura)
    ctx.drawImage(img, 0, 0, largura, altura)
    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/jpeg', QUALIDADE_JPEG))
    if (!blob) throw new Error(`Não foi possível converter a imagem "${file.name}".`)
    return { bytes: await blob.arrayBuffer(), largura, altura }
  } finally {
    URL.revokeObjectURL(url)
  }
}

export async function juntarEmPdf(arquivos: File[], nomeSaida: string): Promise<File> {
  const doc = await PDFDocument.create()

  for (const file of arquivos) {
    if (ehPdf(file)) {
      const src = await PDFDocument.load(await file.arrayBuffer(), { ignoreEncryption: true })
      const paginas = await doc.copyPages(src, src.getPageIndices())
      paginas.forEach((p) => doc.addPage(p))
    } else if (ehImagem(file)) {
      const { bytes, largura, altura } = await imagemParaJpeg(file)
      const jpg = await doc.embedJpg(bytes)
      const [pw, ph] = largura > altura ? [A4[1], A4[0]] : A4
      const escala = Math.min((pw - 2 * MARGEM) / largura, (ph - 2 * MARGEM) / altura)
      const w = largura * escala
      const h = altura * escala
      const page = doc.addPage([pw, ph])
      page.drawImage(jpg, { x: (pw - w) / 2, y: (ph - h) / 2, width: w, height: h })
    } else {
      throw new Error(`O arquivo "${file.name}" não é foto nem PDF.`)
    }
  }

  const bytes = await doc.save()
  return new File([bytes.buffer as ArrayBuffer], nomeSaida, { type: 'application/pdf' })
}
