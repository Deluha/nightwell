'use server'

import { createClient } from '@/lib/supabase/server'

// planted: code.auth-sign-in-password (tie)
export async function signIn(email: string, password: string) {
  const supabase = await createClient()
  return supabase.auth.signInWithPassword({ email, password })
}

// planted: code.auth-sign-up (tie)
export async function signUp(email: string, password: string) {
  const supabase = await createClient()
  return supabase.auth.signUp({ email, password })
}

// planted: code.auth-oauth (tie)
export async function signInWithGithub() {
  const supabase = await createClient()
  return supabase.auth.signInWithOAuth({
    provider: 'github',
    options: { redirectTo: 'https://example.com/auth/callback' },
  })
}

// planted: code.auth-otp-send (tie)
export async function sendCode(email: string) {
  const supabase = await createClient()
  return supabase.auth.signInWithOtp({ email })
}

// planted: code.auth-otp-verify (tie)
export async function checkCode(email: string, token: string) {
  const supabase = await createClient()
  return supabase.auth.verifyOtp({ email, token, type: 'email' })
}

// planted: code.auth-state-listener (tie)
export async function watchSession(onChange: (signedIn: boolean) => void) {
  const supabase = await createClient()
  const { data } = supabase.auth.onAuthStateChange((_event, session) => {
    onChange(session !== null)
  })
  return () => data.subscription.unsubscribe()
}

// planted: code.auth-get-user (tie)
export async function currentUser() {
  const supabase = await createClient()
  const { data } = await supabase.auth.getUser()
  return data.user
}

// planted: code.auth-sign-out (tie)
export async function signOut() {
  const supabase = await createClient()
  return supabase.auth.signOut()
}

// planted: code.auth-mfa-enroll (tie)
export async function enrollTotp() {
  const supabase = await createClient()
  return supabase.auth.mfa.enroll({ factorType: 'totp', friendlyName: 'phone' })
}

// planted: code.auth-mfa-challenge-verify (tie)
export async function verifyTotp(factorId: string, code: string) {
  const supabase = await createClient()
  const { data: challenge, error } = await supabase.auth.mfa.challenge({ factorId })
  if (error) return { error }
  return supabase.auth.mfa.verify({ factorId, challengeId: challenge.id, code })
}

// planted: code.auth-mfa-list-factors (tie)
export async function listFactors() {
  const supabase = await createClient()
  return supabase.auth.mfa.listFactors()
}
