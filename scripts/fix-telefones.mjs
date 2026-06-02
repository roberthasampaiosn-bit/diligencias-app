// Script one-off: normaliza telefones duplicados na tabela eventos
// Executa: node scripts/fix-telefones.mjs

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://fztodhkfammdfdbbmpcg.supabase.co'
const SERVICE_KEY  = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ6dG9kaGtmYW1tZGZkYmJtcGNnIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NzQ5ODI5OCwiZXhwIjoyMDkzMDc0Mjk4fQ.BYkecymShZ5w_di-yQN2qT40wm-WakjebIIwp1GT5Zk'

const supabase = createClient(SUPABASE_URL, SERVICE_KEY)

function normalizarTelefone(raw) {
  if (!raw) return raw
  // Divide por ";" ou "," e limpa cada número (só dígitos)
  const partes = raw.split(/[;,]/).map(p => p.trim().replace(/\D/g, '')).filter(Boolean)
  return partes.join(';')
}

async function main() {
  // Busca todos os eventos com telefone preenchido
  const { data, error } = await supabase
    .from('eventos')
    .select('id, ccc, telefone_vitima')
    .not('telefone_vitima', 'is', null)

  if (error) { console.error('Erro ao buscar eventos:', error.message); process.exit(1) }

  console.log(`Total de eventos com telefone: ${data.length}`)

  let corrigidos = 0
  for (const ev of data) {
    const original  = ev.telefone_vitima
    const corrigido = normalizarTelefone(original)
    if (original === corrigido) continue // já está ok

    console.log(`[${ev.ccc}] "${original}" → "${corrigido}"`)

    const { error: updErr } = await supabase
      .from('eventos')
      .update({ telefone_vitima: corrigido })
      .eq('id', ev.id)

    if (updErr) {
      console.error(`  ✗ Erro ao atualizar ${ev.ccc}:`, updErr.message)
    } else {
      console.log(`  ✓ Corrigido`)
      corrigidos++
    }
  }

  console.log(`\nConcluído. ${corrigidos} registro(s) corrigido(s).`)
}

main()
