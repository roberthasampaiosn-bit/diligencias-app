import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServiceClient } from '@/lib/supabaseServer'

// POST /api/upload
// Recebe um anexo (multipart/form-data) e faz o upload no Storage usando a
// service_role do lado SERVIDOR, devolvendo a URL pública.
//
// Por quê: no iPhone (iOS Safari) o upload direto browser→Supabase Storage
// falha com "Load failed" — o iOS recusa a conexão cross-origin para o host do
// Storage, mesmo fora do Modo de Baixo Consumo. Passando o arquivo por esta
// rota mesma-origem (que já funciona no iPhone), o app envia para o próprio
// domínio e é o servidor que fala com o Storage. Sem CORS, sem falha.

const STORAGE_BUCKET = 'documentos'

// Nome de arquivo por campo — precisa casar com o CAMPO_TO_FILENAME do cliente
// (src/services/diligenciasDB.ts) para manter o padrão de path.
const CAMPO_TO_FILENAME: Record<string, string> = {
  contratoGerado: 'contrato-gerado',
  contratoAssinado: 'contrato-assinado',
  reciboGerado: 'recibo-gerado',
  reciboAssinado: 'recibo-assinado',
  comprovantePagamento: 'comprovante-pagamento',
  comprovanteServico: 'comprovante-servico',
}

// MIME por extensão — no iOS o File costuma chegar com type vazio, então o
// contentType é derivado da extensão (mesma tabela do cliente).
const EXT_TO_MIME: Record<string, string> = {
  pdf: 'application/pdf',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  heic: 'image/heic',
  heif: 'image/heif',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  let form: FormData
  try {
    form = await req.formData()
  } catch {
    return NextResponse.json({ error: 'Envio inválido (esperado multipart/form-data).' }, { status: 400 })
  }

  const file = form.get('file')
  const diligenciaId = String(form.get('diligenciaId') ?? '').trim()
  const campo = String(form.get('campo') ?? '').trim()

  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'Arquivo ausente.' }, { status: 400 })
  }
  if (!diligenciaId) {
    return NextResponse.json({ error: 'diligenciaId ausente.' }, { status: 400 })
  }
  const nomeCampo = CAMPO_TO_FILENAME[campo]
  if (!nomeCampo) {
    return NextResponse.json({ error: `Campo de anexo inválido: "${campo}".` }, { status: 400 })
  }

  const ext = (file.name.split('.').pop() || 'pdf').toLowerCase()
  // Mesmo padrão do cliente: caminho novo (timestamp) a cada upload, para nunca
  // sobrescrever um arquivo de outro dono (ex.: gravado pelo webhook do ZapSign).
  const path = `diligencias/${diligenciaId}/${nomeCampo}-${Date.now()}.${ext}`
  const contentType = EXT_TO_MIME[ext] || file.type || 'application/octet-stream'

  const bytes = Buffer.from(await file.arrayBuffer())

  const supabase = createSupabaseServiceClient()
  const { error } = await supabase.storage
    .from(STORAGE_BUCKET)
    .upload(path, bytes, { upsert: true, contentType })

  if (error) {
    console.error('[upload] storage:', error.message)
    return NextResponse.json({ error: `Storage upload: ${error.message}` }, { status: 500 })
  }

  const { data } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(path)
  return NextResponse.json({ publicUrl: data.publicUrl })
}
