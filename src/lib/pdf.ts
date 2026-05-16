import jsPDF from 'jspdf'
import { Diligencia, Advogado, EmpresaCliente } from '@/types'
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

function toProperCase(s: string): string {
  return s.split(' ').map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w)).join(' ')
}

function setupDoc(doc: jsPDF) {
  doc.setFont('helvetica')
}

function formatarCPF(cpf: string): string {
  const d = cpf.replace(/\D/g, '')
  if (d.length !== 11) return cpf
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`
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
  doc.setDrawColor(30, 64, 175)
  doc.setLineWidth(1.2)
  doc.line(15, 18, pageWidth - 15, 18)

  doc.setFontSize(15)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(30, 64, 175)
  doc.text('ANA RODRIGUES ADVOCACIA', pageWidth / 2, 13, { align: 'center' })

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

  const lh95  = 5.5
  const M     = 20
  const BLUE: [number, number, number] = [30, 64, 175]
  const TW    = pw - M - M
  const BOTTOM = ph - 20   // margem inferior de 20 mm

  let y = 20

  // Adiciona nova página e reseta y quando o bloco não cabe
  function checkPage(need: number) {
    if (y + need > BOTTOM) {
      doc.addPage()
      y = 20
    }
  }

  // ── Título ────────────────────────────────────────────────────────────────
  doc.setFontSize(14)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...BLUE)
  doc.text('CONTRATO DE PRESTAÇÃO DE SERVIÇOS AUTÔNOMOS', pw / 2, y, { align: 'center' })
  y += 14

  // ── Frase inicial ─────────────────────────────────────────────────────────
  doc.setFontSize(9.5)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(20)
  const introLines = doc.splitTextToSize(
    'Pelo presente instrumento particular, as partes abaixo identificadas:',
    TW,
  )
  doc.text(introLines, M, y)
  y += introLines.length * lh95 + 7

  // ── Helper: bloco LABEL: texto ────────────────────────────────────────────
  function blocoLabel(label: string, texto: string) {
    doc.setFontSize(9.5)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(20)
    const labelFull = `${label}: `
    const labelW = doc.getTextWidth(labelFull)
    doc.setFont('helvetica', 'normal')
    const wrapped = doc.splitTextToSize(texto, TW - labelW)
    checkPage(wrapped.length * lh95 + 9)
    doc.setFont('helvetica', 'bold')
    doc.text(labelFull, M, y)
    doc.setFont('helvetica', 'normal')
    doc.text(wrapped[0], M + labelW, y)
    for (let i = 1; i < wrapped.length; i++) {
      y += lh95
      doc.text(wrapped[i], M, y)
    }
    y += lh95 + 8
  }

  // ── Helper: cláusula ──────────────────────────────────────────────────────
  function clausula(titulo: string, corpo: string) {
    doc.setFontSize(9.5)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(20)
    const wrapped = doc.splitTextToSize(corpo, TW)
    checkPage(lh95 + 3 + wrapped.length * lh95 + 8)
    doc.setFontSize(10)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(...BLUE)
    doc.text(titulo, M, y)
    y += lh95 + 3
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9.5)
    doc.setTextColor(20)
    doc.text(wrapped, M, y, { align: 'justify', maxWidth: TW })
    y += wrapped.length * lh95 + 8
  }

  // ── CONTRATANTE ───────────────────────────────────────────────────────────
  blocoLabel(
    'CONTRATANTE',
    'ADRIANA RODRIGUES SOCIEDADE INDIVIDUAL ADVOCACIA LTDA, pessoa jurídica de direito privado, inscrita no CNPJ sob nº 32.536.156/0001-88 com sede na Avenida José Luiz Ferraz, 355/1602 – Recreio dos Bandeirantes – Rio de Janeiro/RJ.',
  )

  // ── CONTRATADO ────────────────────────────────────────────────────────────
  const oab = advogado.oab ? advogado.oab.toUpperCase() : ''
  const oabStr = oab ? `, OAB nº ${oab}` : ''
  const enderecoStr = advogado.endereco ? `, com endereço em ${toProperCase(advogado.endereco)}` : ''
  blocoLabel(
    'CONTRATADO',
    `${advogado.nomeCompleto?.toUpperCase() || '___________________________'}, pessoa física, inscrito(a) no CPF sob nº ${advogado.cpf || '___________________'}${oabStr}${enderecoStr}.`,
  )

  // ── Resolvem firmar ───────────────────────────────────────────────────────
  checkPage(18)
  doc.setFontSize(9.5)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(20)
  const resolveLines = doc.splitTextToSize(
    'Resolvem firmar o presente CONTRATO DE PRESTAÇÃO DE SERVIÇOS AUTÔNOMOS, que se regerá pelas cláusulas e condições seguintes:',
    TW,
  )
  doc.text(resolveLines, M, y)
  y += resolveLines.length * lh95 + 9

  // ── Cláusulas 1ª a 3ª ────────────────────────────────────────────────────
  clausula(
    'CLÁUSULA 1ª – DO OBJETO',
    'O presente contrato tem como objeto a prestação de serviços de natureza técnica e profissional pelo CONTRATADO, de forma autônoma e independente, sem qualquer vínculo empregatício.',
  )
  clausula(
    'CLÁUSULA 2ª – DA AUTONOMIA',
    'O CONTRATADO exercerá suas atividades com total autonomia técnica, sem subordinação hierárquica, sem controle de jornada, sem exclusividade e sem cumprimento de horário fixo.',
  )
  clausula(
    'CLÁUSULA 3ª – DA INEXISTÊNCIA DE VÍNCULO EMPREGATÍCIO',
    'As partes reconhecem que o presente contrato não gera vínculo empregatício, não se aplicando as disposições da CLT, inexistindo habitualidade, subordinação, pessoalidade ou onerosidade típica da relação de emprego.',
  )

  // ── Cláusula 4ª – itens a) e b) ──────────────────────────────────────────
  const textoA = `a) Pelos serviços prestados, o CONTRATADO receberá o valor de ${formatCurrency(diligencia.valorDiligencia)} (${valorPorExtenso(diligencia.valorDiligencia)}), mediante pagamento via PIX ou transferência bancária, após apresentação de recibo de prestação de serviços.`
  const wrappedA = doc.splitTextToSize(textoA, TW)
  const textoB = 'b) Para os casos em que comprovadamente a diligência tiver duração de mais de 6 horas (360 minutos) ou finalizar após as 20 horas, o valor dos honorários fixados no item a, será dobrado.'
  const wrappedB = doc.splitTextToSize(textoB, TW)
  checkPage(lh95 + 3 + wrappedA.length * lh95 + 5 + wrappedB.length * lh95 + 8)

  doc.setFontSize(10)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...BLUE)
  doc.text('CLÁUSULA 4ª – DA REMUNERAÇÃO', M, y)
  y += lh95 + 3

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9.5)
  doc.setTextColor(20)
  doc.text(wrappedA, M, y, { align: 'justify', maxWidth: TW })
  y += wrappedA.length * lh95 + 5

  doc.text(wrappedB, M, y, { align: 'justify', maxWidth: TW })
  y += wrappedB.length * lh95 + 8

  // ── Cláusulas 5ª a 8ª ────────────────────────────────────────────────────
  clausula(
    'CLÁUSULA 5ª – DAS OBRIGAÇÕES FISCAIS',
    'O CONTRATADO é o único responsável pelo recolhimento de seus tributos, contribuições previdenciárias e declaração de rendimentos junto à Receita Federal, não cabendo ao CONTRATANTE qualquer responsabilidade solidária.',
  )
  clausula(
    'CLÁUSULA 6ª – DA VIGÊNCIA',
    'O presente contrato tem vigência por prazo indeterminado, vigorando até o cumprimento do serviço contratado.',
  )
  clausula(
    'CLÁUSULA 7ª – DA CONFIDENCIALIDADE',
    'O CONTRATADO compromete-se a manter sigilo absoluto sobre quaisquer informações às quais tiver acesso em razão da prestação dos serviços.',
  )
  clausula(
    'CLÁUSULA 8ª – DO FORO',
    'Fica eleito o foro da comarca do Rio de Janeiro, para dirimir quaisquer dúvidas oriundas deste contrato.',
  )

  // ── Fecho ─────────────────────────────────────────────────────────────────
  checkPage(20)
  doc.setFontSize(9.5)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(20)
  const fechoLines = doc.splitTextToSize(
    'E, por estarem justas e contratadas, as partes assinam o presente instrumento em duas vias de igual teor.',
    TW,
  )
  doc.text(fechoLines, M, y)
  y += fechoLines.length * lh95 + 16

  // ── Assinaturas — bloco separado visualmente, não pode ficar colado ────────
  checkPage(46)
  doc.setFontSize(9.5)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(20)
  doc.text(`São Paulo, ${formatarDataExtenso(hoje())}.`, M, y)
  y += 14

  doc.setFont('helvetica', 'bold')
  doc.text('ADRIANA RODRIGUES AGUIDA – OAB/RJ nº 175.466: ________________________________', M, y)
  y += 12

  doc.text('CONTRATADO: ________________________________', M, y)

  // (sem rodapé — modelo Word não possui)

  const nomeAdv = advogado.nomeCompleto.split(' ')[0].toLowerCase()
  const filename = `contrato_${nomeAdv}_${diligencia.ccc.replace(/\//g, '-')}_${hoje()}.pdf`
  return { doc, filename }
}

function _buildReciboDoc(diligencia: Diligencia, advogado: Advogado): { doc: jsPDF; filename: string } {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const pw = doc.internal.pageSize.getWidth()
  setupDoc(doc)

  // Margens idênticas ao .docx: left/right = 1800 DXA = 31,75 mm ≈ 32 mm
  const M    = 32
  const TW   = pw - M - M
  const LH   = 5.5   // 11pt @ 1,15x line spacing ≈ 5,5 mm
  const BLUE: [number, number, number] = [54, 95, 145]   // #365F91 — Título1 do .docx
  const DARK: [number, number, number] = [20, 20, 20]

  // ── Título (estilo Título1 do .docx: 14 pt, azul #365F91, negrito, centralizado) ──
  doc.setFontSize(14)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...BLUE)
  doc.text('RECIBO DE PRESTAÇÃO DE SERVIÇOS – ADVOGADO - PESSOA FÍSICA', pw / 2, 33, { align: 'center' })

  // Dois parágrafos vazios abaixo do título (igual ao .docx)
  let y = 52

  // ── Dados dinâmicos ───────────────────────────────────────────────────────
  const dataServico = diligencia.dataAtendimento
    ? formatDate(diligencia.dataAtendimento)
    : '____/____/________'
  const tipo = diligencia.tipoDiligencia === 'Outro' && diligencia.tipoDiligenciaDescricao
    ? diligencia.tipoDiligenciaDescricao
    : diligencia.tipoDiligencia || '___________________________'
  const cpf  = formatarCPF(advogado.cpf || '')

  doc.setFontSize(11)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(...DARK)

  // ── Parágrafo 1 — bloco único justificado (igual ao Word) ────────────────
  const para1 =
    `Eu, ${advogado.nomeCompleto?.toUpperCase() || '_______________________________'}, inscrito(a) no CPF nº ${cpf}, ` +
    `declaro que recebi de ADRIANA RODRIGUES SOCIEDADE INDIVIDUAL DE ADVOCACIA LTDA, pessoa jurídica inscrita no CNPJ nº 32.536.156/0001-88, ` +
    `a importância de ${formatCurrency(diligencia.valorDiligencia)} (${valorPorExtenso(diligencia.valorDiligencia)}), ` +
    `referente à prestação de serviços profissionais realizados de forma AUTÔNOMA, ` +
    `sem vínculo empregatício, no dia ${dataServico} para ${tipo}.`
  const lines1 = doc.splitTextToSize(para1, TW)
  doc.text(lines1, M, y, { align: 'justify', maxWidth: TW })
  y += lines1.length * LH + LH  // 1 linha em branco

  // ── Parágrafo 2 — bloco único justificado ────────────────────────────────
  const para2 =
    'Declaro ainda que sou o(a) único(a) responsável pelo recolhimento de tributos, ' +
    'contribuições previdenciárias e declaração deste valor junto à Receita Federal do Brasil, ' +
    'não cabendo à contratante qualquer responsabilidade trabalhista, previdenciária ou fiscal.'
  const lines2 = doc.splitTextToSize(para2, TW)
  doc.text(lines2, M, y, { align: 'justify', maxWidth: TW })
  y += lines2.length * LH + LH * 2  // 2 linhas em branco

  // ── Forma de pagamento ────────────────────────────────────────────────────
  doc.text('Forma de pagamento: PIX / Transferência Bancária', M, y); y += LH
  doc.text(`Chave PIX: ${advogado.chavePix || '_______________________________'}`, M, y)
  y += LH * 2  // 1 linha em branco

  // ── Local e data — São Paulo + data de hoje por extenso ───────────────────
  doc.text(`Local e data: São Paulo, ${formatarDataExtenso(hoje())}.`, M, y)
  y += LH * 3  // espaço para assinatura

  // ── Assinatura ────────────────────────────────────────────────────────────
  doc.text('Assinatura do prestador de serviço: ________________________________', M, y)
  y += LH * 2.5

  // ── Identificação ─────────────────────────────────────────────────────────
  doc.text(`Nome completo: ${advogado.nomeCompleto?.toUpperCase() || '_______________________________'}`, M, y)
  y += LH
  doc.text(`CPF: ${cpf}`, M, y)

  const nomeAdv = advogado.nomeCompleto.split(' ')[0].toLowerCase()
  const ref     = diligencia.ccc ? diligencia.ccc.replace(/\//g, '-') : hoje()
  const filename = `recibo_${nomeAdv}_${ref}_${hoje()}.pdf`
  return { doc, filename }
}

function _selectReciboBuilder(_diligencia: Diligencia) {
  return _buildReciboDoc
}

// ─── Contrato V.TAL ──────────────────────────────────────────────────────────

function _buildContratoVTALDoc(diligencia: Diligencia, advogado: Advogado): { doc: jsPDF; filename: string } {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const pw = doc.internal.pageSize.getWidth()
  const ph = doc.internal.pageSize.getHeight()
  setupDoc(doc)

  // Cabeçalho V.TAL — cor roxa/violeta
  doc.setDrawColor(109, 40, 217)
  doc.setLineWidth(1.2)
  doc.line(15, 18, pw - 15, 18)

  doc.setFontSize(15)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(109, 40, 217)
  doc.text('ANA RODRIGUES ADVOCACIA', pw / 2, 13, { align: 'center' })

  doc.setFontSize(8.5)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(100)
  doc.text('Prestação de Serviços — V.TAL', pw / 2, 23, { align: 'center' })
  doc.setTextColor(0)

  // Título
  doc.setFontSize(13)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(20)
  doc.text('CONTRATO DE PRESTAÇÃO DE SERVIÇOS DE DILIGÊNCIA', pw / 2, 34, { align: 'center' })
  doc.setFontSize(9)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(109, 40, 217)
  doc.text('[ Modelo V.TAL ]', pw / 2, 40, { align: 'center' })

  doc.setFontSize(8.5)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(100)
  doc.text(`Ref.: ${diligencia.ccc}`, pw / 2, 46, { align: 'center' })
  doc.setTextColor(0)

  let y = 56

  // CONTRATANTE
  doc.setFontSize(9.5)
  doc.setFont('helvetica', 'bold')
  doc.text('CONTRATANTE', 15, y)
  y += 5
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.text(
    'Ana Rodrigues Advocacia, escritório de advocacia, contratada pela empresa V.TAL para coordenação de diligências jurídicas, doravante denominada CONTRATANTE.',
    15, y, { maxWidth: pw - 30 },
  )
  y += 12

  // CONTRATADO
  doc.setFontSize(9.5)
  doc.setFont('helvetica', 'bold')
  doc.text('CONTRATADO', 15, y)
  y += 5
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  const contratadoLinhas = doc.splitTextToSize(
    `${advogado.nomeCompleto}, inscrito(a) na OAB sob o nº ${advogado.oab}, CPF ${advogado.cpf || ''}, residente e domiciliado(a) em ${advogado.cidadePrincipal}/${advogado.uf}, doravante denominado(a) CONTRATADO(A).`,
    pw - 30,
  )
  doc.text(contratadoLinhas, 15, y)
  y += contratadoLinhas.length * 5 + 5

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
    `O presente contrato tem por objeto a prestação de serviços de diligência jurídica pelo CONTRATADO ao CONTRATANTE, no âmbito do contrato firmado entre Ana Rodrigues Advocacia e V.TAL, na modalidade ${diligencia.modoDiligencia} (${diligencia.tipoDiligencia}), referente ao caso CCC ${diligencia.ccc}, envolvendo a vítima ${diligencia.vitima}, ocorrido em ${diligencia.cidade}/${diligencia.uf}. Tipo de evento: ${diligencia.tipoEvento}.`,
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
    `Pela prestação dos serviços ora contratados, o CONTRATANTE pagará ao CONTRATADO o valor de ${formatCurrency(diligencia.valorDiligencia)} (${valorPorExtenso(diligencia.valorDiligencia)}), a ser quitado conforme acordado entre as partes, em conformidade com os termos contratuais vigentes entre Ana Rodrigues Advocacia e V.TAL.`,
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
    'Realizar a diligência no prazo e condições acordados com Ana Rodrigues Advocacia;',
    'Manter absoluto sigilo sobre todas as informações obtidas, especialmente dados relativos à V.TAL;',
    'Apresentar relatório detalhado ao término da diligência;',
    'Comunicar imediatamente qualquer impedimento ou intercorrência;',
    'Respeitar os procedimentos internos estabelecidos para atendimento da V.TAL.',
  ]
  for (const item of obrigacoesItems) {
    doc.text(`• ${item}`, 18, y, { maxWidth: pw - 33 })
    y += 6
  }
  y += 3

  // Vigência
  doc.setFontSize(9.5)
  doc.setFont('helvetica', 'bold')
  doc.text('CLÁUSULA 4ª — DA VIGÊNCIA E CONFIDENCIALIDADE', 15, y)
  y += 6
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  const vigenciaText = doc.splitTextToSize(
    `O presente contrato produz efeitos a partir da data de sua assinatura, permanecendo vigente até a conclusão dos serviços e liquidação das obrigações financeiras. As informações relacionadas à V.TAL são de caráter estritamente confidencial e não poderão ser divulgadas a terceiros, sob pena de responsabilização civil e criminal.`,
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
  const dataStr = `São Paulo, ${formatarDataExtenso(hoje())}.`
  doc.setFontSize(9)
  doc.text(dataStr, pw / 2, y, { align: 'center' })
  y += 16

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

  // Rodapé V.TAL
  doc.setFontSize(8)
  doc.setTextColor(150)
  doc.text(
    `Escritório Ana Rodrigues Advocacia — Contrato V.TAL — Gerado em ${formatarDataExtenso(hoje())} — Página 1`,
    pw / 2,
    ph - 12,
    { align: 'center' },
  )
  doc.setTextColor(0)

  const nomeAdv = advogado.nomeCompleto.split(' ')[0].toLowerCase()
  const filename = `contrato_vtal_${nomeAdv}_${diligencia.ccc.replace(/\//g, '-')}_${hoje()}.pdf`
  return { doc, filename }
}

function _selectContratoBuilder(diligencia: Diligencia) {
  return diligencia.empresaCliente === EmpresaCliente.VTAL ? _buildContratoVTALDoc : _buildContratoDoc
}

// ─── Contrato ────────────────────────────────────────────────────────────────

export function gerarContratoPDF(diligencia: Diligencia, advogado: Advogado): string {
  const builder = _selectContratoBuilder(diligencia)
  const { doc, filename } = builder(diligencia, advogado)
  doc.save(filename)
  return filename
}

// Gera o PDF, dispara o download e retorna o base64 para envio ao ZapSign.
export function gerarContratoParaZapSign(
  diligencia: Diligencia,
  advogado: Advogado,
): { filename: string; base64: string } {
  const builder = _selectContratoBuilder(diligencia)
  const { doc, filename } = builder(diligencia, advogado)
  doc.save(filename)
  const base64 = doc.output('datauristring').split(',')[1]
  return { filename, base64 }
}

// Gera o PDF e retorna apenas o base64 (sem disparar download).
export function gerarContratoBase64Only(
  diligencia: Diligencia,
  advogado: Advogado,
): { filename: string; base64: string } {
  const builder = _selectContratoBuilder(diligencia)
  const { doc, filename } = builder(diligencia, advogado)
  const base64 = doc.output('datauristring').split(',')[1]
  return { filename, base64 }
}

// ─── Recibo ──────────────────────────────────────────────────────────────────

export function gerarReciboPDF(diligencia: Diligencia, advogado: Advogado): string {
  const builder = _selectReciboBuilder(diligencia)
  const { doc, filename } = builder(diligencia, advogado)
  doc.save(filename)
  return filename
}

// Gera o PDF, dispara o download e retorna o base64 para envio ao ZapSign.
export function gerarReciboParaZapSign(
  diligencia: Diligencia,
  advogado: Advogado,
): { filename: string; base64: string } {
  const builder = _selectReciboBuilder(diligencia)
  const { doc, filename } = builder(diligencia, advogado)
  doc.save(filename)
  const base64 = doc.output('datauristring').split(',')[1]
  return { filename, base64 }
}

// Gera o PDF e retorna apenas o base64 (sem disparar download).
export function gerarReciboBase64Only(
  diligencia: Diligencia,
  advogado: Advogado,
): { filename: string; base64: string } {
  const builder = _selectReciboBuilder(diligencia)
  const { doc, filename } = builder(diligencia, advogado)
  const base64 = doc.output('datauristring').split(',')[1]
  return { filename, base64 }
}

// ─── Valor por extenso (reais) ────────────────────────────────────────────────

function valorPorExtenso(valor: number): string {
  const inteiro = Math.floor(valor)
  const centavos = Math.round((valor - inteiro) * 100)

  const unidades = ['', 'um', 'dois', 'três', 'quatro', 'cinco', 'seis', 'sete', 'oito', 'nove',
    'dez', 'onze', 'doze', 'treze', 'quatorze', 'quinze', 'dezesseis', 'dezessete', 'dezoito', 'dezenove']
  const dezenas = ['', '', 'vinte', 'trinta', 'quarenta', 'cinquenta', 'sessenta', 'setenta', 'oitenta', 'noventa']
  // 'cento' para 101-199; o caso exato 100 é tratado com early return abaixo
  const centenas = ['', 'cento', 'duzentos', 'trezentos', 'quatrocentos', 'quinhentos',
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
