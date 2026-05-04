import jsPDF from 'jspdf'
import { Diligencia, Advogado } from '@/types'
import { formatCurrency } from '@/lib/utils'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatDate(iso: string): string {
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

function formatarDataExtenso(iso: string): string {
  const [y, m, d] = iso.split('-')
  const meses = [
    'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
    'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
  ]
  const mes = meses[parseInt(m, 10) - 1]
  return `${d} de ${mes} de ${y}`
}

function hoje(): string {
  return new Date().toISOString().split('T')[0]
}

function setupDoc(doc: jsPDF) {
  doc.setFont('helvetica')
}

function rodape(doc: jsPDF, pageWidth: number, pageHeight: number, page: number) {
  doc.setFontSize(8)
  doc.setTextColor(150)
  doc.text(
    `Escritório Ana Rodrigues Advocacia — Documento gerado em ${formatarDataExtenso(hoje())} — Página ${page}`,
    pageWidth / 2,
    pageHeight - 12,
    { align: 'center' },
  )
  doc.setTextColor(0)
}

function cabecalho(doc: jsPDF, pageWidth: number) {
  // Linha superior
  doc.setDrawColor(30, 64, 175)
  doc.setLineWidth(1.2)
  doc.line(15, 18, pageWidth - 15, 18)

  // Nome do escritório
  doc.setFontSize(15)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(30, 64, 175)
  doc.text('ANA RODRIGUES ADVOCACIA', pageWidth / 2, 13, { align: 'center' })

  // Subtítulo
  doc.setFontSize(8.5)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(100)
  doc.text('Gestão de Diligências Jurídicas', pageWidth / 2, 23, { align: 'center' })
  doc.setTextColor(0)
}

// ─── Builders internos ────────────────────────────────────────────────────────

function _buildContratoDoc(diligencia: Diligencia, advogado: Advogado): { doc: jsPDF; filename: string } {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const pw = doc.internal.pageSize.getWidth()
  const ph = doc.internal.pageSize.getHeight()
  setupDoc(doc)

  cabecalho(doc, pw)

  // Título
  doc.setFontSize(13)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(20)
  doc.text('CONTRATO DE PRESTAÇÃO DE SERVIÇOS DE DILIGÊNCIA', pw / 2, 34, { align: 'center' })

  doc.setFontSize(8.5)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(100)
  doc.text(`Ref.: ${diligencia.ccc}`, pw / 2, 40, { align: 'center' })
  doc.setTextColor(0)

  let y = 50

  // Bloco CONTRATANTE
  doc.setFontSize(9.5)
  doc.setFont('helvetica', 'bold')
  doc.text('CONTRATANTE', 15, y)
  y += 5
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.text('Ana Rodrigues Advocacia, escritório de advocacia, doravante denominado CONTRATANTE.', 15, y, { maxWidth: pw - 30 })
  y += 10

  // Bloco CONTRATADO
  doc.setFontSize(9.5)
  doc.setFont('helvetica', 'bold')
  doc.text('CONTRATADO', 15, y)
  y += 5
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  const contratadoLinhas = doc.splitTextToSize(
    `${advogado.nomeCompleto}, inscrito(a) na OAB sob o nº ${advogado.oab}, CPF ${advogado.cpf}, residente e domiciliado(a) em ${advogado.cidadePrincipal}/${advogado.uf}, doravante denominado(a) CONTRATADO(A).`,
    pw - 30,
  )
  doc.text(contratadoLinhas, 15, y)
  y += contratadoLinhas.length * 5 + 5

  // Linha divisória
  doc.setDrawColor(220)
  doc.setLineWidth(0.3)
  doc.line(15, y, pw - 15, y)
  y += 8

  // Objeto
  doc.setFontSize(9.5)
  doc.setFont('helvetica', 'bold')
  doc.text('CLÁUSULA 1ª — DO OBJETO', 15, y)
  y += 6
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)

  const objetoText = doc.splitTextToSize(
    `O presente contrato tem por objeto a prestação de serviços de diligência jurídica pelo CONTRATADO ao CONTRATANTE, na modalidade ${diligencia.modoDiligencia} (${diligencia.tipoDiligencia}), referente ao caso CCC ${diligencia.ccc}, envolvendo a vítima ${diligencia.vitima}, ocorrido em ${diligencia.cidade}/${diligencia.uf}. Tipo de evento: ${diligencia.tipoEvento}.`,
    pw - 30,
  )
  doc.text(objetoText, 15, y)
  y += objetoText.length * 5 + 6

  // Valor
  doc.setFontSize(9.5)
  doc.setFont('helvetica', 'bold')
  doc.text('CLÁUSULA 2ª — DO VALOR E PAGAMENTO', 15, y)
  y += 6
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  const valorText = doc.splitTextToSize(
    `Pela prestação dos serviços ora contratados, o CONTRATANTE pagará ao CONTRATADO o valor de ${formatCurrency(diligencia.valorDiligencia)} (${valorPorExtenso(diligencia.valorDiligencia)}), a ser quitado conforme acordado entre as partes.`,
    pw - 30,
  )
  doc.text(valorText, 15, y)
  y += valorText.length * 5 + 6

  // Obrigações
  doc.setFontSize(9.5)
  doc.setFont('helvetica', 'bold')
  doc.text('CLÁUSULA 3ª — DAS OBRIGAÇÕES DO CONTRATADO', 15, y)
  y += 6
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  const obrigacoesItems = [
    'Realizar a diligência no prazo e condições acordados;',
    'Manter sigilo sobre todas as informações obtidas;',
    'Apresentar relatório detalhado ao término da diligência;',
    'Comunicar imediatamente qualquer impedimento ou intercorrência.',
  ]
  for (const item of obrigacoesItems) {
    doc.text(`• ${item}`, 18, y, { maxWidth: pw - 33 })
    y += 5.5
  }
  y += 3

  // Vigência
  doc.setFontSize(9.5)
  doc.setFont('helvetica', 'bold')
  doc.text('CLÁUSULA 4ª — DA VIGÊNCIA', 15, y)
  y += 6
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  const vigenciaText = doc.splitTextToSize(
    `O presente contrato produz efeitos a partir da data de sua assinatura, permanecendo vigente até a conclusão dos serviços e liquidação das obrigações financeiras, podendo ser rescindido por qualquer das partes mediante notificação prévia de 48 horas.`,
    pw - 30,
  )
  doc.text(vigenciaText, 15, y)
  y += vigenciaText.length * 5 + 6

  // Foro
  doc.setFontSize(9.5)
  doc.setFont('helvetica', 'bold')
  doc.text('CLÁUSULA 5ª — DO FORO', 15, y)
  y += 6
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.text(
    `Fica eleito o foro da comarca de ${advogado.cidadePrincipal}/${advogado.uf} para dirimir quaisquer dúvidas oriundas do presente instrumento.`,
    15, y, { maxWidth: pw - 30 },
  )
  y += 12

  // Data e assinaturas
  const dataStr = `${advogado.cidadePrincipal}, ${formatarDataExtenso(hoje())}.`
  doc.setFontSize(9)
  doc.text(dataStr, pw / 2, y, { align: 'center' })
  y += 16

  // Linhas de assinatura
  const col1 = 35
  const col2 = pw - 35
  doc.setLineWidth(0.5)
  doc.setDrawColor(80)
  doc.line(col1 - 30, y, col1 + 30, y)
  doc.line(col2 - 30, y, col2 + 30, y)
  y += 4
  doc.setFontSize(8)
  doc.setFont('helvetica', 'bold')
  doc.text('CONTRATANTE', col1, y, { align: 'center' })
  doc.text('CONTRATADO(A)', col2, y, { align: 'center' })
  y += 4
  doc.setFont('helvetica', 'normal')
  doc.text('Ana Rodrigues Advocacia', col1, y, { align: 'center' })
  doc.text(advogado.nomeCompleto, col2, y, { align: 'center' })
  y += 4
  doc.text(`OAB: ${advogado.oab}`, col2, y, { align: 'center' })

  rodape(doc, pw, ph, 1)

  const nomeAdv = advogado.nomeCompleto.split(' ')[0].toLowerCase()
  const filename = `contrato_${nomeAdv}_${diligencia.ccc.replace(/\//g, '-')}_${hoje()}.pdf`
  return { doc, filename }
}

