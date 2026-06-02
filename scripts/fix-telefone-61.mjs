import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  'https://fztodhkfammdfdbbmpcg.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ6dG9kaGtmYW1tZGZkYmJtcGNnIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NzQ5ODI5OCwiZXhwIjoyMDkzMDc0Mjk4fQ.BYkecymShZ5w_di-yQN2qT40wm-WakjebIIwp1GT5Zk'
)

const { error } = await supabase
  .from('eventos')
  .update({ telefone_vitima: '21999232058;21967832188' })
  .eq('ccc', 'BR-2026050061')

if (error) console.error('Erro:', error.message)
else console.log('✓ BR-2026050061 corrigido → 21999232058;21967832188')
