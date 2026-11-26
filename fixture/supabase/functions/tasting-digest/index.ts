// planted: code.fn-import-bare (tie)
import { createClient } from '@supabase/supabase-js'

const secretKeys = JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS') ?? '{}')

// planted: code.fn-digest-client (tie)
const admin = createClient(Deno.env.get('SUPABASE_URL')!, secretKeys['default'])

Deno.serve(async () => {
  const since = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString().slice(0, 10)

  // planted: code.fn-digest-select (tie)
  const { count, error } = await admin
    .from('tasting_notes')
    .select('id', { count: 'exact', head: true })
    .gte('tasted_on', since)

  return Response.json({ notes: count ?? 0 }, { status: error ? 500 : 200 })
})
