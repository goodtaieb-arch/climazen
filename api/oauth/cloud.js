/**
 * OAuth coffre — POST start (JWT) / GET callback (code + state).
 * GET /api/oauth/cloud  → { gdrive, onedrive } readiness
 * POST /api/oauth/cloud { provider: 'gdrive'|'onedrive' } → { url }
 * GET  /api/oauth/cloud?code&state  → redirect Mon entreprise
 */

import { authorizeOrgRequest } from '../../server/lib/authorizeOrg.js'
import {
  appOperateurUrl,
  buildAuthorizeUrl,
  completeOAuthCallback,
  oauthReadiness,
  verifyOAuthState,
} from '../../server/lib/coffreOauth.js'
import { loadCoffreConfig } from '../../server/lib/coffreSecretsStore.js'

function cors(res) {
  res.setHeader('Cache-Control', 'no-store')
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
}

function parseBody(req) {
  if (!req.body) return {}
  if (typeof req.body === 'string') {
    try {
      return JSON.parse(req.body || '{}')
    } catch {
      return {}
    }
  }
  return req.body
}

function queryOf(req) {
  return req.query && typeof req.query === 'object' ? req.query : {}
}

export default async function handler(req, res) {
  cors(res)
  if (req.method === 'OPTIONS') {
    res.status(204).end()
    return
  }

  const q = queryOf(req)
  const code = String(q.code || '').trim()
  const state = String(q.state || '').trim()
  const oauthError = String(q.error || '').trim()

  if (req.method === 'GET' && (code || state || oauthError)) {
    const fail = (msg) => {
      res.writeHead(302, { Location: appOperateurUrl(req, { cloud: 'error', msg }) })
      res.end()
    }
    if (oauthError) {
      fail('Autorisation cloud refusée.')
      return
    }
    const verified = verifyOAuthState(state)
    if (!verified.ok) {
      fail(verified.error || 'Autorisation invalide.')
      return
    }
    try {
      await completeOAuthCallback(req, {
        orgId: verified.payload.orgId,
        userId: verified.payload.userId,
        provider: verified.payload.provider,
        code,
      })
      res.writeHead(302, {
        Location: appOperateurUrl(req, { cloud: verified.payload.provider }),
      })
      res.end()
    } catch (err) {
      fail(err instanceof Error ? err.message.slice(0, 180) : 'Échange du jeton impossible.')
    }
    return
  }

  const auth = await authorizeOrgRequest(req)
  if (!auth.ok) {
    res.status(auth.status).json({ ok: false, error: auth.error })
    return
  }
  if (!auth.isOwner) {
    res.status(403).json({ ok: false, error: 'Connexion cloud réservée au gérant.' })
    return
  }

  const cfg = await loadCoffreConfig(auth.orgId)

  if (req.method === 'GET') {
    res.status(200).json({ ok: true, ...oauthReadiness(cfg) })
    return
  }

  if (req.method !== 'POST') {
    res.status(405).json({ ok: false, error: 'GET ou POST requis.' })
    return
  }

  const body = parseBody(req)
  const provider = body.provider === 'onedrive' ? 'onedrive' : 'gdrive'
  const built = await buildAuthorizeUrl(req, {
    orgId: auth.orgId,
    userId: auth.user.id,
    provider,
  })
  if (!built.ok) {
    res.status(400).json({ ok: false, error: built.error })
    return
  }
  res.status(200).json({ ok: true, url: built.url, provider: built.provider })
}
