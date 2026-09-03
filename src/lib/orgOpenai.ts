/**
 * Clé OpenAI de la société — client (gérant).
 */

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

export type OrgOpenaiStatus = {
  ok: boolean
  hasKey: boolean
  hint: string
  canEdit: boolean
  error?: string
  code?: string
}

export async function fetchOrgOpenaiStatus(): Promise<OrgOpenaiStatus | null> {
  const headers = await authHeaders()
  if (!headers.Authorization) return null
  const res = await fetch('/api/ai-org-key', { headers })
  const data = (await res.json()) as OrgOpenaiStatus & { error?: string }
  if (!res.ok) {
    return {
      ok: false,
      hasKey: false,
      hint: '',
      canEdit: false,
      error: data.error,
      code: data.code,
    }
  }
  return {
    ok: true,
    hasKey: Boolean(data.hasKey),
    hint: data.hint || '',
    canEdit: Boolean(data.canEdit),
  }
}

export async function saveOrgOpenaiKey(
  openaiApiKey: string,
): Promise<{ ok: boolean; hint?: string; error?: string }> {
  const headers = await authHeaders()
  if (!headers.Authorization) return { ok: false, error: 'Session requise.' }
  const res = await fetch('/api/ai-org-key', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify({ openaiApiKey }),
  })
  const data = (await res.json()) as { ok?: boolean; hint?: string; error?: string }
  if (!res.ok) return { ok: false, error: data.error || `Erreur ${res.status}` }
  return { ok: true, hint: data.hint }
}

export async function clearOrgOpenaiKey(): Promise<{ ok: boolean; error?: string }> {
  const headers = await authHeaders()
  if (!headers.Authorization) return { ok: false, error: 'Session requise.' }
  const res = await fetch('/api/ai-org-key', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify({ clear: true }),
  })
  const data = (await res.json()) as { ok?: boolean; error?: string }
  if (!res.ok) return { ok: false, error: data.error || `Erreur ${res.status}` }
  return { ok: true }
}
