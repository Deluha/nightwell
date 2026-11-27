import { createClient } from '@/lib/supabase/server'

// planted: code.rpc-search-bottles (tie)
export async function searchBottles(q: string) {
  const supabase = await createClient()
  return supabase.rpc('search_bottles', { q })
}

// planted: code.rpc-cellar-summary (tie)
export async function cellarSummary(cellar: string) {
  const supabase = await createClient()
  return supabase.rpc('cellar_summary', { cellar })
}
