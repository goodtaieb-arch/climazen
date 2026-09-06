import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  buildAuthorizeUrl,
  callbackErrorMessage,
  cloudProviderLabel,
  createPkcePair,
  GOOGLE_DRIVE_SCOPE,
  MICROSOFT_SCOPES,
  normalizeCloudProvider,
  safeRedirectPath,
  scopesFor,
  tokenEndpoint,
} from '../server/lib/cloudOauth.js'
import {
  detectCloudProviderFromUrl,
  extractGoogleDriveFolderId,
  graphShareId,
  testFileContent,
  TEST_FILE_NAME,
} from '../server/lib/cloudWriteTest.js'
import { decryptSecret, encryptSecret, tokenEncryptionAvailable } from '../server/lib/secretBox.js'
import {
  cloudCallbackErrorText,
  cloudCallbackMessage,
  partageServiceAccountInstruction,
  SERVICE_ACCOUNT_EMAIL_PLACEHOLDER,
} from '../src/lib/cloudOauth'

// --- Fournisseurs -----------------------------------------------------------
assert.equal(normalizeCloudProvider('Google'), 'google')
assert.equal(normalizeCloudProvider('drive'), 'google')
assert.equal(normalizeCloudProvider('onedrive'), 'microsoft')
assert.equal(normalizeCloudProvider('sharepoint'), 'microsoft')
assert.equal(normalizeCloudProvider('dropbox'), '')
assert.match(cloudProviderLabel('google'), /Google Drive/)
assert.match(cloudProviderLabel('microsoft'), /OneDrive/)

// --- Scopes demandés (exigence produit) -------------------------------------
assert.deepEqual(scopesFor('google'), ['https://www.googleapis.com/auth/drive.file'])
assert.deepEqual(scopesFor('microsoft'), ['Files.ReadWrite.All', 'offline_access'])
assert.equal(GOOGLE_DRIVE_SCOPE, 'https://www.googleapis.com/auth/drive.file')
assert.ok(MICROSOFT_SCOPES.includes('offline_access'))

// --- URL d’autorisation -----------------------------------------------------
const pkce = createPkcePair()
assert.ok(pkce.verifier.length >= 43)
assert.notEqual(pkce.verifier, pkce.challenge)

const googleUrl = new URL(
  buildAuthorizeUrl({
    provider: 'google',
    clientId: 'cid.apps.googleusercontent.com',
    redirectUri: 'https://climazen.fr/api/auth/google/callback',
    state: 'st4te',
    codeChallenge: pkce.challenge,
  }),
)
assert.equal(googleUrl.hostname, 'accounts.google.com')
assert.equal(googleUrl.searchParams.get('scope'), GOOGLE_DRIVE_SCOPE)
assert.equal(googleUrl.searchParams.get('response_type'), 'code')
// Sans access_type=offline + prompt=consent, Google ne renvoie aucun refresh_token
assert.equal(googleUrl.searchParams.get('access_type'), 'offline')
assert.equal(googleUrl.searchParams.get('prompt'), 'consent')
assert.equal(googleUrl.searchParams.get('code_challenge_method'), 'S256')
assert.equal(
  googleUrl.searchParams.get('redirect_uri'),
  'https://climazen.fr/api/auth/google/callback',
)

const msUrl = new URL(
  buildAuthorizeUrl({
    provider: 'microsoft',
    clientId: 'app-id',
    redirectUri: 'https://climazen.fr/api/auth/microsoft/callback',
    state: 'st4te',
    codeChallenge: pkce.challenge,
  }),
)
assert.equal(msUrl.hostname, 'login.microsoftonline.com')
assert.equal(msUrl.searchParams.get('scope'), 'Files.ReadWrite.All offline_access')
assert.equal(
  msUrl.searchParams.get('redirect_uri'),
  'https://climazen.fr/api/auth/microsoft/callback',
)
assert.match(tokenEndpoint('google'), /oauth2\.googleapis\.com/)
assert.match(tokenEndpoint('microsoft'), /login\.microsoftonline\.com/)

// --- Routes de callback : URLs publiques imposées, servies par cloud-oauth ---
// (une seule fonction : le plan Vercel plafonne le déploiement à 12 fonctions)
const vercelConfig = JSON.parse(readFileSync(new URL('../vercel.json', import.meta.url), 'utf8')) as {
  rewrites: Array<{ source: string; destination: string }>
}
for (const provider of ['google', 'microsoft']) {
  const rewrite = vercelConfig.rewrites.find((r) => r.source === `/api/auth/${provider}/callback`)
  assert.ok(rewrite, `rewrite manquant pour /api/auth/${provider}/callback`)
  assert.equal(rewrite?.destination, `/api/cloud-oauth?callback=${provider}`)
}
const spaFallback = vercelConfig.rewrites.findIndex((r) => r.destination === '/index.html')
const firstCallback = vercelConfig.rewrites.findIndex((r) => r.source.startsWith('/api/auth/'))
assert.ok(firstCallback < spaFallback, 'les callbacks doivent précéder le fallback SPA')

