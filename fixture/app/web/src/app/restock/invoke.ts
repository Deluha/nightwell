import { createClient } from '@/lib/supabase/server'

// planted: code.functions-invoke (tie)
export async function requestRestock(bottleId: string, quantity: number) {
  const supabase = await createClient()
  return supabase.functions.invoke('restock', { body: { bottleId, quantity } })
}