function _buildReciboDoc(diligencia: Diligencia, advogado: Advogado): { doc: jsPDF; filename: string } {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const pw = doc.internal.pageSize.getWidth()
  const ph = doc.internal.pageSize.getHeight()
  setupDoc(doc)

  cabecalho(doc, pw)

  // Título
  doc.setFontSize(14)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(20)
  doc.text('RECIBO DE PAGAMENTO', pw / 2, 34, { align: 'center' })

  doc.setFontSize(8.5)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(100)
  doc.text(`Ref.: ${diligencia.ccc}`, pw / 2, 40, { align: 'center' })
  doc.setTextColor(0)

  // Caixa destaque valor
  const boxY = 50
  doc.setFillColor(239, 246, 255)
  doc.setDrawColor(147, 197, 253)
  doc.setLineWidth(0.4)
  doc.roundedRect(15, boxY, pw - 30, 22, 3, 3, 'FD')
  doc.setFontSize(11)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(30, 64, 175)
  doc.text('VALOR RECEBIDO', pw / 2, boxY + 8, { align: 'center' })
  doc.setFontSize(16)
  doc.text(formatCurrency(diligencia.valorDiligencia), pw / 2, boxY + 17, { align: 'center' })
  doc.setTextColor(0)

  let y = boxY + 32

  // Texto principal do recibo
  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  const textoRecibo = doc.splitTextToSize(
    `Eu, ${advogado.nomeCompleto}, inscrito(a) na OAB sob o nº ${advogado.oab}, CPF ${advogado.cpf}, residente e domiciliado(a) em ${advogado.cidadePrincipal}/${advogado.uf}, declaro ter recebido de Ana Rodrigues Advocacia a importância de ${formatCurrency(diligencia.valorDiligencia)} (${valorPorExtenso(diligencia.valorDiligencia)}), referente à prestação de serviços de diligência jurídica conforme especificado abaixo.`,
    pw - 30,
  )
  doc.text(textoRecibo, 15, y)
  y += textoRecibo.length * 6 + 10

  // Tabela de detalhes
  doc.setFillColor(248, 250, 252)
  doc.setDrawColor(226, 232, 240)
  doc.setLineWidth(0.3)
  doc.roundedRect(15, y, pw - 30, 58, 2, 2, 'FD')

  const detY = y + 8
  const campo = (label: string, valor: string, yOff: number) => {
    doc.setFontSize(8.5)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(100)
    doc.text(label.toUpperCase(), 22, detY + yOff)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(30)
    doc.text(valor, 70, detY + yOff)
  }

  campo('CCC / Processo', diligencia.ccc, 0)
  campo('Vítima', diligencia.vitima, 8)
  campo('Tipo de diligência', `${diligencia.tipoDiligencia} — ${diligencia.modoDiligencia}`, 16)
  campo('Local', `${diligencia.cidade}/${diligencia.uf}`, 24)
  campo('Tipo de evento', diligencia.tipoEvento, 32)
  campo('Data do recibo', formatarDataExtenso(hoje()), 40)
  campo('Chave Pix do contratado', advogado.chavePix || 'Não informada', 48)

  doc.setTextColor(0)
  y += 68

  // Declaração final
  doc.setFontSize(9)
  doc.setFont('helvetica', 'normal')
  const declaracao = doc.splitTextToSize(
    'Para clareza e como prova deste recebimento, firmo o presente recibo em via única, declarando que nada mais tenho a receber a título dos serviços acima discriminados.',
    pw - 30,
  )
  doc.text(declaracao, 15, y)
  y += declaracao.length * 5.5 + 14

  // Data e assinatura
  doc.setFontSize(9)
  doc.text(`${advogado.cidadePrincipal}, ${formatarDataExtenso(hoje())}.`, pw / 2, y, { align: 'center' })
  y += 16

  doc.setLineWidth(0.5)
  doc.setDrawColor(80)
  doc.line(pw / 2 - 40, y, pw / 2 + 40, y)
  y += 4
  doc.setFontSize(8.5)
  doc.setFont('helvetica', 'bold')
  doc.text(advogado.nomeCompleto, pw / 2, y, { align: 'center' })
  y += 4
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.text(`OAB: ${advogado.oab} · CPF: ${advogado.cpf}`, pw / 2, y, { align: 'center' })

  rodape(doc, pw, ph, 1)

  const nomeAdv = advogado.nomeCompleto.split(' ')[0].toLowerCase()
  const filename = `recibo_${nomeAdv}_${diligencia.ccc.replace(/\//g, '-')}_${hoje()}.pdf`
  return { doc, filename }
}

