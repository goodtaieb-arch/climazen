/**
 * Santé coffre (NAS + cloud) — badge gérant, sans jetons.
 */

import { getSupabase, isSupabaseConfigured } from './supabase'

export type CoffreHealthDest = {
  ok: boolean
  kind?: string | null
  label?: string | null
  code?: 'network' | 'auth' | 'quota' | 'unknown' | null
  message?: string | null
  since?: string | null
  lastCheckAt?: string | null
}

export type CoffreHealth = {
  synced: boolean
  interrupted: boolean
  since?: string | null
  message: string
  dests?: Record<string, CoffreHealthDest>
  lastCheckAt?: string | null
  configured?: boolean
}

async function authHeaders(): Promise<Record<string, string>> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (!isSupabaseConfigured()) return headers
  try {
    const sb = getSupabase()
    const { data } = await sb.auth.getSession()
    const token = data.session?.access_token
    if (token) headers.Authorization = `Bearer ${token}`
  } catch {
    /* hors ligne */
  }
  return headers
}

export async function fetchCoffreHealth(opts?: { probe?: boolean }): Promise<{
  ok: boolean
  coffreActif?: boolean
  health?: CoffreHealth
  error?: string
}> {
  const headers = await authHeaders()
  if (!headers.Authorization) return { ok: false, error: 'Session requise.' }
  const res = await fetch('/api/documents', {
    method: 'POST',
    headers,
    body: JSON.stringify({ action: 'health', probe: opts?.probe !== false }),
  })
  const data = (await res.json().catch(() => ({}))) as {
    ok?: boolean
    coffreActif?: boolean
    health?: CoffreHealth
    error?: string
    message?: string
  }
  if (!res.ok || !data.ok || !data.health) {
    return { ok: false, error: String(data.error || data.message || 'Santé coffre indisponible.') }
  }
  return {
    ok: true,
    coffreActif: Boolean(data.coffreActif),
    health: data.health,
  }
}