// --- Retour dans l’app : jamais vers un site externe -------------------------
assert.equal(safeRedirectPath('/app/operateur'), '/app/operateur')
assert.equal(safeRedirectPath('/app/equipe?tab=cloud'), '/app/equipe?tab=cloud')
assert.equal(safeRedirectPath('https://evil.example/app/x'), '/app/operateur')
assert.equal(safeRedirectPath('//evil.example'), '/app/operateur')
assert.equal(safeRedirectPath('/login'), '/app/operateur')
assert.equal(safeRedirectPath(undefined), '/app/operateur')

// --- Chiffrement des refresh_token ------------------------------------------
process.env.CLOUD_TOKEN_SECRET = 'secret-de-test-climazen'
assert.equal(tokenEncryptionAvailable(), true)
const chiffre = encryptSecret('1//refresh-token-google')
assert.ok(chiffre.startsWith('v1:'))
assert.equal(chiffre.includes('refresh-token-google'), false)
assert.equal(decryptSecret(chiffre), '1//refresh-token-google')
assert.notEqual(encryptSecret('meme-valeur'), encryptSecret('meme-valeur'))
assert.equal(decryptSecret('v1:aaa:bbb:ccc'), '')
assert.equal(decryptSecret(''), '')

// --- Ciblage du dossier -----------------------------------------------------
assert.equal(
  extractGoogleDriveFolderId('https://drive.google.com/drive/folders/AbCdEfGhIjK1234567'),
  'AbCdEfGhIjK1234567',
)
assert.equal(
  extractGoogleDriveFolderId('https://drive.google.com/open?id=AbCdEfGhIjK1234567'),
  'AbCdEfGhIjK1234567',
)
assert.equal(extractGoogleDriveFolderId('https://example.com/x'), '')
assert.equal(extractGoogleDriveFolderId(''), '')

const share = graphShareId('https://contoso.sharepoint.com/:f:/s/rh/abc')
assert.ok(share.startsWith('u!'))
assert.equal(share.includes('='), false)
assert.equal(
  Buffer.from(share.slice(2), 'base64url').toString('utf8'),
  'https://contoso.sharepoint.com/:f:/s/rh/abc',
)

assert.equal(detectCloudProviderFromUrl('https://drive.google.com/drive/folders/x'), 'google')
assert.equal(detectCloudProviderFromUrl('https://1drv.ms/f/s!abc'), 'microsoft')
assert.equal(detectCloudProviderFromUrl('https://contoso.sharepoint.com/sites/rh'), 'microsoft')
assert.equal(detectCloudProviderFromUrl('https://dropbox.com/x'), '')

// --- Fichier de test --------------------------------------------------------
assert.equal(TEST_FILE_NAME, 'test-climazen.txt')
assert.match(testFileContent(new Date('2026-01-02T03:04:05.000Z')), /2026-01-02T03:04:05/)

// --- Messages ---------------------------------------------------------------
assert.match(callbackErrorMessage('access_denied'), /refus/i)
assert.match(callbackErrorMessage('state_expired'), /expir/i)
assert.match(callbackErrorMessage('no_refresh_token'), /refresh_token/)
assert.match(callbackErrorMessage('inconnu'), /impossible/i)
assert.match(cloudCallbackErrorText('state_invalid'), /Connecter/)

assert.match(
  partageServiceAccountInstruction('service@climazen.iam.gserviceaccount.com'),
  /partager votre dossier en mode Éditeur avec notre compte de service service@climazen\.iam\.gserviceaccount\.com\.$/,
)
assert.ok(partageServiceAccountInstruction().includes(SERVICE_ACCOUNT_EMAIL_PLACEHOLDER))

const okCallback = cloudCallbackMessage(
  new URLSearchParams('cloud=google&status=connected&compte=bureau@societe.fr'),
)
assert.equal(okCallback?.ok, true)
assert.match(okCallback?.message || '', /Google Drive connecté/)
assert.match(okCallback?.message || '', /bureau@societe\.fr/)

const koCallback = cloudCallbackMessage(
  new URLSearchParams('cloud=microsoft&status=error&reason=access_denied'),
)
assert.equal(koCallback?.ok, false)
assert.match(koCallback?.message || '', /OneDrive/)
assert.equal(cloudCallbackMessage(new URLSearchParams('cloud=dropbox&status=connected')), null)
assert.equal(cloudCallbackMessage(new URLSearchParams('')), null)

// --- Le rewrite ?callback=… atteint bien le flux callback ---------------------
// Sans service role, la fonction doit renvoyer l’utilisateur dans l’app avec un
// motif lisible plutôt qu’une page blanche (aucun appel réseau ici).
delete process.env.SUPABASE_SERVICE_ROLE_KEY
const cloudOauthHandler = (await import('../api/cloud-oauth.js')).default
const captured = { statusCode: 0, headers: {} as Record<string, string> }
await cloudOauthHandler(
  { method: 'GET', url: '/api/cloud-oauth?callback=google&code=abc&state=xyz', headers: {} },
  {
    set statusCode(v: number) {
      captured.statusCode = v
    },
    setHeader(k: string, v: string) {
      captured.headers[k.toLowerCase()] = v
    },
    end() {},
  },
)
assert.equal(captured.statusCode, 302)
const back = new URL(captured.headers.location)
assert.equal(back.pathname, '/app/operateur')
assert.equal(back.searchParams.get('cloud'), 'google')
assert.equal(back.searchParams.get('status'), 'error')
assert.equal(back.searchParams.get('reason'), 'not_configured')

console.log('test-cloud-oauth: ok')
