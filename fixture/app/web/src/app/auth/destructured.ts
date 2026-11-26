import { createClient } from '../../lib/supabase/client'

// planted: code.hard-destructured-methods (tie)
export async function leaveAndListLabels() {
  const { auth, storage } = createClient()
  await auth.signOut()
  return storage.from('labels').list()
}

// planted: code.hard-destructured-result (tie)
export async function loadCellars() {
  const client = createClient()
  const { data } = await client.from('cellars').select('id, name')
  return data ?? []
}
