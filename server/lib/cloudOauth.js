/**
 * OAuth2 cloud société — Google Drive et Microsoft OneDrive / SharePoint.
 *
 * Flux : « Connecter » (POST authentifié) → état anti-CSRF + PKCE en base →
 * redirection vers le fournisseur → /api/auth/{google|microsoft}/callback →
 * échange du code → refresh_token chiffré dans organization_cloud_connections.
 *
 * Le refresh_token ne repasse JAMAIS côté navigateur.
 */

import { createHash, randomBytes } from 'node:crypto'
import { supabaseRest } from './supabaseServer.js'
import { decryptSecret, encryptSecret } from './secretBox.js'

export const CLOUD_PROVIDERS = ['google', 'microsoft']

/** Scope demandé à Google : création / gestion des seuls fichiers ClimaZEN. */
export const GOOGLE_DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.file'

/** Scopes Microsoft Entra ID (Azure AD) — OneDrive et SharePoint. */
export const MICROSOFT_SCOPES = ['Files.ReadWrite.All', 'offline_access']

export const OAUTH_STATE_TTL_MS = 10 * 60 * 1000

const STATE_TABLE = 'cloud_oauth_states'
const CONNECTION_TABLE = 'organization_cloud_connections'

export function normalizeCloudProvider(raw) {
  const p = String(raw || '').trim().toLowerCase()
  if (p === 'google' || p === 'drive' || p === 'google-drive') return 'google'
  if (p === 'microsoft' || p === 'onedrive' || p === 'sharepoint' || p === 'ms') return 'microsoft'
  return ''
}

export function cloudProviderLabel(provider) {
  if (provider === 'google') return 'Google Drive'
  if (provider === 'microsoft') return 'OneDrive / SharePoint'
  return 'Cloud'
}

export function microsoftTenant() {
  const tenant = String(process.env.MICROSOFT_TENANT_ID || process.env.AZURE_TENANT_ID || '').trim()
  return tenant || 'common'
}

/**
 * Base publique utilisée pour redirect_uri. Doit correspondre EXACTEMENT à
 * l’URI déclarée chez Google / Microsoft, sinon le fournisseur refuse.
 */
export function publicBaseUrl(req) {
  const configured = String(process.env.CLOUD_OAUTH_REDIRECT_BASE || process.env.PUBLIC_BASE_URL || '')
    .trim()
    .replace(/\/+$/, '')
  if (configured) return configured
  const host = String(req?.headers?.['x-forwarded-host'] || req?.headers?.host || '').trim()
  if (!host) return 'https://climazen.fr'
  const proto = String(req?.headers?.['x-forwarded-proto'] || 'https')
    .split(',')[0]
    .trim()
  return `${proto || 'https'}://${host}`
}

export function redirectUriFor(provider, req) {
  return `${publicBaseUrl(req)}/api/auth/${provider}/callback`
}

/** Premier nom d’variable renseigné — tolère les nommages usuels sur Vercel. */
function envAny(names) {
  for (const name of names) {
    const value = String(process.env[name] || '').trim()
    if (value) return value
  }
  return ''
}

const PROVIDER_ENV = {
  google: {
    id: ['GOOGLE_OAUTH_CLIENT_ID', 'GOOGLE_CLIENT_ID'],
    secret: ['GOOGLE_OAUTH_CLIENT_SECRET', 'GOOGLE_CLIENT_SECRET'],
  },
  microsoft: {
    id: ['MICROSOFT_OAUTH_CLIENT_ID', 'MICROSOFT_CLIENT_ID', 'AZURE_CLIENT_ID'],
    secret: ['MICROSOFT_OAUTH_CLIENT_SECRET', 'MICROSOFT_CLIENT_SECRET', 'AZURE_CLIENT_SECRET'],
  },
}

/** @returns {{ ok: true, clientId: string, clientSecret: string } | { ok: false, error: string }} */
export function providerCredentials(provider) {
  const names = PROVIDER_ENV[provider]
  if (!names) return { ok: false, error: 'Fournisseur cloud inconnu.' }

  const clientId = envAny(names.id)
  const clientSecret = envAny(names.secret)
  if (clientId && clientSecret) return { ok: true, clientId, clientSecret }

  // Dire lequel des deux manque : sur Vercel, l’oubli le plus courant est le
  // secret, ou une variable ajoutée sans cocher l’environnement Production.
  const manquant = !clientId && !clientSecret
    ? `${names.id[0]} et ${names.secret[0]}`
    : !clientId
      ? names.id[0]
      : names.secret[0]
  return {
    ok: false,
    error: `${cloudProviderLabel(provider)} non configuré côté serveur : ${manquant} absent sur Vercel (environnement Production coché ?), puis Redeploy.`,
  }
}