// ─── Contrato ────────────────────────────────────────────────────────────────

export function gerarContratoPDF(diligencia: Diligencia, advogado: Advogado): string {
  const { doc, filename } = _buildContratoDoc(diligencia, advogado)
  doc.save(filename)
  return filename
}

// Gera o PDF, dispara o download e retorna o base64 para envio ao ZapSign.
export function gerarContratoParaZapSign(
  diligencia: Diligencia,
  advogado: Advogado,
): { filename: string; base64: string } {
  const { doc, filename } = _buildContratoDoc(diligencia, advogado)
  doc.save(filename)
  const base64 = doc.output('datauristring').split(',')[1]
  return { filename, base64 }
}

// Gera o PDF e retorna apenas o base64 (sem disparar download).
// Usar na página de diligência onde o PDF já foi baixado anteriormente.
export function gerarContratoBase64Only(
  diligencia: Diligencia,
  advogado: Advogado,
): { filename: string; base64: string } {
  const { doc, filename } = _buildContratoDoc(diligencia, advogado)
  const base64 = doc.output('datauristring').split(',')[1]
  return { filename, base64 }
}

// ─── Recibo ──────────────────────────────────────────────────────────────────

export function gerarReciboPDF(diligencia: Diligencia, advogado: Advogado): string {
  const { doc, filename } = _buildReciboDoc(diligencia, advogado)
  doc.save(filename)
  return filename
}

