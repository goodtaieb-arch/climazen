/**
 * Jeton API Trackdéchets par société (création automatique des BSFF).
 * Jamais lisible que par le serveur (service role) — jamais renvoyé en clair au client.
 */

/** Nettoie un collage mobile (espaces, guillemets, Bearer, caractères invisibles). */
export function sanitizeTokenPaste(raw) {
  return String(raw || '')
    .replace(/^﻿/, '')
    .replace(/[​-‍﻿]/g, '')
    .trim()
    .replace(/^Bearer\s+/i, '')
    .replace(/^["'`]+|["'`]+$/g, '')
    .replace(/["'`]/g, '')
    .trim()
}

export function maskToken(raw) {
  const token = sanitizeTokenPaste(raw)
  if (token.length < 8) return ''
  return `…${token.slice(-4)}`
}

/** @returns {{ ok: true, token: string } | { ok: false, error: string }} */
export function parseTrackdechetsToken(raw) {
  const token = sanitizeTokenPaste(raw)
  if (!token) return { ok: false, error: 'Jeton vide.' }
  if (token.length < 20 || token.length > 1024) {
    return { ok: false, error: 'Jeton Trackdéchets invalide (longueur).' }
  }
  return { ok: true, token }
}

async function restSelect(orgId, select) {
  const { supabaseRest } = await import('./supabaseServer.js')
  const id = String(orgId || '').trim()
  if (!id) return null
  const rows = await supabaseRest(
    `organization_trackdechets_secrets?organization_id=eq.${encodeURIComponent(id)}&select=${select}&limit=1`,
  )
  return rows?.[0] || null
}

/** @returns {{ hasToken: boolean, hint: string, enabled: boolean }} */
export async function fetchOrgTrackdechetsStatus(orgId) {
  const row = await restSelect(orgId, 'api_token,api_token_hint,enabled')
  const token = String(row?.api_token || '').trim()
  return {
    hasToken: Boolean(token),
    hint: String(row?.api_token_hint || '').trim() || (token ? maskToken(token) : ''),
    enabled: Boolean(row?.enabled),
  }
}

/** Jeton en clair — usage serveur uniquement (appel API Trackdéchets). */
export async function fetchOrgTrackdechetsToken(orgId) {
  const row = await restSelect(orgId, 'api_token,enabled')
  const token = String(row?.api_token || '').trim()
  return { token: token || null, enabled: Boolean(row?.enabled) }
}

async function upsertRow(orgId, patch, actorUserId) {
  const { supabaseRest } = await import('./supabaseServer.js')
  const payload = {
    organization_id: orgId,
    ...patch,
    updated_at: new Date().toISOString(),
    updated_by_user_id: actorUserId || null,
  }
  const existing = await supabaseRest(
    `organization_trackdechets_secrets?organization_id=eq.${encodeURIComponent(orgId)}&select=organization_id&limit=1`,
  )
  if (existing?.[0]) {
    await supabaseRest(
      `organization_trackdechets_secrets?organization_id=eq.${encodeURIComponent(orgId)}`,
      { method: 'PATCH', body: JSON.stringify(payload), prefer: 'return=minimal' },
    )
  } else {
    await supabaseRest('organization_trackdechets_secrets', {
      method: 'POST',
      body: JSON.stringify(payload),
      prefer: 'return=minimal',
    })
  }
}

export async function upsertOrgTrackdechetsToken(orgId, rawToken, actorUserId) {
  const parsed = parseTrackdechetsToken(rawToken)
  if (!parsed.ok) return parsed
  const hint = maskToken(parsed.token)
  await upsertRow(orgId, { api_token: parsed.token, api_token_hint: hint }, actorUserId)
  return { ok: true, hint }
}

export async function setOrgTrackdechetsEnabled(orgId, enabled, actorUserId) {
  if (enabled) {
    const status = await fetchOrgTrackdechetsStatus(orgId)
    if (!status.hasToken) {
      return { ok: false, error: 'Enregistrez d’abord un jeton Trackdéchets valide.' }
    }
  }
  await upsertRow(orgId, { enabled: Boolean(enabled) }, actorUserId)
  return { ok: true, enabled: Boolean(enabled) }
}

export async function clearOrgTrackdechetsToken(orgId, actorUserId) {
  await upsertRow(
    orgId,
    { api_token: null, api_token_hint: null, enabled: false },
    actorUserId,
  )
  return { ok: true }
}
