'use client'

import { createContext, useContext, useState, type ReactNode } from 'react'
import { createClient } from '../supabase/client'

type Db = ReturnType<typeof createClient>

const SupabaseContext = createContext<Db | null>(null)

export function SupabaseProvider({ children }: { children: ReactNode }) {
  const [client] = useState(() => createClient())
  return <SupabaseContext.Provider value={client}>{children}</SupabaseContext.Provider>
}

export function useSupabase(): Db {
  const client = useContext(SupabaseContext)
  if (!client) {
    throw new Error('useSupabase must be used inside SupabaseProvider')
  }
  return client
}