// Gera o PDF, dispara o download e retorna o base64 para envio ao ZapSign.
export function gerarReciboParaZapSign(
  diligencia: Diligencia,
  advogado: Advogado,
): { filename: string; base64: string } {
  const { doc, filename } = _buildReciboDoc(diligencia, advogado)
  doc.save(filename)
  const base64 = doc.output('datauristring').split(',')[1]
  return { filename, base64 }
}

// Gera o PDF e retorna apenas o base64 (sem disparar download).
export function gerarReciboBase64Only(
  diligencia: Diligencia,
  advogado: Advogado,
): { filename: string; base64: string } {
  const { doc, filename } = _buildReciboDoc(diligencia, advogado)
  const base64 = doc.output('datauristring').split(',')[1]
  return { filename, base64 }
}

// ─── Valor por extenso (simplificado, reais) ─────────────────────────────────

function valorPorExtenso(valor: number): string {
  const inteiro = Math.floor(valor)
  const centavos = Math.round((valor - inteiro) * 100)

  const unidades = ['', 'um', 'dois', 'três', 'quatro', 'cinco', 'seis', 'sete', 'oito', 'nove',
    'dez', 'onze', 'doze', 'treze', 'quatorze', 'quinze', 'dezesseis', 'dezessete', 'dezoito', 'dezenove']
  const dezenas = ['', '', 'vinte', 'trinta', 'quarenta', 'cinquenta', 'sessenta', 'setenta', 'oitenta', 'noventa']
  const centenas = ['', 'cem', 'duzentos', 'trezentos', 'quatrocentos', 'quinhentos',
    'seiscentos', 'setecentos', 'oitocentos', 'novecentos']

  function partes(n: number): string {
    if (n === 0) return ''
    if (n === 100) return 'cem'
    const c = Math.floor(n / 100)
    const d = Math.floor((n % 100) / 10)
    const u = n % 10
    const resto = n % 100
    const parteC = c > 0 ? centenas[c] : ''
    const parteResto = resto < 20 ? unidades[resto] : `${dezenas[d]}${u > 0 ? ` e ${unidades[u]}` : ''}`
    if (parteC && parteResto) return `${parteC} e ${parteResto}`
    return parteC || parteResto
  }

  function milhar(n: number): string {
    const mil = Math.floor(n / 1000)
    const resto = n % 1000
    const parteMil = mil > 0 ? (mil === 1 ? 'mil' : `${partes(mil)} mil`) : ''
    const parteResto = partes(resto)
    if (parteMil && parteResto) return `${parteMil} e ${parteResto}`
    return parteMil || parteResto
  }

  const reaisStr = milhar(inteiro)
  const label = inteiro === 1 ? 'real' : 'reais'

  if (centavos === 0) return `${reaisStr} ${label}`

  const centStr = partes(centavos)
  const labelCent = centavos === 1 ? 'centavo' : 'centavos'
  return `${reaisStr} ${label} e ${centStr} ${labelCent}`
}
