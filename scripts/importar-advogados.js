// Script de importação de advogados — lê o CSV e insere via Supabase service role
// Uso: node scripts/importar-advogados.js

const { createClient } = require('@supabase/supabase-js')
const fs = require('fs')
const path = require('path')

const SUPABASE_URL = 'https://fztodhkfammdfdbbmpcg.supabase.co'
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ6dG9kaGtmYW1tZGZkYmJtcGNnIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NzQ5ODI5OCwiZXhwIjoyMDkzMDc0Mjk4fQ.BYkecymShZ5w_di-yQN2qT40wm-WakjebIIwp1GT5Zk'
const CSV_PATH = path.join(process.env.USERPROFILE || process.env.HOME, 'Downloads', 'relatorio_revisao_advogados.csv')

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
})

// ─── Parser CSV ───────────────────────────────────────────────────────────────

function parseCsv(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8')
  const lines = raw.replace(/\r/g, '').trim().split('\n')
  const headers = lines[0].split(';').map(h => h.trim())
  return lines.slice(1).map(line => {
    const vals = line.split(';')
    const row = {}
    headers.forEach((h, i) => { row[h] = (vals[i] ?? '').trim() })
    return row
  })
}

function limparDigitos(s) {
  return (s || '').replace(/\D/g, '')
}

function toArray(s) {
  if (!s || !s.trim()) return []
  return s.split(',').map(c => c.trim()).filter(Boolean)
}

// ─── Transformação ────────────────────────────────────────────────────────────

function transformRow(r) {
  const telefone = limparDigitos(r.telefone)
  const cpf = limparDigitos(r.cpf) || null

  return {
    nome_completo: r.nome_completo,
    cpf,
    oab: r.oab || '',
    telefone,
    whatsapp: telefone,
    endereco: r.endereco || null,
    cidade_principal: r.cidade_principal,
    uf: r.uf,
    chave_pix: r.chave_pix || null,
    cidades_atendidas: toArray(r.cidades_atendidas),
    observacoes: r.observacoes || null,
  }
}

// ─── Deduplicação preventiva ──────────────────────────────────────────────────

async function jaExiste(nomeCompleto, telefone) {
  const { data } = await supabase
    .from('advogados')
    .select('id')
    .eq('nome_completo', nomeCompleto)
    .eq('telefone', telefone)
    .maybeSingle()
  return !!data
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function importar() {
  console.log(`\nLendo CSV: ${CSV_PATH}\n`)
  const rows = parseCsv(CSV_PATH)

  const validos = rows
    .map(transformRow)
    .filter(r => r.nome_completo && r.telefone)

  console.log(`Total de registros válidos no CSV: ${validos.length}\n`)

  let inseridos = 0
  let ignorados = 0
  let erros = 0

  for (const rec of validos) {
    // Evita duplicata exata (nome + telefone)
    const existe = await jaExiste(rec.nome_completo, rec.telefone)
    if (existe) {
      console.log(`  — (já existe) ${rec.nome_completo}`)
      ignorados++
      continue
    }

    const { error } = await supabase.from('advogados').insert(rec)

    if (error) {
      // Conflito de CPF duplicado é aviso, não erro fatal
      if (error.code === '23505') {
        console.log(`  ⚠ duplicado — ${rec.nome_completo}: ${error.message}`)
        ignorados++
      } else {
        console.error(`  ✗ ERRO — ${rec.nome_completo}: ${error.message}`)
        erros++
      }
    } else {
      console.log(`  ✓ ${rec.nome_completo}`)
      inseridos++
    }
  }

  console.log('\n' + '═'.repeat(50))
  console.log(`Inseridos : ${inseridos}`)
  console.log(`Ignorados : ${ignorados}  (já existiam ou CPF duplicado)`)
  console.log(`Erros     : ${erros}`)
  console.log('═'.repeat(50) + '\n')
}

importar().catch(err => {
  console.error('Falha fatal:', err)
  process.exit(1)
})
