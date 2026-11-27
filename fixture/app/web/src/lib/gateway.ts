const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!

function headers(token: string) {
  return { apikey: key, Authorization: `Bearer ${token}` }
}

// planted: code.gateway-rest (tie)
export async function fetchBottles(token: string) {
  const res = await fetch(`${url}/rest/v1/bottles?select=id,name`, {
    headers: headers(token),
  })
  return res.json()
}

// planted: code.gateway-auth (tie)
export async function fetchAuthUser(token: string) {
  const res = await fetch(`${url}/auth/v1/user`, { headers: headers(token) })
  return res.json()
}

// planted: code.gateway-storage (tie)
export async function fetchLabel(token: string, name: string) {
  const res = await fetch(`${url}/storage/v1/object/labels/${name}`, {
    headers: headers(token),
  })
  return res.blob()
}

// planted: code.gateway-functions (tie)
export async function callRestock(token: string, bottleId: string) {
  const res = await fetch(`${url}/functions/v1/restock`, {
    method: 'POST',
    headers: { ...headers(token), 'Content-Type': 'application/json' },
    body: JSON.stringify({ bottleId }),
  })
  return res.json()
}
