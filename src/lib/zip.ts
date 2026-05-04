import JSZip from 'jszip'

export interface ItemZip {
  url: string
  nomeNoZip: string // ex: "contrato.pdf"
}

export async function gerarZipDiligencia(
  ccc: string,
  itens: ItemZip[],
): Promise<void> {
  const zip = new JSZip()

  const resultados = await Promise.allSettled(
    itens.map(async ({ url, nomeNoZip }) => {
      const res = await fetch(url)
      if (!res.ok) throw new Error(`Falha ao buscar ${nomeNoZip}: ${res.status}`)
      const blob = await res.blob()
      zip.file(nomeNoZip, blob)
    }),
  )

  const erros = resultados
    .filter((r): r is PromiseRejectedResult => r.status === 'rejected')
    .map((r) => r.reason as Error)

  if (erros.length > 0 && erros.length === itens.length) {
    throw new Error('Nenhum arquivo pôde ser baixado.')
  }

  const blob = await zip.generateAsync({ type: 'blob' })

  // Dispara download no browser sem dependência externa
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `diligencia-${ccc}.zip`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)

  if (erros.length > 0) {
    throw new Error(
      `ZIP gerado, mas ${erros.length} arquivo(s) não puderam ser incluídos.`,
    )
  }
}
