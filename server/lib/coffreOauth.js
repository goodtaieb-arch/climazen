/**
 * OAuth coffre (Google Drive / Microsoft Graph).
 * Le refresh token reste côté serveur — le navigateur n’ouvre que la page d’autorisation.
 */

import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto'
import {
  loadCoffreConfig,
  resolveGdriveOAuthClient,
  resolveGraphOAuthClient,
  saveCoffreConfig,
} from './coffreSecretsStore.js'

export const GDRIVE_OAUTH_SCOPES = [
  'https://www.googleapis.com/auth/drive.file',
  'https://www.googleapis.com/auth/userinfo.email',
].join(' ')

export const GRAPH_OAUTH_SCOPES = 'offline_access Files.ReadWrite User.Read'

const STATE_TTL_MS = 15 * 60 * 1000

export function oauthStateSecret() {
  return String(
    process.env.CLIMAZEN_OAUTH_STATE_SECRET ||
      process.env.SUPABASE_SERVICE_ROLE_KEY ||
      process.env.CRON_SECRET ||
      '',
  ).trim()
}

function b64url(buf) {
  return Buffer.from(buf)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '')
}

function fromB64url(s) {
  const pad = s.length % 4 === 0 ? '' : '='.repeat(4 - (s.length % 4))
  return Buffer.from(String(s).replace(/-/g, '+').replace(/_/g, '/') + pad, 'base64')
}

export function publicOrigin(req) {
  const proto = String(req.headers['x-forwarded-proto'] || 'https')
    .split(',')[0]
    .trim()
  const host = String(req.headers['x-forwarded-host'] || req.headers.host || '')
    .split(',')[0]
    .trim()
  if (!host) return 'https://climazen.fr'
  const scheme = proto === 'http' ? 'http' : 'https'
  return `${scheme}://${host}`
}

export function oauthCallbackUrl(req) {
  return `${publicOrigin(req)}/api/oauth/cloud`
}

export function appOperateurUrl(req, query) {
  const q = new URLSearchParams(query || {}).toString()
  return `${publicOrigin(req)}/app/operateur${q ? `?${q}` : ''}`
}

export function signOAuthState(payload, secret = oauthStateSecret()) {
  if (!secret) throw new Error('Secret d’état OAuth manquant (CLIMAZEN_OAUTH_STATE_SECRET).')
  const body = b64url(JSON.stringify(payload))
  const sig = b64url(createHmac('sha256', secret).update(body).digest())
  return `${body}.${sig}`
}

export function verifyOAuthState(raw, secret = oauthStateSecret()) {
  if (!secret) return { ok: false, error: 'Secret d’état OAuth manquant.' }
  const text = String(raw || '')
  const dot = text.lastIndexOf('.')
  if (dot < 8) return { ok: false, error: 'État OAuth invalide.' }
  const body = text.slice(0, dot)
  const sig = text.slice(dot + 1)
  const expected = b64url(createHmac('sha256', secret).update(body).digest())
  const a = Buffer.from(sig)
  const b = Buffer.from(expected)
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return { ok: false, error: 'État OAuth falsifié.' }
  }
  let payload
  try {
    payload = JSON.parse(fromB64url(body).toString('utf8'))
  } catch {
    return { ok: false, error: 'État OAuth illisible.' }
  }
  const iat = Number(payload?.iat) || 0
  if (!iat || Date.now() - iat > STATE_TTL_MS) {
    return { ok: false, error: 'Autorisation expirée — recommencez.' }
  }
  const provider = payload.provider === 'onedrive' ? 'onedrive' : payload.provider === 'gdrive' ? 'gdrive' : ''
  if (!provider || !payload.orgId || !payload.userId) {
    return { ok: false, error: 'État OAuth incomplet.' }
  }
  return { ok: true, payload: { ...payload, provider } }
}

