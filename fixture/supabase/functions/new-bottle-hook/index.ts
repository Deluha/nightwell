// planted: code.fn-import-jsr (tie)
import { createClient } from 'jsr:@supabase/supabase-js@2'

type BottleRecord = { id: string; label: string | null }

type WebhookPayload = {
  type: 'INSERT' | 'UPDATE' | 'DELETE'
  table: string
  schema: string
  record: BottleRecord | null
  old_record: BottleRecord | null
}

const secretKeys = JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS') ?? '{}')

// planted: code.fn-hook-client (tie)
const admin = createClient(Deno.env.get('SUPABASE_URL')!, secretKeys['default'])

// Runs with JWT verification off, so the sender is not authenticated by the platform.
// planted: code.fn-hook-receiver (tie)
Deno.serve(async (req) => {
  const payload: WebhookPayload = await req.json()
  if (payload.type !== 'INSERT' || payload.table !== 'bottles' || !payload.record) {
    return Response.json({ skipped: true })
  }

  const { error } = await admin.storage.from('labels').list(payload.record.id)
  return Response.json({ ok: !error }, { status: error ? 500 : 200 })
})
