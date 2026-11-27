// planted: code.fn-import-npm (tie)
import { createClient } from 'npm:@supabase/supabase-js@2'
// planted: code.fn-import-relative (tie)
import { corsHeaders } from '../_shared/cors.ts'

// planted: code.fn-env-injected (tie)
const url = Deno.env.get('SUPABASE_URL')!
const dbUrl = Deno.env.get('SUPABASE_DB_URL')

// The secret keys arrive as a JSON object keyed by name; the legacy variable is a single string.
const secretKeys = JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS') ?? '{}')
const serviceKey: string = secretKeys['default'] ?? Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

// planted: code.fn-service-client (tie)
const admin = createClient(url, serviceKey)

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  const { bottleId, quantity } = await req.json()

  // planted: code.fn-restock-update (tie)
  const { error } = await admin.from('bottles').update({ quantity }).eq('id', bottleId)

  return Response.json(
    { ok: !error, directDatabase: Boolean(dbUrl) },
    { status: error ? 500 : 200, headers: corsHeaders }
  )
})
