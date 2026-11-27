import { createClient } from '../../lib/supabase/client'

const supabase = createClient()

// planted: code.hard-dynamic-table (tie)
export async function readTable(table: string) {
  return supabase.from(table).select('*').limit(10)
}

// planted: code.hard-dynamic-rpc (tie)
export async function callReport(kind: string) {
  const fnName = `report_${kind}`
  return supabase.rpc(fnName)
}
