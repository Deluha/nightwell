// planted: code.fn-import-esm-url (tie)
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

const publishableKeys = JSON.parse(Deno.env.get('SUPABASE_PUBLISHABLE_KEYS') ?? '{}')

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  const authorization = req.headers.get('Authorization') ?? ''
  // planted: code.fn-thumbnail-client (tie)
  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, publishableKeys['default'], {
    global: { headers: { Authorization: authorization } },
  })

  // planted: code.fn-thumbnail-get-user (tie)
  const { data, error: authError } = await supabase.auth.getUser(authorization.replace('Bearer ', ''))
  if (authError || !data.user) {
    return new Response('unauthorized', { status: 401, headers: corsHeaders })
  }

  const { path } = await req.json()

  // planted: code.fn-thumbnail-storage-download (tie)
  const { data: file, error } = await supabase.storage.from('labels').download(path)
  if (error || !file) return new Response('not found', { status: 404, headers: corsHeaders })

  return new Response(file, { headers: { ...corsHeaders, 'Content-Type': file.type } })
})