export function oauthReadiness(cfg = {}) {
  const g = resolveGdriveOAuthClient(cfg)
  const m = resolveGraphOAuthClient(cfg)
  return {
    gdrive: {
      ready: Boolean(g.clientId && g.clientSecret),
      platform: Boolean(String(process.env.CLIMAZEN_GDRIVE_CLIENT_ID || '').trim()),
      connected: Boolean(String(cfg.gdriveRefreshToken || '').trim()),
      email: String(cfg.gdriveAccountEmail || '').trim() || null,
    },
    onedrive: {
      ready: Boolean(m.clientId && m.clientSecret),
      platform: Boolean(String(process.env.CLIMAZEN_MS_CLIENT_ID || '').trim()),
      connected: Boolean(String(cfg.graphRefreshToken || '').trim()),
      email: String(cfg.graphAccountEmail || '').trim() || null,
    },
  }
}

export function googleAuthorizeUrl({ clientId, redirectUri, state }) {
  const u = new URL('https://accounts.google.com/o/oauth2/v2/auth')
  u.searchParams.set('client_id', clientId)
  u.searchParams.set('redirect_uri', redirectUri)
  u.searchParams.set('response_type', 'code')
  u.searchParams.set('scope', GDRIVE_OAUTH_SCOPES)
  u.searchParams.set('access_type', 'offline')
  u.searchParams.set('prompt', 'consent')
  u.searchParams.set('include_granted_scopes', 'true')
  u.searchParams.set('state', state)
  return u.toString()
}

export function microsoftAuthorizeUrl({ clientId, tenant, redirectUri, state }) {
  const t = tenant || 'common'
  const u = new URL(`https://login.microsoftonline.com/${encodeURIComponent(t)}/oauth2/v2.0/authorize`)
  u.searchParams.set('client_id', clientId)
  u.searchParams.set('redirect_uri', redirectUri)
  u.searchParams.set('response_type', 'code')
  u.searchParams.set('response_mode', 'query')
  u.searchParams.set('scope', GRAPH_OAUTH_SCOPES)
  u.searchParams.set('state', state)
  u.searchParams.set('prompt', 'select_account')
  return u.toString()
}

export async function buildAuthorizeUrl(req, opts) {
  const provider = opts.provider === 'onedrive' ? 'onedrive' : 'gdrive'
  const cfg = await loadCoffreConfig(opts.orgId)
  const redirectUri = oauthCallbackUrl(req)
  const state = signOAuthState({
    orgId: opts.orgId,
    userId: opts.userId,
    provider,
    iat: Date.now(),
    nonce: randomBytes(12).toString('hex'),
  })
  if (provider === 'gdrive') {
    const { clientId, clientSecret } = resolveGdriveOAuthClient(cfg)
    if (!clientId || !clientSecret) {
      return {
        ok: false,
        error:
          'Google Drive : collez d’abord le client ID et le secret (console Google), ou configurez CLIMAZEN_GDRIVE_CLIENT_ID sur Vercel.',
      }
    }
    return { ok: true, url: googleAuthorizeUrl({ clientId, redirectUri, state }), provider }
  }
  const { clientId, clientSecret, tenant } = resolveGraphOAuthClient(cfg)
  if (!clientId || !clientSecret) {
    return {
      ok: false,
      error:
        'OneDrive : collez d’abord l’ID Azure et le secret, ou configurez CLIMAZEN_MS_CLIENT_ID sur Vercel.',
    }
  }
  return {
    ok: true,
    url: microsoftAuthorizeUrl({ clientId, tenant, redirectUri, state }),
    provider,
  }
}

async function exchangeGoogleCode({ cfg, code, redirectUri }) {
  const { clientId, clientSecret } = resolveGdriveOAuthClient(cfg)
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    }),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok || !data.refresh_token) {
    const hint = data.error_description || data.error || `HTTP ${res.status}`
    throw new Error(
      `Google n’a pas renvoyé de jeton durable (${hint}). Réessayez et acceptez toutes les cases.`,
    )
  }
  return data
}

