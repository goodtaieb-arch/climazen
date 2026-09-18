/**
 * Identifiants facturation électronique par société, multi-prestataire.
 * Jamais lisibles que par le serveur (service role) — mot de passe/clé
 * jamais renvoyés en clair au client. Une société n'a qu'un seul prestataire
 * actif à la fois (organization_id est la clé primaire) : changer de
 * prestataire écrase les identifiants précédents, comme changer d'abonnement.
 */

import { normalizeInvoicingProvider } from './invoicingProviders.js'

/** Nettoie un collage mobile (espaces, guillemets, caractères invisibles). */
export function sanitizeCredentialPaste(raw) {
  return String(raw || '')
    .replace(/^﻿/, '')
    .replace(/[​-‍﻿]/g, '')
    .trim()
    .replace(/^["'`]+|["'`]+$/g, '')
    .trim()
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/** @returns {{ ok: true, email: string } | { ok: false, error: string }} */
export function parseInvoicingEmail(raw) {
  const email = sanitizeCredentialPaste(raw).toLowerCase()
  if (!email) return { ok: false, error: 'Email vide.' }
  if (!EMAIL_RE.test(email)) return { ok: false, error: 'Email invalide.' }
  return { ok: true, email }
}

/** @returns {{ ok: true, password: string } | { ok: false, error: string }} */
export function parseInvoicingPassword(raw) {
  const password = sanitizeCredentialPaste(raw)
  if (!password) return { ok: false, error: 'Mot de passe vide.' }
  if (password.length > 512) return { ok: false, error: 'Mot de passe invalide (trop long).' }
  return { ok: true, password }
}

/** client_uid optionnel — pas de format imposé (UUID en pratique chez FactPulse). */
export function parseInvoicingClientUid(raw) {
  const clientUid = sanitizeCredentialPaste(raw)
  if (!clientUid) return { ok: true, clientUid: '' }
  if (clientUid.length > 128) return { ok: false, error: 'client_uid invalide (trop long).' }
  return { ok: true, clientUid }
}

async function restSelect(orgId, select) {
  const { supabaseRest } = await import('./supabaseServer.js')
  const id = String(orgId || '').trim()
  if (!id) return null
  const rows = await supabaseRest(
    `organization_invoicing_secrets?organization_id=eq.${encodeURIComponent(id)}&select=${select}&limit=1`,
  )
  return rows?.[0] || null
}

/**
 * @returns {{ provider: string, hasCredentials: boolean, email: string,
 *   clientUid: string, franchiseTva: boolean, enabled: boolean }}
 */
export async function fetchOrgInvoicingStatus(orgId) {
  const row = await restSelect(orgId, 'provider,email,password,client_uid,api_key,franchise_tva,enabled')
  const password = String(row?.password || '').trim()
  const apiKey = String(row?.api_key || '').trim()
  return {
    provider: normalizeInvoicingProvider(row?.provider),
    hasCredentials: Boolean((String(row?.email || '').trim() && password) || apiKey),
    email: String(row?.email || '').trim(),
    clientUid: String(row?.client_uid || '').trim(),
    franchiseTva: Boolean(row?.franchise_tva),
    enabled: Boolean(row?.enabled),
  }
}

/** Identifiants en clair — usage serveur uniquement (appel API du prestataire). */
export async function fetchOrgInvoicingCredentials(orgId) {
  const row = await restSelect(orgId, 'provider,email,password,client_uid,api_key,enabled')
  const email = String(row?.email || '').trim()
  const password = String(row?.password || '').trim()
  const clientUid = String(row?.client_uid || '').trim()
  const apiKey = String(row?.api_key || '').trim()
  return {
    provider: normalizeInvoicingProvider(row?.provider),
    email: email || null,
    password: password || null,
    clientUid,
    apiKey: apiKey || null,
    enabled: Boolean(row?.enabled),
  }
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
    `organization_invoicing_secrets?organization_id=eq.${encodeURIComponent(orgId)}&select=organization_id&limit=1`,
  )
  if (existing?.[0]) {
    await supabaseRest(
      `organization_invoicing_secrets?organization_id=eq.${encodeURIComponent(orgId)}`,
      { method: 'PATCH', body: JSON.stringify(payload), prefer: 'return=minimal' },
    )
  } else {
    await supabaseRest('organization_invoicing_secrets', {
      method: 'POST',
      body: JSON.stringify(payload),
      prefer: 'return=minimal',
    })
  }
}

/**
 * Enregistre les identifiants pour un prestataire donné. Changer de
 * prestataire remplace les identifiants du précédent (une société = un
 * prestataire actif à la fois).
 */
export async function upsertOrgInvoicingCredentials(orgId, raw, actorUserId) {
  const provider = normalizeInvoicingProvider(raw.provider)

  const email = parseInvoicingEmail(raw.email)
  if (!email.ok) return email
  const password = parseInvoicingPassword(raw.password)
  if (!password.ok) return password
  const clientUid = parseInvoicingClientUid(raw.clientUid)
  if (!clientUid.ok) return clientUid

  const patch = {
    provider,
    email: email.email,
    password: password.password,
    client_uid: clientUid.clientUid || null,
  }
  if (typeof raw.franchiseTva === 'boolean') patch.franchise_tva = raw.franchiseTva
  await upsertRow(orgId, patch, actorUserId)
  return { ok: true, provider, email: email.email, clientUid: clientUid.clientUid }
}

export async function setOrgInvoicingFranchiseTva(orgId, franchiseTva, actorUserId) {
  await upsertRow(orgId, { franchise_tva: Boolean(franchiseTva) }, actorUserId)
  return { ok: true, franchiseTva: Boolean(franchiseTva) }
}

export async function setOrgInvoicingEnabled(orgId, enabled, actorUserId) {
  if (enabled) {
    const status = await fetchOrgInvoicingStatus(orgId)
    if (!status.hasCredentials) {
      return { ok: false, error: 'Enregistrez d’abord des identifiants valides.' }
    }
  }
  await upsertRow(orgId, { enabled: Boolean(enabled) }, actorUserId)
  return { ok: true, enabled: Boolean(enabled) }
}

export async function clearOrgInvoicingCredentials(orgId, actorUserId) {
  await upsertRow(
    orgId,
    { email: null, password: null, client_uid: null, api_key: null, enabled: false },
    actorUserId,
  )
  return { ok: true }
}
