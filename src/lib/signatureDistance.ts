/** Signature à distance — client absent (lien SMS / e-mail). */

import { getSupabase, isSupabaseConfigured } from './supabase'

export type SignatureRequestPublic = {
  ok: true
  siteNom: string
  clientNom: string
  nomPrefill: string
  qualitePrefill: string
  createdByName: string
  expiresAt: string
}

export type SignatureRequestRow = {
  id: string
  token: string
  organization_id: string
  site_id: string
  client_id?: string | null
  ot_id?: string | null
  site_nom?: string | null
  client_nom?: string | null
  nom_prefill?: string | null
  qualite_prefill?: string | null
  created_by_name?: string | null
  expires_at: string
  used_at?: string | null
  signature_nom?: string | null
  signature_qualite?: string | null
  signature_image?: string | null
  created_at: string
}

function randomToken(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID().replace(/-/g, '')
  }
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 12)}`
}

export function signatureLinkUrl(token: string): string {
  const origin =
    typeof window !== 'undefined' ? window.location.origin : 'https://climazen.fr'
  return `${origin}/signer/${encodeURIComponent(token)}`
}

export async function createSignatureRequest(opts: {
  organizationId: string
  siteId: string
  siteNom?: string
  clientId?: string
  clientNom?: string
  otId?: string
  nomPrefill?: string
  qualitePrefill?: string
  createdByName?: string
  /** Durée de validité en heures (défaut 72 h) */
  expiresHours?: number
}): Promise<{ token: string; url: string; id: string }> {
  if (!isSupabaseConfigured()) {
    throw new Error('Connexion cloud requise pour envoyer un lien de signature.')
  }
  const sb = getSupabase()
  const token = randomToken()
  const hours = opts.expiresHours ?? 72
  const expires = new Date(Date.now() + hours * 3600 * 1000).toISOString()

  const { data, error } = await sb
    .from('signature_requests')
    .insert({
      token,
      organization_id: opts.organizationId,
      site_id: opts.siteId,
      client_id: opts.clientId || null,
      ot_id: opts.otId || null,
      site_nom: opts.siteNom || null,
      client_nom: opts.clientNom || null,
      nom_prefill: opts.nomPrefill || null,
      qualite_prefill: opts.qualitePrefill || 'Représentant client',
      created_by_name: opts.createdByName || null,
      expires_at: expires,
    })
    .select('id, token')
    .single()

  if (error) {
    if (/relation .*signature_requests.* does not exist/i.test(error.message) || error.code === '42P01') {
      throw new Error(
        'Table signature_requests absente — exécutez le SQL supabase/signature-requests.sql dans Supabase.',
      )
    }
    throw new Error(error.message || 'Impossible de créer le lien.')
  }

  return {
    id: data.id as string,
    token: data.token as string,
    url: signatureLinkUrl(data.token as string),
  }
}

export async function fetchSignatureRequestPublic(
  token: string,
): Promise<SignatureRequestPublic | { ok: false; error: string; used?: boolean }> {
  if (!isSupabaseConfigured()) {
    return { ok: false, error: 'Service indisponible.' }
  }
  const sb = getSupabase()
  const { data, error } = await sb.rpc('get_signature_request_public', { p_token: token })
  if (error) {
    return { ok: false, error: error.message || 'Lien invalide.' }
  }
  const row = data as SignatureRequestPublic | { ok: false; error: string; used?: boolean }
  return row
}

export async function submitSignatureRequestPublic(opts: {
  token: string
  nom: string
  qualite: string
  image: string
}): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!isSupabaseConfigured()) {
    return { ok: false, error: 'Service indisponible.' }
  }
  const sb = getSupabase()
  const { data, error } = await sb.rpc('submit_signature_request_public', {
    p_token: opts.token,
    p_nom: opts.nom,
    p_qualite: opts.qualite,
    p_image: opts.image,
  })
  if (error) {
    return { ok: false, error: error.message || 'Envoi impossible.' }
  }
  const row = data as { ok: boolean; error?: string }
  if (!row?.ok) return { ok: false, error: row?.error || 'Envoi impossible.' }
  return { ok: true }
}

/** Demandes signées en attente d’import sur le site (technicien connecté). */
export async function listCompletedSignatureRequests(opts: {
  organizationId: string
  siteId?: string
}): Promise<SignatureRequestRow[]> {
  if (!isSupabaseConfigured()) return []
  const sb = getSupabase()
  let q = sb
    .from('signature_requests')
    .select('*')
    .eq('organization_id', opts.organizationId)
    .not('used_at', 'is', null)
    .not('signature_image', 'is', null)
    .order('used_at', { ascending: false })
    .limit(30)
  if (opts.siteId) q = q.eq('site_id', opts.siteId)
  const { data, error } = await q
  if (error) return []
  return (data || []) as SignatureRequestRow[]
}

export async function listOpenSignatureRequests(opts: {
  organizationId: string
  siteId: string
}): Promise<SignatureRequestRow[]> {
  if (!isSupabaseConfigured()) return []
  const sb = getSupabase()
  const { data, error } = await sb
    .from('signature_requests')
    .select('*')
    .eq('organization_id', opts.organizationId)
    .eq('site_id', opts.siteId)
    .is('used_at', null)
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false })
    .limit(5)
  if (error) return []
  return (data || []) as SignatureRequestRow[]
}

export function mailtoSignatureLink(opts: {
  email?: string
  url: string
  siteNom?: string
  techName?: string
}): string | null {
  const e = (opts.email || '').trim()
  if (!e) return null
  const q = new URLSearchParams()
  q.set('subject', `Signature ClimaZEN — ${opts.siteNom || 'intervention'}`)
  q.set(
    'body',
    [
      'Bonjour,',
      '',
      `${opts.techName || 'Votre technicien'} vous demande de signer à distance (client absent sur site).`,
      '',
      `Ouvrez ce lien sur votre téléphone :`,
      opts.url,
      '',
      'Le lien est valable 72 heures.',
      '',
      'Cordialement',
    ].join('\n'),
  )
  return `mailto:${e}?${q.toString()}`
}

export function smsSignatureBody(opts: { url: string; siteNom?: string }): string {
  return `ClimaZEN — merci de signer pour ${opts.siteNom || 'l’intervention'} : ${opts.url}`
}
