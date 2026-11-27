import { createClient } from '../../lib/db'
import { createClient as createClientAll } from '../../lib/db/all'

// planted: code.hard-reexport-named (tie)
export async function listCellarNames() {
  const supabase = createClient()
  return supabase.from('cellars').select()
}

// planted: code.hard-reexport-star (tie)
export async function listCellarIds() {
  const supabase = createClientAll()
  return supabase.from('cellars').select('id')
}