export function tokenEndpoint(provider) {
  if (provider === 'google') return 'https://oauth2.googleapis.com/token'
  return `https://login.microsoftonline.com/${microsoftTenant()}/oauth2/v2.0/token`
}

export function scopesFor(provider) {
  return provider === 'google' ? [GOOGLE_DRIVE_SCOPE] : [...MICROSOFT_SCOPES]
}

export function createPkcePair() {
  const verifier = randomBytes(48).toString('base64url')
  const challenge = createHash('sha256').update(verifier).digest('base64url')
  return { verifier, challenge }
}

/** Chemin de retour dans l’app après le callback (jamais une URL externe). */
export function safeRedirectPath(raw) {
  const p = String(raw || '').trim()
  if (!p.startsWith('/') || p.startsWith('//') || p.includes('\\')) return '/app/operateur'
  if (!p.startsWith('/app/')) return '/app/operateur'
  return p.slice(0, 200)
}

export function buildAuthorizeUrl(opts) {
  const { provider, clientId, redirectUri, state, codeChallenge } = opts
  if (provider === 'google') {
    const u = new URL('https://accounts.google.com/o/oauth2/v2/auth')
    u.searchParams.set('client_id', clientId)
    u.searchParams.set('redirect_uri', redirectUri)
    u.searchParams.set('response_type', 'code')
    u.searchParams.set('scope', GOOGLE_DRIVE_SCOPE)
    // access_type=offline + prompt=consent : indispensables pour obtenir un refresh_token
    u.searchParams.set('access_type', 'offline')
    u.searchParams.set('prompt', 'consent')
    u.searchParams.set('include_granted_scopes', 'true')
    u.searchParams.set('state', state)
    u.searchParams.set('code_challenge', codeChallenge)
    u.searchParams.set('code_challenge_method', 'S256')
    return u.href
  }
  const u = new URL(
    `https://login.microsoftonline.com/${microsoftTenant()}/oauth2/v2.0/authorize`,
  )
  u.searchParams.set('client_id', clientId)
  u.searchParams.set('redirect_uri', redirectUri)
  u.searchParams.set('response_type', 'code')
  u.searchParams.set('response_mode', 'query')
  u.searchParams.set('scope', MICROSOFT_SCOPES.join(' '))
  u.searchParams.set('prompt', 'consent')
  u.searchParams.set('state', state)
  u.searchParams.set('code_challenge', codeChallenge)
  u.searchParams.set('code_challenge_method', 'S256')
  return u.href
}

// ---------------------------------------------------------------------------
// État anti-CSRF (table dédiée : le callback arrive sans session Supabase)
// ---------------------------------------------------------------------------

export async function createOauthState(opts) {
  const state = randomBytes(32).toString('base64url')
  const { verifier, challenge } = createPkcePair()
  await supabaseRest(STATE_TABLE, {
    method: 'POST',
    prefer: 'return=minimal',
    body: JSON.stringify({
      state,
      provider: opts.provider,
      organization_id: opts.orgId,
      user_id: opts.userId,
      code_verifier: verifier,
      redirect_path: safeRedirectPath(opts.redirectPath),
      expires_at: new Date(Date.now() + OAUTH_STATE_TTL_MS).toISOString(),
    }),
  })
  return { state, codeChallenge: challenge }
}

/** Consomme l’état une seule fois : rejoué → refusé. */
export async function consumeOauthState(state, provider) {
  const key = String(state || '').trim()
  if (!key || key.length > 200) return { ok: false, error: 'state_invalid' }
  const rows = await supabaseRest(
    `${STATE_TABLE}?state=eq.${encodeURIComponent(key)}&select=state,provider,organization_id,user_id,code_verifier,redirect_path,expires_at,consumed_at&limit=1`,
  )
  const row = rows?.[0]
  if (!row) return { ok: false, error: 'state_invalid' }
  await supabaseRest(`${STATE_TABLE}?state=eq.${encodeURIComponent(key)}`, {
    method: 'DELETE',
    prefer: 'return=minimal',
  })
  if (row.consumed_at) return { ok: false, error: 'state_invalid' }
  if (row.provider !== provider) return { ok: false, error: 'state_invalid' }
  if (new Date(row.expires_at).getTime() < Date.now()) return { ok: false, error: 'state_expired' }
  return {
    ok: true,
    orgId: row.organization_id,
    userId: row.user_id,
    codeVerifier: row.code_verifier,
    redirectPath: safeRedirectPath(row.redirect_path),
  }
}

