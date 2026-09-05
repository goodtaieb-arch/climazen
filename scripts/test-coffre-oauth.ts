import assert from 'node:assert/strict'
import {
  GDRIVE_OAUTH_SCOPES,
  GRAPH_OAUTH_SCOPES,
  googleAuthorizeUrl,
  microsoftAuthorizeUrl,
  signOAuthState,
  verifyOAuthState,
} from '../server/lib/coffreOauth.js'
import {
  computeCoffreActif,
  ownerSafeConfig,
  resolveGdriveOAuthClient,
  resolveGraphOAuthClient,
} from '../server/lib/coffreSecretsStore.js'
import { classifyStorageError, coffreErrorMessage } from '../server/lib/storageError.js'

const secret = 'test-oauth-state-secret-climazen'
const state = signOAuthState(
  { orgId: 'org1', userId: 'user1', provider: 'gdrive', iat: Date.now(), nonce: 'abc' },
  secret,
)
const ok = verifyOAuthState(state, secret)
assert.equal(ok.ok, true)
assert.equal(ok.payload?.orgId, 'org1')
assert.equal(ok.payload?.provider, 'gdrive')

const bad = verifyOAuthState(state.slice(0, -2) + 'xx', secret)
assert.equal(bad.ok, false)

const expired = signOAuthState(
  { orgId: 'org1', userId: 'user1', provider: 'onedrive', iat: Date.now() - 20 * 60 * 1000, nonce: 'z' },
  secret,
)
assert.equal(verifyOAuthState(expired, secret).ok, false)

const gUrl = googleAuthorizeUrl({
  clientId: 'cid.apps.googleusercontent.com',
  redirectUri: 'https://climazen.fr/api/oauth/cloud',
  state,
})
assert.ok(gUrl.includes('accounts.google.com'))
assert.ok(gUrl.includes('access_type=offline'))
assert.ok(gUrl.includes(encodeURIComponent(GDRIVE_OAUTH_SCOPES.split(' ')[0])))

const mUrl = microsoftAuthorizeUrl({
  clientId: 'azure-app',
  tenant: 'common',
  redirectUri: 'https://climazen.fr/api/oauth/cloud',
  state,
})
assert.ok(mUrl.includes('login.microsoftonline.com/common'))
assert.ok(mUrl.includes(encodeURIComponent(GRAPH_OAUTH_SCOPES.split(' ')[0])))

const safe = ownerSafeConfig({
  gdriveRefreshToken: 'rt-secret',
  gdriveClientId: 'cid',
  gdriveAccountEmail: 'gerant@exemple.fr',
  serveurPriveDocsUrl: 'https://nas.exemple.fr/dav',
})
assert.equal(safe.gdriveRefreshToken, undefined)
assert.equal(safe.gdriveConnected, true)
assert.equal(safe.gdriveAccountEmail, 'gerant@exemple.fr')
assert.equal(safe.serveurPriveDocsUrl, 'https://nas.exemple.fr/dav')

process.env.CLIMAZEN_GDRIVE_CLIENT_ID = 'env-id'
process.env.CLIMAZEN_GDRIVE_CLIENT_SECRET = 'env-secret'
const g = resolveGdriveOAuthClient({ gdriveRefreshToken: 'rt' })
assert.equal(g.clientId, 'env-id')
assert.equal(computeCoffreActif({
  docsDestCloud: true,
  cloudProvider: 'gdrive',
  gdriveRefreshToken: 'rt',
}), true)

const m = resolveGraphOAuthClient({})
assert.equal(m.tenant, 'common')

assert.equal(classifyStorageError({ status: 401 }), 'auth')
assert.equal(classifyStorageError({ status: 507 }), 'quota')
assert.equal(classifyStorageError({ message: 'fetch failed' }), 'network')
assert.ok(coffreErrorMessage({ kind: 'gdrive', code: 'auth' }).includes('Google Drive'))

console.log('test-coffre-oauth: ok')
