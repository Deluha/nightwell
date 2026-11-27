'use client'

import { useEffect, useState } from 'react'
import { useSupabase } from '../../lib/db/context'

export function MemberCount() {
  const [count, setCount] = useState(0)
  // planted: code.hard-context-hook (tie)
  const query = useSupabase().from('members').select()

  useEffect(() => {
    query.then(({ data }) => setCount(data?.length ?? 0))
  }, [query])

  return <p>{count} members</p>
}