export async function purgeExpiredOauthStates() {
  try {
    await supabaseRest(
      `${STATE_TABLE}?expires_at=lt.${encodeURIComponent(new Date().toISOString())}`,
      { method: 'DELETE', prefer: 'return=minimal' },
    )
  } catch {
    // purge best-effort — ne doit jamais bloquer une connexion
  }
}

// ---------------------------------------------------------------------------
// Échange / rafraîchissement des jetons
// ---------------------------------------------------------------------------

async function postForm(url, params) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(params).toString(),
  })
  const text = await res.text()
  let data = null
  try {
    data = text ? JSON.parse(text) : null
  } catch {
    data = null
  }
  if (!res.ok) {
    const msg =
      data?.error_description || data?.error?.message || data?.error || text || res.statusText
    throw new Error(String(msg).slice(0, 400))
  }
  return data || {}
}

export async function exchangeCodeForTokens(opts) {
  const creds = providerCredentials(opts.provider)
  if (!creds.ok) throw new Error(creds.error)
  const params = {
    client_id: creds.clientId,
    client_secret: creds.clientSecret,
    code: opts.code,
    grant_type: 'authorization_code',
    redirect_uri: opts.redirectUri,
  }
  if (opts.codeVerifier) params.code_verifier = opts.codeVerifier
  if (opts.provider === 'microsoft') params.scope = MICROSOFT_SCOPES.join(' ')
  return postForm(tokenEndpoint(opts.provider), params)
}

export async function refreshAccessToken(provider, refreshToken) {
  const creds = providerCredentials(provider)
  if (!creds.ok) throw new Error(creds.error)
  const params = {
    client_id: creds.clientId,
    client_secret: creds.clientSecret,
    refresh_token: refreshToken,
    grant_type: 'refresh_token',
  }
  if (provider === 'microsoft') params.scope = MICROSOFT_SCOPES.join(' ')
  return postForm(tokenEndpoint(provider), params)
}

// ---------------------------------------------------------------------------
// Stockage société (service role uniquement)
// ---------------------------------------------------------------------------

export async function saveCloudConnection(opts) {
  const now = new Date().toISOString()
  const payload = {
    organization_id: opts.orgId,
    provider: opts.provider,
    refresh_token: encryptSecret(opts.refreshToken),
    access_token: opts.accessToken ? encryptSecret(opts.accessToken) : null,
    access_token_expires_at: opts.accessTokenExpiresAt || null,
    scope: opts.scope || scopesFor(opts.provider).join(' '),
    account_label: (opts.accountLabel || '').slice(0, 200) || null,
    connected_at: now,
    updated_at: now,
    updated_by_user_id: opts.userId || null,
  }
  const existing = await supabaseRest(
    `${CONNECTION_TABLE}?organization_id=eq.${encodeURIComponent(opts.orgId)}&provider=eq.${opts.provider}&select=provider&limit=1`,
  )
  if (existing?.[0]) {
    await supabaseRest(
      `${CONNECTION_TABLE}?organization_id=eq.${encodeURIComponent(opts.orgId)}&provider=eq.${opts.provider}`,
      { method: 'PATCH', body: JSON.stringify(payload), prefer: 'return=minimal' },
    )
  } else {
    await supabaseRest(CONNECTION_TABLE, {
      method: 'POST',
      body: JSON.stringify(payload),
      prefer: 'return=minimal',
    })
  }
}

export async function deleteCloudConnection(orgId, provider) {
  await supabaseRest(
    `${CONNECTION_TABLE}?organization_id=eq.${encodeURIComponent(orgId)}&provider=eq.${provider}`,
    { method: 'DELETE', prefer: 'return=minimal' },
  )
}

async function readConnectionRow(orgId, provider) {
  const rows = await supabaseRest(
    `${CONNECTION_TABLE}?organization_id=eq.${encodeURIComponent(orgId)}&provider=eq.${provider}&select=provider,refresh_token,access_token,access_token_expires_at,scope,account_label,connected_at,updated_at&limit=1`,
  )
  return rows?.[0] || null
}

export async function listCloudConnections(orgId) {
  const rows = await supabaseRest(
    `${CONNECTION_TABLE}?organization_id=eq.${encodeURIComponent(orgId)}&select=provider,refresh_token,scope,account_label,connected_at,updated_at`,
  )
  const out = {}
  for (const provider of CLOUD_PROVIDERS) {
    const row = (rows || []).find((r) => r.provider === provider)
    const token = row ? decryptSecret(row.refresh_token) : ''
    out[provider] = {
      connected: Boolean(token),
      /** true = jeton présent mais illisible (clé de chiffrement changée) → reconnexion */
      needsReconnect: Boolean(row?.refresh_token) && !token,
      accountLabel: row?.account_label || '',
      scope: row?.scope || '',
      connectedAt: row?.connected_at || '',
    }
  }
  return out
}

