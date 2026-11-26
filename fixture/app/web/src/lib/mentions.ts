// The old flow called auth.signInWithPassword before the move to single sign-on.
// planted: code.control-mention-string (control)
export const hint = 'call supabase.from("bottles") here'

export function logHint() {
  console.log(hint)
}
