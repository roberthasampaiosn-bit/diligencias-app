import ExcelJS from 'exceljs'

// ─── Paleta ───────────────────────────────────────────────────────────────────

// Estilo "simples", igual à planilha oficial (Suporte Jurídico Remoto):
// fundo branco, texto preto, cabeçalho em negrito e grade fina ("Todas as
// bordas"). Sem cabeçalho colorido nem linhas alternadas — assim o Ctrl+V
// normal já cola idêntico à oficial, sem precisar reformatar.
const PALETA = {
  border:      'FF808080',  // grade nítida, equivalente a "Todas as bordas"
  white:       'FFFFFFFF',
  black:       'FF000000',
}

// ─── Helpers de estilo ────────────────────────────────────────────────────────

function borderFino(color: string): ExcelJS.Border {
  return { style: 'thin', color: { argb: color } }
}

function applyHeader(cell: ExcelJS.Cell) {
  cell.fill   = { type: 'pattern', pattern: 'solid', fgColor: { argb: PALETA.white } }
  cell.font   = { bold: true, color: { argb: PALETA.black }, size: 12, name: 'Calibri' }
  cell.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true }
  const b = borderFino(PALETA.border)
  cell.border = { top: b, bottom: b, left: b, right: b }
}

function applyData(cell: ExcelJS.Cell) {
  cell.fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: PALETA.white } }
  cell.font      = { size: 12, name: 'Calibri', color: { argb: PALETA.black } }
  // Alinhamento à esquerda em tudo (inclusive números como Ano/Mês/Dia e os
  // horários/datas que o Sheets converte em número), igual à planilha oficial.
  // Sem isso, o padrão "geral" joga número para a direita ao colar com formato.
  cell.alignment = { vertical: 'middle', horizontal: 'left' }
  const b = borderFino(PALETA.border)
  cell.border    = { top: b, bottom: b, left: b, right: b }
}

// ─── Função principal ─────────────────────────────────────────────────────────

export interface AbaExcel {
  nome:        string
  headers:     string[]
  linhas:      (string | number)[][]
  widths:      number[]
  tema:        'bat' | 'vtal'
  /** Índices das colunas (0-based) que devem ser formatadas como moeda BR */
  colsMoeda?:  number[]
  /** Linha de resumo exibida acima do cabeçalho (ex: "Total: 12 | Período: 01/05 – 31/05") */
  resumo?:     string
}

export async function exportarExcelEstilizado(abas: AbaExcel[], filename: string) {
  const wb = new ExcelJS.Workbook()
  wb.creator  = 'Ana Rodrigues Advocacia'
  wb.created  = new Date()
  wb.modified = new Date()

  for (const aba of abas) {
    const ws = wb.addWorksheet(aba.nome)

    // Larguras de coluna
    ws.columns = aba.widths.map((w, i) => ({ key: `c${i}`, width: w }))

    // Linha de resumo (opcional) — aparece acima do cabeçalho
    let dataRowOffset = 0
    if (aba.resumo) {
      const rRow = ws.addRow([aba.resumo])
      rRow.height = 20
      ws.mergeCells(1, 1, 1, aba.headers.length)
      const rCell = rRow.getCell(1)
      rCell.font = { bold: true, size: 12, name: 'Calibri', color: { argb: PALETA.black } }
      rCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: PALETA.white } }
      rCell.alignment = { vertical: 'middle', horizontal: 'left' }
      dataRowOffset = 1
    }

    // Linha de cabeçalho
    const hRow = ws.addRow(aba.headers)
    hRow.height = 32
    hRow.eachCell((cell) => applyHeader(cell))

    // Linhas de dados
    aba.linhas.forEach((rowData) => {
      const row = ws.addRow(rowData)
      row.height = 18
      row.eachCell({ includeEmpty: true }, (cell, colIdx) => {
        applyData(cell)
        if (aba.colsMoeda?.includes(colIdx - 1)) {
          cell.numFmt = '"R$"\\ #,##0.00'
        }
      })
    })

    // Congelar cabeçalho (considera linha de resumo se presente)
    ws.views = [{ state: 'frozen', ySplit: 1 + dataRowOffset }]

    // Auto-filtro na linha de cabeçalho
    const hRowNum = 1 + dataRowOffset
    ws.autoFilter = {
      from: { row: hRowNum, column: 1 },
      to:   { row: hRowNum, column: aba.headers.length },
    }
  }

  // Download no browser
  const buffer = await wb.xlsx.writeBuffer()
  const blob   = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
  const url = URL.createObjectURL(blob)
  const a   = document.createElement('a')
  a.href     = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