/** Jeton d’accès frais (rafraîchi si expiré). @returns {Promise<string>} */
export async function getAccessToken(orgId, provider) {
  const row = await readConnectionRow(orgId, provider)
  if (!row) {
    throw new Error(`${cloudProviderLabel(provider)} n’est pas connecté. Cliquez sur « Connecter ».`)
  }
  const cached = decryptSecret(row.access_token)
  const expiresAt = row.access_token_expires_at ? new Date(row.access_token_expires_at).getTime() : 0
  if (cached && expiresAt > Date.now() + 60_000) return cached

  const refreshToken = decryptSecret(row.refresh_token)
  if (!refreshToken) {
    throw new Error(
      `${cloudProviderLabel(provider)} : jeton illisible ou révoqué. Recliquez sur « Connecter ».`,
    )
  }
  const tokens = await refreshAccessToken(provider, refreshToken)
  const accessToken = String(tokens.access_token || '')
  if (!accessToken) {
    throw new Error(`${cloudProviderLabel(provider)} : jeton d’accès refusé par le fournisseur.`)
  }
  const nextExpiry = new Date(Date.now() + Number(tokens.expires_in || 3600) * 1000).toISOString()
  const patch = {
    access_token: encryptSecret(accessToken),
    access_token_expires_at: nextExpiry,
    updated_at: new Date().toISOString(),
  }
  // Google ne renvoie un refresh_token qu’au premier consentement ; Microsoft le fait tourner.
  if (tokens.refresh_token) patch.refresh_token = encryptSecret(String(tokens.refresh_token))
  await supabaseRest(
    `${CONNECTION_TABLE}?organization_id=eq.${encodeURIComponent(orgId)}&provider=eq.${provider}`,
    { method: 'PATCH', body: JSON.stringify(patch), prefer: 'return=minimal' },
  )
  return accessToken
}

export async function hasCloudConnection(orgId, provider) {
  const row = await readConnectionRow(orgId, provider)
  return Boolean(row && decryptSecret(row.refresh_token))
}

// ---------------------------------------------------------------------------
// Libellé du compte connecté (affiché au gérant)
// ---------------------------------------------------------------------------

export async function fetchAccountLabel(provider, accessToken) {
  try {
    if (provider === 'google') {
      // drive.file suffit pour about.get — pas besoin du scope e-mail
      const res = await fetch('https://www.googleapis.com/drive/v3/about?fields=user(displayName,emailAddress)', {
        headers: { Authorization: `Bearer ${accessToken}` },
      })
      if (!res.ok) return ''
      const data = await res.json()
      return String(data?.user?.emailAddress || data?.user?.displayName || '')
    }
    const res = await fetch('https://graph.microsoft.com/v1.0/me/drive?$select=owner,name', {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    if (!res.ok) return ''
    const data = await res.json()
    const user = data?.owner?.user
    return String(user?.email || user?.displayName || data?.name || '')
  } catch {
    return ''
  }
}

/** Message d’erreur du callback → texte lisible par le gérant. */
export function callbackErrorMessage(reason) {
  const map = {
    access_denied:
      'Accès refusé sur la page du fournisseur. Côté Google, un « accès bloqué » signifie que l’écran de consentement OAuth est encore en mode Test.',
    state_invalid: 'Lien de connexion invalide ou déjà utilisé. Relancez « Connecter ».',
    state_expired: 'Lien de connexion expiré (10 minutes). Relancez « Connecter ».',
    no_code: 'Le fournisseur n’a pas renvoyé de code d’autorisation. Relancez « Connecter ».',
    no_refresh_token:
      'Aucun refresh_token renvoyé : révoquez l’accès ClimaZEN dans votre compte cloud puis reconnectez-vous.',
    not_configured: 'Connexion cloud non configurée côté serveur (identifiants OAuth manquants).',
    provider_not_configured:
      'Identifiants OAuth du fournisseur absents sur Vercel. Vérifiez que les variables sont bien cochées pour l’environnement Production, puis Redeploy.',
    supabase_missing:
      'SUPABASE_SERVICE_ROLE_KEY absent sur Vercel : le serveur ne peut pas enregistrer le jeton.',
    sql_missing:
      'Tables cloud absentes : exécutez supabase/cloud-oauth.sql dans Supabase, puis réessayez.',
    exchange_failed: 'Le fournisseur a refusé l’échange du code. Vérifiez l’URI de redirection.',
  }
  return map[String(reason || '')] || 'Connexion cloud impossible. Réessayez.'
}
