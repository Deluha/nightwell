import { createClient } from '@/lib/supabase/server'

// planted: code.storage-upload (tie)
export async function uploadLabel(path: string, file: File) {
  const supabase = await createClient()
  return supabase.storage.from('labels').upload(path, file, { upsert: false })
}

// planted: code.storage-download (tie)
export async function downloadLabel(path: string) {
  const supabase = await createClient()
  return supabase.storage.from('labels').download(path)
}

// planted: code.storage-list (tie)
export async function listLabels(folder: string) {
  const supabase = await createClient()
  return supabase.storage.from('labels').list(folder, { limit: 100 })
}

// planted: code.storage-public-url (tie)
export async function labelPublicUrl(path: string) {
  const supabase = await createClient()
  return supabase.storage.from('labels').getPublicUrl(path).data.publicUrl
}

// planted: code.storage-signed-url (tie)
export async function labelSignedUrl(path: string) {
  const supabase = await createClient()
  return supabase.storage.from('labels').createSignedUrl(path, 3600)
}

// planted: code.storage-remove (tie)
export async function removeLabels(paths: string[]) {
  const supabase = await createClient()
  return supabase.storage.from('labels').remove(paths)
}

// planted: code.storage-move (tie)
export async function moveLabel(from: string, to: string) {
  const supabase = await createClient()
  return supabase.storage.from('labels').move(from, to)
}
