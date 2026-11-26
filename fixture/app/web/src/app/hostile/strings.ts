import { createClient } from '../../lib/supabase/client'

const supabase = createClient()

// planted: code.hostile-markup (tie)
export const markup = supabase.from('<script>alert(1)</script>').select()

// planted: code.hostile-terminal-escape (tie)
export const escape = supabase.from('\u001b[31mred').select()

// planted: code.hostile-ci-annotation (tie)
export const annotation = supabase.from('::error file=x::nightwell').select()

// planted: code.hostile-ci-group (tie)
export const group = supabase.storage.from('##[group]labels')

// planted: code.hostile-quotes (tie)
export const quotes = supabase.from(`it's "quoted" \`ticked\``).select()

// planted: code.hostile-newline (tie)
export const newline = supabase.channel('first\nsecond')

// planted: code.hostile-path-traversal (tie)
export const traversal = supabase.storage.from('../../etc/passwd')

// planted: code.hostile-backslash (tie)
export const backslash = supabase.from('a\\b').select()

// planted: code.hostile-email-canary (tie)
export const emailLiteral = supabase.from('canary.nightwell@example.com').select()
