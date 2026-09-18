/**
 * Facturation électronique — identifiants personnels de la société (Mon
 * entreprise), multi-prestataire (FactPulse, IOPOLE, B2Brouter…). Aucun
 * identifiant ClimaZEN partagé : chaque société colle SES identifiants (son
 * propre abonnement). Même schéma que Trackdéchets (src/lib/trackdechets.ts).
 */

import type { InvoicingProviderId } from './invoicingProviders'

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

export type InvoicingStatus = {
  ok: boolean
  provider: InvoicingProviderId
  hasCredentials: boolean
  email: string
  clientUid: string
  franchiseTva: boolean
  enabled: boolean
  canEdit?: boolean
  error?: string
  code?: string
}

function emptyStatus(error?: string): InvoicingStatus {
  return {
    ok: false,
    provider: 'factpulse',
    hasCredentials: false,
    email: '',
    clientUid: '',
    franchiseTva: false,
    enabled: false,
    error,
  }
}

export async function fetchInvoicingStatus(): Promise<InvoicingStatus | null> {
  const headers = await authHeaders()
  if (!headers.Authorization) return null
  const res = await fetch('/api/invoicing-config', { headers })
  const data = (await res.json()) as InvoicingStatus
  if (!res.ok) return { ...emptyStatus(data.error), code: data.code }
  return data
}

export async function saveInvoicingCredentials(opts: {
  provider: InvoicingProviderId
  email: string
  password: string
  clientUid?: string
  franchiseTva?: boolean
  enabled?: boolean
}): Promise<InvoicingStatus> {
  const headers = await authHeaders()
  if (!headers.Authorization) return emptyStatus('Session requise.')
  const res = await fetch('/api/invoicing-config', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify({
      provider: opts.provider,
      email: opts.email,
      password: opts.password,
      clientUid: opts.clientUid,
      franchiseTva: opts.franchiseTva,
      enabled: opts.enabled,
    }),
  })
  const data = (await res.json()) as InvoicingStatus
  if (!res.ok) return emptyStatus(data.error || `Erreur ${res.status}`)
  return data
}

export async function setInvoicingEnabled(enabled: boolean): Promise<InvoicingStatus> {
  const headers = await authHeaders()
  if (!headers.Authorization) return emptyStatus('Session requise.')
  const res = await fetch('/api/invoicing-config', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify({ enabled }),
  })
  const data = (await res.json()) as InvoicingStatus
  if (!res.ok) return emptyStatus(data.error || `Erreur ${res.status}`)
  return data
}

export async function setInvoicingFranchiseTva(franchiseTva: boolean): Promise<InvoicingStatus> {
  const headers = await authHeaders()
  if (!headers.Authorization) return emptyStatus('Session requise.')
  const res = await fetch('/api/invoicing-config', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify({ franchiseTva }),
  })
  const data = (await res.json()) as InvoicingStatus
  if (!res.ok) return emptyStatus(data.error || `Erreur ${res.status}`)
  return data
}

export async function clearInvoicingCredentials(): Promise<{ ok: boolean; error?: string }> {
  const headers = await authHeaders()
  if (!headers.Authorization) return { ok: false, error: 'Session requise.' }
  const res = await fetch('/api/invoicing-config', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify({ clear: true }),
  })
  const data = (await res.json()) as { ok?: boolean; error?: string }
  if (!res.ok) return { ok: false, error: data.error || `Erreur ${res.status}` }
  return { ok: true }
}

export async function testInvoicingConnection(opts: {
  provider: InvoicingProviderId
  email?: string
  password?: string
  clientUid?: string
}): Promise<{ ok: boolean; valid?: boolean; me?: { email?: string; quota?: unknown }; error?: string }> {
  const headers = await authHeaders()
  if (!headers.Authorization) return { ok: false, error: 'Session requise.' }
  const res = await fetch('/api/invoicing-config', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify({
      test: true,
      provider: opts.provider,
      email: opts.email || undefined,
      password: opts.password || undefined,
      clientUid: opts.clientUid || undefined,
    }),
  })
  const data = (await res.json()) as {
    ok?: boolean
    valid?: boolean
    me?: { email?: string; quota?: unknown }
    error?: string
  }
  if (!res.ok) return { ok: false, error: data.error || `Erreur ${res.status}` }
  return { ok: true, valid: data.valid, me: data.me, error: data.error }
}
