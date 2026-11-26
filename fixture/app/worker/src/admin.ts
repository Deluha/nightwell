import { createClient } from '@supabase/supabase-js'

// planted: code.admin-client (tie)
export const admin = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!,
  { auth: { persistSession: false, autoRefreshToken: false } }
)

// planted: code.admin-client-legacy-key (tie)
export const legacyAdmin = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false, autoRefreshToken: false } }
)

// planted: code.admin-create-user (tie)
export async function inviteMember(email: string) {
  return admin.auth.admin.createUser({ email, email_confirm: true })
}

// planted: code.admin-list-users (tie)
export async function listMembers() {
  return admin.auth.admin.listUsers({ page: 1, perPage: 100 })
}

// planted: code.admin-delete-user (tie)
export async function removeMember(id: string) {
  return admin.auth.admin.deleteUser(id)
}

// planted: code.admin-generate-link (tie)
export async function magicLink(email: string) {
  return admin.auth.admin.generateLink({ type: 'magiclink', email })
}

// planted: code.admin-create-bucket (tie)
export async function ensureLabelsBucket() {
  return admin.storage.createBucket('labels', { public: false })
}
