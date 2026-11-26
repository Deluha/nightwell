import { Kysely, PostgresDialect } from 'kysely'
import { Pool } from 'pg'

interface Database {
  grape_varieties: { id: string; name: string }
}

// planted: code.control-kysely-builder (control)
const db = new Kysely<Database>({
  dialect: new PostgresDialect({
    pool: new Pool({ connectionString: process.env.DATABASE_URL }),
  }),
})

export async function listVarieties() {
  return db.selectFrom('grape_varieties').select(['id', 'name']).execute()
}
