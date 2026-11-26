import { createClient } from '../supabase/client'

export class BottleRepository {
  private readonly db = createClient()

  // planted: code.hard-class-field (tie)
  async listByCellar(cellarId: string) {
    return this.db.from('bottles').select('id, name').eq('cellar_id', cellarId)
  }
}