async function exchangeMicrosoftCode({ cfg, code, redirectUri }) {
  const { clientId, clientSecret, tenant } = resolveGraphOAuthClient(cfg)
  const res = await fetch(
    `https://login.microsoftonline.com/${encodeURIComponent(tenant)}/oauth2/v2.0/token`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
        scope: GRAPH_OAUTH_SCOPES,
      }),
    },
  )
  const data = await res.json().catch(() => ({}))
  if (!res.ok || !data.refresh_token) {
    const hint = data.error_description || data.error || `HTTP ${res.status}`
    throw new Error(`Microsoft n’a pas renvoyé de jeton durable (${hint}).`)
  }
  return data
}

async function googleAccountMeta(accessToken) {
  const out = { email: '', folderId: '' }
  try {
    const me = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    const data = await me.json().catch(() => ({}))
    out.email = String(data.email || '').trim()
  } catch {
    /* ignore */
  }
  try {
    const q = encodeURIComponent(
      "name = 'ClimaZEN' and mimeType = 'application/vnd.google-apps.folder' and trashed = false and 'root' in parents",
    )
    const list = await fetch(
      `https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id,name)&pageSize=1`,
      { headers: { Authorization: `Bearer ${accessToken}` } },
    )
    const data = await list.json().catch(() => ({}))
    if (data.files?.[0]?.id) {
      out.folderId = data.files[0].id
    } else {
      const created = await fetch('https://www.googleapis.com/drive/v3/files', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: 'ClimaZEN',
          mimeType: 'application/vnd.google-apps.folder',
        }),
      })
      const folder = await created.json().catch(() => ({}))
      if (folder.id) out.folderId = folder.id
    }
  } catch {
    /* racine Drive */
  }
  return out
}

async function microsoftAccountMeta(accessToken) {
  const out = { email: '', driveId: '' }
  try {
    const me = await fetch('https://graph.microsoft.com/v1.0/me?$select=userPrincipalName,mail', {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    const data = await me.json().catch(() => ({}))
    out.email = String(data.mail || data.userPrincipalName || '').trim()
  } catch {
    /* ignore */
  }
  try {
    const drive = await fetch('https://graph.microsoft.com/v1.0/me/drive', {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    const data = await drive.json().catch(() => ({}))
    if (data.id) out.driveId = data.id
  } catch {
    /* /me/drive sans id */
  }
  return out
}

export async function completeOAuthCallback(req, opts) {
  const { orgId, userId, provider, code } = opts
  const cfg = await loadCoffreConfig(orgId)
  const redirectUri = oauthCallbackUrl(req)
  if (provider === 'gdrive') {
    const tokens = await exchangeGoogleCode({ cfg, code, redirectUri })
    const meta = await googleAccountMeta(tokens.access_token)
    const saved = await saveCoffreConfig(
      orgId,
      {
        docsDestCloud: true,
        cloudProvider: 'gdrive',
        gdriveRefreshToken: tokens.refresh_token,
        gdriveAccountEmail: meta.email || undefined,
        gdriveFolderId: cfg.gdriveFolderId || meta.folderId || undefined,
      },
      userId,
    )
    if (!saved.ok) throw new Error(saved.error || 'Enregistrement du jeton Google impossible.')
    return { ok: true, provider, email: meta.email }
  }
  const tokens = await exchangeMicrosoftCode({ cfg, code, redirectUri })
  const meta = await microsoftAccountMeta(tokens.access_token)
  const saved = await saveCoffreConfig(
    orgId,
    {
      docsDestCloud: true,
      cloudProvider: 'onedrive',
      graphRefreshToken: tokens.refresh_token,
      graphAccountEmail: meta.email || undefined,
      graphDriveId: cfg.graphDriveId || meta.driveId || undefined,
      graphTenantId: resolveGraphOAuthClient(cfg).tenant,
    },
    userId,
  )
  if (!saved.ok) throw new Error(saved.error || 'Enregistrement du jeton Microsoft impossible.')
  return { ok: true, provider, email: meta.email }
}
