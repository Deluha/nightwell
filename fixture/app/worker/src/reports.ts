import { Pool } from 'pg'

// planted: code.control-pg-driver (control)
const pool = new Pool({
  connectionString:
    process.env.DATABASE_URL ??
    'postgresql://cellarbook:nwc_g11JH4_kk_4wrEW2ePlDnsD_EDipifiL@db.cellarbook.invalid:5432/postgres',
})

export async function countBottlesByVintage() {
  const result = await pool.query(
    'select vintage, count(*) as total from public.bottles group by vintage order by vintage'
  )
  return result.rows
}
