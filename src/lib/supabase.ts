import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

export function isSupabaseConfigured(): boolean {
  return Boolean(url && anonKey && !url.includes('YOUR_PROJECT') && anonKey !== 'YOUR_ANON_PUBLIC_KEY')
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
      },
    })
  }
  return client
}
