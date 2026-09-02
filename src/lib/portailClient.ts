/** Portail client GMAO — maintenance passée + ouverture ticket → OT. */

import { getSupabase, isSupabaseConfigured } from './supabase'

export type PortailHistoriqueItem = {
  id: string
  numero: string
  date: string
  action: string
  statut: string
  localisation?: string
}

export type PortailTicketItem = {
  id: string
  localisation: string
  description: string
  statut: string
  otNumero?: string
  createdAt: string
}

export type PortailPublicData = {
  ok: true
  siteNom: string
  clientNom: string
  siteId: string
  historique: PortailHistoriqueItem[]
  tickets: PortailTicketItem[]
}

export type ClientTicketRow = {
  id: string
  organization_id: string
  site_id: string
  portal_token: string
  localisation: string
  description: string
  contact_nom?: string | null
  contact_email?: string | null
  contact_tel?: string | null
  statut: string
  ot_id?: string | null
  ot_numero?: string | null
  created_at: string
}

function randomToken(): string {
  try {
    return crypto.randomUUID().replace(/-/g, '')
  } catch {
    return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 12)}`
  }
}

export function portailLinkUrl(token: string): string {
  const origin =
    typeof window !== 'undefined' ? window.location.origin : 'https://climazen.fr'
  return `${origin}/portail/${encodeURIComponent(token)}`
}

export async function ensureSitePortal(opts: {
  organizationId: string
  siteId: string
  siteNom: string
  clientNom: string
  existingToken?: string
}): Promise<{ token: string; url: string }> {
  if (!isSupabaseConfigured()) {
    const token = opts.existingToken || randomToken()
    return { token, url: portailLinkUrl(token) }
  }
  const sb = getSupabase()
  const token = opts.existingToken?.trim() || randomToken()
  const { error } = await sb.from('site_portals').upsert(
    {
      token,
      organization_id: opts.organizationId,
      site_id: opts.siteId,
      site_nom: opts.siteNom,
      client_nom: opts.clientNom,
      actif: true,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'token' },
  )
  if (error) throw new Error(error.message)
  return { token, url: portailLinkUrl(token) }
}

export async function setSitePortalActif(token: string, actif: boolean): Promise<void> {
  if (!isSupabaseConfigured() || !token) return
  const sb = getSupabase()
  await sb.from('site_portals').update({ actif, updated_at: new Date().toISOString() }).eq('token', token)
}

export async function fetchPortailPublic(
  token: string,
): Promise<{ ok: true; data: PortailPublicData } | { ok: false; error: string }> {
  if (!isSupabaseConfigured()) {
    return { ok: false, error: 'Portail cloud indisponible — le prestataire doit activer Supabase.' }
  }
  const sb = getSupabase()
  const { data, error } = await sb.rpc('get_site_portal_public', { p_token: token })
  if (error) return { ok: false, error: error.message }
  const raw = data as { ok?: boolean; error?: string }
  if (!raw?.ok) return { ok: false, error: raw.error || 'Portail introuvable.' }
  return { ok: true, data: raw as unknown as PortailPublicData }
}

export async function submitTicketPublic(opts: {
  token: string
  localisation: string
  description: string
  contactNom?: string
  contactEmail?: string
  contactTel?: string
}): Promise<{ ok: true; ticketId: string } | { ok: false; error: string }> {
  if (!isSupabaseConfigured()) {
    return { ok: false, error: 'Envoi impossible — service cloud indisponible.' }
  }
  const sb = getSupabase()
  const { data, error } = await sb.rpc('submit_client_ticket_public', {
    p_token: opts.token,
    p_localisation: opts.localisation,
    p_description: opts.description,
    p_contact_nom: opts.contactNom || '',
    p_contact_email: opts.contactEmail || '',
    p_contact_tel: opts.contactTel || '',
  })
  if (error) return { ok: false, error: error.message }
  const raw = data as { ok?: boolean; error?: string; ticketId?: string }
  if (!raw?.ok) return { ok: false, error: raw.error || 'Envoi refusé.' }
  return { ok: true, ticketId: String(raw.ticketId) }
}

export type ProcessClientTicketResult =
  | {
      ok: true
      otId: string
      otNumero: string
      alreadyExists?: boolean
      ot?: import('./ordreTravail').OrdreTravail
      email?: { ok?: boolean; skipped?: boolean; to?: string[] }
    }
  | { ok: false; error: string }

/** Crée l’OT dans org_data cloud + e-mail bureau (API Vercel). */
export async function processClientTicket(opts: {
  ticketId: string
}): Promise<ProcessClientTicketResult> {
  if (!isSupabaseConfigured()) {
    return { ok: false, error: 'Cloud requis pour traiter le ticket.' }
  }
  const sb = getSupabase()
  const { data: sessionData } = await sb.auth.getSession()
  const token = sessionData.session?.access_token
  if (!token) {
    return { ok: false, error: 'Session expirée — reconnectez-vous.' }
  }
  try {
    const res = await fetch('/api/process-client-ticket', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ ticketId: opts.ticketId }),
    })
    const data = (await res.json().catch(() => ({}))) as ProcessClientTicketResult & {
      error?: string
      hint?: string
    }
    if (!res.ok || !data.ok) {
      return {
        ok: false,
        error: data.error || data.hint || `Traitement ticket impossible (${res.status}).`,
      }
    }
    return data
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Traitement ticket impossible.',
    }
  }
}

export async function listNouveauxTicketsOrg(
  organizationId: string,
): Promise<ClientTicketRow[]> {
  if (!isSupabaseConfigured()) return []
  const sb = getSupabase()
  const { data, error } = await sb.rpc('list_client_tickets_org', { p_org_id: organizationId })
  if (error) {
    console.warn('list_client_tickets_org', error.message)
    return []
  }
  return (data || []) as ClientTicketRow[]
}

export async function markTicketTraite(
  ticketId: string,
  otId: string,
  otNumero: string,
): Promise<void> {
  if (!isSupabaseConfigured()) return
  const sb = getSupabase()
  await sb.rpc('mark_client_ticket_traite', {
    p_ticket_id: ticketId,
    p_ot_id: otId,
    p_ot_numero: otNumero,
  })
}
