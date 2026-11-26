import { createClient } from '../supabase/server'

export async function getServerDb() {
  const client = await createClient()
  return client
}
