import { getServerDb } from '../../lib/db/get-client'

// planted: code.hard-async-wrapper (tie)
export async function listWishlist() {
  const db = await getServerDb()
  return db.from('wishlist_items').select('id, label')
}
