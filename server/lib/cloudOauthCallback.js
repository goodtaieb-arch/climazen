/**
 * Callback OAuth2 partagé — /api/auth/google/callback et /api/auth/microsoft/callback.
 * Le navigateur arrive ici SANS session Supabase : la société est retrouvée via
 * l’état anti-CSRF créé au clic sur « Connecter ».
 */

import {
  consumeOauthState,
  exchangeCodeForTokens,
  fetchAccountLabel,
  providerCredentials,
  publicBaseUrl,
  purgeExpiredOauthStates,
  redirectUriFor,
  safeRedirectPath,
  saveCloudConnection,
  resolveOrgAppEdition,
  cloudProviderAllowedForEdition,
} from './cloudOauth.js'
import { getSupabaseConfig } from './supabaseServer.js'

function backToApp(res, base, path, params) {
  const url = new URL(`${base}${safeRedirectPath(path)}`)
  for (const [k, v] of Object.entries(params)) {
    if (v) url.searchParams.set(k, String(v))
  }
  res.statusCode = 302
  res.setHeader('Location', url.href)
  res.setHeader('Cache-Control', 'no-store')
  res.end()
}

/** Cause courte et non secrète, affichable telle quelle au gérant. */
function causeCourte(err) {
  const code = String(err?.providerCode || '').trim()
  if (code) return code.slice(0, 60)
  const msg = err instanceof Error ? err.message : String(err || '')
  return msg.replace(/\s+/g, ' ').trim().slice(0, 140)
}

export async function handleOauthCallback(provider, req, res) {
  const base = publicBaseUrl(req)
  let redirectPath = '/app/operateur'

  const fail = (reason, detail) =>
    backToApp(res, base, redirectPath, { cloud: provider, status: 'error', reason, detail })

  try {
    if (req.method !== 'GET') {
      res.statusCode = 405
      return res.end('Method not allowed')
    }

    const query = new URL(req.url || '/', base).searchParams
    if (query.get('error')) {
      const reason = query.get('error') === 'access_denied' ? 'access_denied' : 'exchange_failed'
      return fail(reason)
    }

    const { serviceKey } = getSupabaseConfig()
    if (!serviceKey) return fail('supabase_missing')

    const creds = providerCredentials(provider)
    if (!creds.ok) return fail('provider_not_configured')

    const code = String(query.get('code') || '')
    const state = String(query.get('state') || '')
    if (!code) return fail('no_code')

    const consumed = await consumeOauthState(state, provider)
    if (!consumed.ok) return fail(consumed.error)
    redirectPath = consumed.redirectPath

    const edition = await resolveOrgAppEdition(consumed.orgId)
    if (!cloudProviderAllowedForEdition(edition, provider)) {
      return fail('edition_light')
    }

    let tokens
    try {
      tokens = await exchangeCodeForTokens({
        provider,
        code,
        codeVerifier: consumed.codeVerifier,
        redirectUri: redirectUriFor(provider, req),
      })
    } catch (err) {
      console.error(`oauth-callback:${provider}:exchange`, err)
      return fail('exchange_failed', causeCourte(err))
    }

    const refreshToken = String(tokens.refresh_token || '')
    if (!refreshToken) return fail('no_refresh_token')

    const accessToken = String(tokens.access_token || '')
    const accountLabel = accessToken ? await fetchAccountLabel(provider, accessToken) : ''

    // Jetons valides mais enregistrement impossible : c’est un tout autre
    // problème que l’échange, et il se corrige côté Supabase.
    try {
      await saveCloudConnection({
        orgId: consumed.orgId,
        userId: consumed.userId,
        provider,
        refreshToken,
        accessToken,
        accessTokenExpiresAt: tokens.expires_in
          ? new Date(Date.now() + Number(tokens.expires_in) * 1000).toISOString()
          : null,
        scope: String(tokens.scope || ''),
        accountLabel,
      })
    } catch (err) {
      console.error(`oauth-callback:${provider}:save`, err)
      const msg = err instanceof Error ? err.message : ''
      if (/cloud_oauth_states|organization_cloud_connections|schema cache|does not exist/i.test(msg)) {
        return fail('sql_missing', causeCourte(err))
      }
      return fail('save_failed', causeCourte(err))
    }

    void purgeExpiredOauthStates()

    return backToApp(res, base, redirectPath, {
      cloud: provider,
      status: 'connected',
      compte: accountLabel,
    })
  } catch (err) {
    console.error(`oauth-callback:${provider}`, err)
    const msg = err instanceof Error ? err.message : ''
    if (/cloud_oauth_states|organization_cloud_connections|schema cache|does not exist/i.test(msg)) {
      return fail('sql_missing', causeCourte(err))
    }
    return fail('callback_failed', causeCourte(err))
  }
}
