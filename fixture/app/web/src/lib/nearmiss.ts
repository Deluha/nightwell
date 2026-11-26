import { getSession } from '@example/auth-helpers-nextjs'

// Each block below is the look-alike of one code rule family.

// planted: code.control-nearmiss-query (control)
const ledger = { from: (name: string) => ({ select: () => [name] }) }
export const ledgerRows = ledger.from('bottles').select()

// planted: code.control-nearmiss-rpc (control)
export async function pingRemote(client: { rpc(method: string): Promise<unknown> }) {
  return client.rpc('ping')
}

// planted: code.control-nearmiss-auth (control)
import { auth } from './own-auth'
export function login(user: string) {
  return auth.signIn(user)
}

// planted: code.control-nearmiss-storage (control)
const s3 = { from: (bucket: string) => ({ upload: (key: string) => `${bucket}/${key}` }) }
export const uploaded = s3.from('labels').upload('front.png')

// planted: code.control-nearmiss-realtime (control)
export function joinRoom(socket: { channel(topic: string): unknown }) {
  return socket.channel('room:tasting')
}

// planted: code.control-nearmiss-functions (control)
const registry = { functions: { invoke: (name: string) => name } }
export const invoked = registry.functions.invoke('restock')

// planted: code.control-nearmiss-helper-package (control)
export const sessionFromHelper = getSession

// planted: code.control-nearmiss-rest-syntax (control)
export const searchUrl = '/api/search?select=all'

// planted: code.control-nearmiss-env-names (control)
export const apiBase = process.env.NEXT_PUBLIC_API_URL
export const dbUrl = process.env.DATABASE_URL

// planted: code.control-nearmiss-gateway-paths (control)
export const localRest = 'http://127.0.0.1:8080/v1/rest'
export const versionedRest = '/rest/v2'

// planted: code.control-nearmiss-key-prefix (control)
export const sb_toggle = true

// planted: code.canary-publishable-key (control)
export const embeddedKey = 'sb_publishable_NIGHTWELLCANARY0000000002'
