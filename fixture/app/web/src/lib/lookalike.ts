// Local helpers that share names with SDK methods. Nothing here comes from an SDK package.

class Shelf<T> {
  private readonly rows = new Map<string, T[]>()

  from(name: string) {
    return {
      select: () => this.rows.get(name) ?? [],
    }
  }
}

// planted: code.control-lookalike-map (control)
const supabase = new Shelf<{ id: string }>()
export const shelfRows = supabase.from('bottles').select()

export const copies = Array.from(new Set([1, 2, 3]))

const storage = {
  from(area: string) {
    return {
      list: () => Object.keys(localStorage).filter((key) => key.startsWith(area)),
    }
  },
}

// planted: code.control-lookalike-local-storage (control)
export const localKeys = storage.from('labels').list()

// planted: code.control-lookalike-broadcast (control)
export const tabs = new BroadcastChannel('cellarbook-tabs')

const auth = {
  signOut() {
    sessionStorage.clear()
  },
}

// planted: code.control-lookalike-auth (control)
export function forgetVisitor() {
  auth.signOut()
}
