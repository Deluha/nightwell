import { createClient } from '@/lib/supabase/client'

// planted: code.realtime-postgres-changes (tie)
export function watchNotes(onChange: (payload: unknown) => void) {
  const supabase = createClient()
  const channel = supabase
    .channel('notes-feed')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'tasting_notes' },
      onChange
    )
    .subscribe()
  return () => supabase.removeChannel(channel)
}

// planted: code.realtime-broadcast (tie)
export function joinPour(onPour: (payload: unknown) => void) {
  const supabase = createClient()
  const channel = supabase.channel('pour')
  channel
    .on('broadcast', { event: 'pour' }, (message) => onPour(message.payload))
    .subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        channel.send({ type: 'broadcast', event: 'pour', payload: { glass: 1 } })
      }
    })
  return () => supabase.removeChannel(channel)
}

// planted: code.realtime-presence (tie)
export function joinRoom(userId: string, onSync: () => void) {
  const supabase = createClient()
  const channel = supabase.channel('tasting-room')
  channel
    .on('presence', { event: 'sync' }, onSync)
    .subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        await channel.track({ user: userId, online_at: new Date().toISOString() })
      }
    })
  return () => supabase.removeChannel(channel)
}

// planted: code.realtime-private-channel (tie)
export function joinPrivateRoom(cellarId: string) {
  const supabase = createClient()
  return supabase.channel(`cellar:${cellarId}`, { config: { private: true } }).subscribe()
}
