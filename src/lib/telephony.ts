/**
 * Configuration téléphonie Lola — client (gérant).
 */

export type TelephonyProvider = 'twilio' | 'vonage' | 'plivo' | 'other'

export type TelephonyConfig = {
  provider: TelephonyProvider
  inboundE164: string
  lolaEnabled: boolean
  managerNotifyEmail?: string
  notes?: string
  updatedAt?: string
}

export type TelephonyConfigResponse = {
  ok: boolean
  configured: boolean
  webhookUrl: string
  config: TelephonyConfig | null
  setupSteps: string[]
}

async function authHeaders(): Promise<Record<string, string>> {
  const { getSupabase, isSupabaseConfigured } = await import('./supabase')
  if (!isSupabaseConfigured()) return {}
  try {
    const sb = getSupabase()
    const { data } = await sb.auth.getSession()
    const token = data.session?.access_token
    if (!token) return {}
    return { Authorization: `Bearer ${token}` }
  } catch {
    return {}
  }
}

export async function fetchTelephonyConfig(): Promise<TelephonyConfigResponse | null> {
  const headers = await authHeaders()
  if (!headers.Authorization) return null
  const res = await fetch('/api/telephony-config', { headers })
  if (!res.ok) return null
  return res.json() as Promise<TelephonyConfigResponse>
}

export async function saveTelephonyConfig(input: {
  inboundNumber: string
  provider: TelephonyProvider
  lolaEnabled: boolean
  managerNotifyEmail?: string
  notes?: string
}): Promise<{ ok: boolean; error?: string; inboundE164?: string; setupSteps?: string[] }> {
  const headers = await authHeaders()
  if (!headers.Authorization) {
    return { ok: false, error: 'Session requise.' }
  }
  const res = await fetch('/api/telephony-config', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(input),
  })
  const data = (await res.json()) as {
    ok?: boolean
    error?: string
    inboundE164?: string
    setupSteps?: string[]
  }
  if (!res.ok) return { ok: false, error: data.error || `Erreur ${res.status}` }
  return { ok: true, inboundE164: data.inboundE164, setupSteps: data.setupSteps }
}

/** Fournisseurs compatibles webhook HTTP (comme Twilio). */
export const TELEPHONY_PROVIDERS: Array<{ id: TelephonyProvider; label: string }> = [
  { id: 'twilio', label: 'Twilio (recommandé)' },
  { id: 'vonage', label: 'Vonage' },
  { id: 'plivo', label: 'Plivo' },
  { id: 'other', label: 'Autre (webhook compatible)' },
]
