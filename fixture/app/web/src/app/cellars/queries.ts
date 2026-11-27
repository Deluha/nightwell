import { createClient } from '@/lib/supabase/server'

// planted: code.query-select-embedded (tie)
export async function listCellars() {
  const supabase = await createClient()
  return supabase
    .from('cellars')
    .select('id, name, created_at, members(user_id, role)')
    .order('created_at', { ascending: false })
    .range(0, 19)
}

// planted: code.query-filters (tie)
export async function findBottles(cellarIds: string[], minYear: number, term: string) {
  const supabase = await createClient()
  return supabase
    .from('bottles')
    .select('id, name, vintage')
    .in('cellar_id', cellarIds)
    .gte('vintage', minYear)
    .ilike('name', `%${term}%`)
    .or('drink_by.is.null,drink_by.gte.2030')
    .limit(50)
}

// planted: code.query-single (tie)
export async function getCellar(id: string) {
  const supabase = await createClient()
  return supabase.from('cellars').select('*').eq('id', id).single()
}

// planted: code.query-maybe-single (tie)
export async function getMembership(cellarId: string, userId: string) {
  const supabase = await createClient()
  return supabase
    .from('members')
    .select('role')
    .eq('cellar_id', cellarId)
    .eq('user_id', userId)
    .maybeSingle()
}

// planted: code.query-insert (tie)
export async function addBottle(cellarId: string, name: string, vintage: number) {
  const supabase = await createClient()
  return supabase
    .from('bottles')
    .insert({ cellar_id: cellarId, name, vintage })
    .select()
    .single()
}

// planted: code.query-update-match (tie)
export async function renameBottle(cellarId: string, id: string, name: string) {
  const supabase = await createClient()
  return supabase.from('bottles').update({ name }).match({ cellar_id: cellarId, id })
}

// planted: code.query-update-eq (tie)
export async function setMemberRole(cellarId: string, userId: string, role: string) {
  const supabase = await createClient()
  return supabase
    .from('members')
    .update({ role })
    .eq('cellar_id', cellarId)
    .eq('user_id', userId)
}

// planted: code.query-upsert (tie)
export async function saveTastingNote(bottleId: string, body: string) {
  const supabase = await createClient()
  return supabase
    .from('tasting_notes')
    .upsert({ bottle_id: bottleId, body }, { onConflict: 'bottle_id' })
}

// planted: code.query-delete (tie)
export async function removeBottle(id: string) {
  const supabase = await createClient()
  return supabase.from('bottles').delete().eq('id', id)
}

// planted: code.query-schema (tie)
export async function listPublicCellars() {
  const supabase = await createClient()
  return supabase.schema('public').from('cellars').select('id, name')
}

// planted: code.query-count-head (tie)
export async function countBottles(cellarId: string) {
  const supabase = await createClient()
  const { count } = await supabase
    .from('bottles')
    .select('*', { count: 'exact', head: true })
    .eq('cellar_id', cellarId)
  return count ?? 0
}
