import ExcelJS from 'exceljs'

// ─── Paleta ───────────────────────────────────────────────────────────────────

const PALETA = {
  bat: {
    header:    'FF1E3A5F',  // azul marinho
    tab:       'FF2563EB',  // azul
    altRow:    'FFF0F4FF',  // azul bem claro
  },
  vtal: {
    header:    'FF4C1D95',  // violeta escuro
    tab:       'FF7C3AED',  // violeta
    altRow:    'FFF5F3FF',  // violeta bem claro
  },
  border:      'FFCBD5E1',
  white:       'FFFFFFFF',
}

// ─── Helpers de estilo ────────────────────────────────────────────────────────

function borderFino(color: string): ExcelJS.Border {
  return { style: 'thin', color: { argb: color } }
}

function applyHeader(cell: ExcelJS.Cell, headerColor: string) {
  cell.fill   = { type: 'pattern', pattern: 'solid', fgColor: { argb: headerColor } }
  cell.font   = { bold: true, color: { argb: PALETA.white }, size: 10, name: 'Calibri' }
  cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true }
  const b = borderFino(headerColor)
  cell.border = { top: b, bottom: b, left: b, right: b }
}

function applyData(cell: ExcelJS.Cell, altRow: boolean, altColor: string) {
  cell.fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: altRow ? altColor : PALETA.white } }
  cell.font      = { size: 10, name: 'Calibri' }
  cell.alignment = { vertical: 'middle' }
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
}

export async function exportarExcelEstilizado(abas: AbaExcel[], filename: string) {
  const wb = new ExcelJS.Workbook()
  wb.creator  = 'Ana Rodrigues Advocacia'
  wb.created  = new Date()
  wb.modified = new Date()

  for (const aba of abas) {
    const cores = PALETA[aba.tema]

    const ws = wb.addWorksheet(aba.nome, {
      properties: { tabColor: { argb: cores.tab } },
    })

    // Larguras de coluna
    ws.columns = aba.widths.map((w, i) => ({ key: `c${i}`, width: w }))

    // Linha de cabeçalho
    const hRow = ws.addRow(aba.headers)
    hRow.height = 32
    hRow.eachCell((cell) => applyHeader(cell, cores.header))

    // Linhas de dados
    aba.linhas.forEach((rowData, ri) => {
      const row = ws.addRow(rowData)
      row.height = 18
      row.eachCell({ includeEmpty: true }, (cell, colIdx) => {
        applyData(cell, ri % 2 === 0, cores.altRow)
        if (aba.colsMoeda?.includes(colIdx - 1)) {
          cell.numFmt = '"R$"\\ #,##0.00'
        }
      })
    })

    // Congelar cabeçalho
    ws.views = [{ state: 'frozen', ySplit: 1 }]

    // Auto-filtro em toda a linha de cabeçalho
    ws.autoFilter = {
      from: { row: 1, column: 1 },
      to:   { row: 1, column: aba.headers.length },
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
