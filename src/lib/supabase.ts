import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

export function isSupabaseConfigured(): boolean {
  return Boolean(url && anonKey && !url.includes('YOUR_PROJECT') && anonKey !== 'YOUR_ANON_PUBLIC_KEY')
}

/** Storage tolérant Safari (navigation privée / bloqueurs). */
function safeStorage(): Storage {
  try {
    const key = '__cz_test__'
    window.localStorage.setItem(key, '1')
    window.localStorage.removeItem(key)
    return window.localStorage
  } catch {
    try {
      return window.sessionStorage
    } catch {
      const mem = new Map<string, string>()
      return {
        get length() {
          return mem.size
        },
        clear: () => mem.clear(),
        getItem: (k) => mem.get(k) ?? null,
        key: (i) => [...mem.keys()][i] ?? null,
        removeItem: (k) => {
          mem.delete(k)
        },
        setItem: (k, v) => {
          mem.set(k, v)
        },
      }
    }
  }
}

let client: SupabaseClient | null = null

export function getSupabase(): SupabaseClient {
  if (!isSupabaseConfigured()) {
    throw new Error(
      'Supabase non configuré. Créez un fichier .env.local avec VITE_SUPABASE_URL et VITE_SUPABASE_ANON_KEY (voir .env.example).',
    )
  }
  if (!client) {
    client = createClient(url!, anonKey!, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        flowType: 'pkce',
        storage: safeStorage(),
      },
      global: {
        headers: {
          'X-Client-Info': 'climazen-web',
        },
      },
    })
  }
  return client
}
