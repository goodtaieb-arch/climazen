/**
 * Vercel Serverless — /api/cloud-oauth
 * Pilotage des connexions cloud société (gérant) :
 *   GET                        → état des connexions
 *   POST { action: 'start' }   → URL d’autorisation OAuth2 (Google / Microsoft)
 *   POST { action: 'disconnect' }
 *   POST { action: 'test-write' } → crée test-climazen.txt puis le supprime
 *   POST { action: 'upload' }     → envoie un vrai document (dossier créé si besoin)
 *
 * Les callbacks /api/auth/google/callback et /api/auth/microsoft/callback sont
 * servis par cette même fonction (rewrites vercel.json → ?callback=…) : le plan
 * Vercel plafonne le déploiement à 12 fonctions serverless.
 */

import { authorizeOrgRequest } from '../server/lib/authorizeOrg.js'
import { handleOauthCallback } from '../server/lib/cloudOauthCallback.js'
import { getSupabaseConfig } from '../server/lib/supabaseServer.js'
import {
  buildAuthorizeUrl,
  cloudProviderLabel,
  createOauthState,
  deleteCloudConnection,
  getAccessToken,
  hasCloudConnection,
  listCloudConnections,
  normalizeCloudProvider,
  providerCredentials,
  purgeExpiredOauthStates,
  redirectUriFor,
  safeRedirectPath,
  scopesFor,
} from '../server/lib/cloudOauth.js'
import {
  detectCloudProviderFromUrl,
  extractGoogleDriveFolderId,
  runGoogleWriteTest,
  runMicrosoftWriteTest,
  TEST_FILE_NAME,
} from '../server/lib/cloudWriteTest.js'
import {
  ensureGoogleFolderPath,
  ensureGraphFolderPath,
  resolveGraphFolder,
  uploadGoogleFile,
  uploadMicrosoftFile,
} from '../server/lib/cloudUpload.js'

const MAX_UPLOAD_BYTES = 15 * 1024 * 1024

function normalizeSegments(raw) {
  if (!Array.isArray(raw)) return null
  const segs = raw.map((s) => String(s || '').trim()).filter(Boolean)
  if (segs.length === 0 || segs.length > 10) return null
  for (const s of segs) {
    if (s.length > 100 || /[\\/]|\.\./.test(s)) return null
  }
  return segs
}

function normalizeHttpsUrl(raw) {
  const s = String(raw || '').trim()
  if (!s || s.length > 2000) return ''
  try {
    const u = new URL(s)
    return u.protocol === 'https:' ? u.href : ''
  } catch {
    return ''
  }
}

async function handleStart(req, res, auth, body) {
  const provider = normalizeCloudProvider(body.provider)
  if (!provider) return res.status(400).json({ error: 'Fournisseur cloud inconnu.' })

  const creds = providerCredentials(provider)
  if (!creds.ok) return res.status(503).json({ error: creds.error, code: 'not_configured' })

  void purgeExpiredOauthStates()

  const { state, codeChallenge } = await createOauthState({
    provider,
    orgId: auth.orgId,
    userId: auth.user.id,
    redirectPath: safeRedirectPath(body.redirectPath),
  })

  return res.status(200).json({
    ok: true,
    provider,
    scopes: scopesFor(provider),
    authorizeUrl: buildAuthorizeUrl({
      provider,
      clientId: creds.clientId,
      redirectUri: redirectUriFor(provider, req),
      state,
      codeChallenge,
    }),
  })
}

async function googleWriteTest(auth, folderUrl) {
  if (!(await hasCloudConnection(auth.orgId, 'google'))) {
    return {
      ok: false,
      message: 'Google Drive n’est pas connecté. Cliquez sur « Connecter Google Drive ».',
    }
  }
  const token = await getAccessToken(auth.orgId, 'google')
  return runGoogleWriteTest({
    accessToken: token,
    folderId: extractGoogleDriveFolderId(folderUrl),
  })
}

async function microsoftWriteTest(auth, folderUrl) {
  if (!(await hasCloudConnection(auth.orgId, 'microsoft'))) {
    return {
      ok: false,
      message: 'OneDrive / SharePoint n’est pas connecté. Cliquez sur « Connecter OneDrive ».',
    }
  }
  const token = await getAccessToken(auth.orgId, 'microsoft')
  return runMicrosoftWriteTest({ accessToken: token, shareUrl: folderUrl })
}

/** Seul fournisseur connecté, s’il n’y en a qu’un — sinon rien à deviner. */
async function seulCloudConnecte(orgId) {
  const connections = await listCloudConnections(orgId)
  const connectes = ['google', 'microsoft'].filter((p) => connections?.[p]?.connected)
  return connectes.length === 1 ? connectes[0] : ''
}

async function handleTestWrite(res, auth, body) {
  const folderUrl = normalizeHttpsUrl(body.url)
  if (body.url && !folderUrl) {
    return res.status(200).json({
      ok: false,
      message: 'Lien invalide : collez un lien https de dossier Google Drive, OneDrive ou SharePoint.',
    })
  }

  const detected = detectCloudProviderFromUrl(folderUrl)
  // Sans lien ni fournisseur explicite, tester le cloud déjà connecté : le
  // gérant qui vient de brancher OneDrive attend un test, pas une question.
  const provider =
    normalizeCloudProvider(body.provider) || detected || (await seulCloudConnecte(auth.orgId))
  if (!provider) {
    return res.status(200).json({
      ok: false,
      message:
        'Aucun cloud à tester : connectez Google Drive ou OneDrive, ou collez un lien de dossier.',
    })
  }
  if (folderUrl && detected && detected !== provider) {
    return res.status(200).json({
      ok: false,
      message:
        detected === 'google'
          ? 'Ce lien est un lien Google Drive : testez-le côté Google Drive.'
          : 'Ce lien est un lien OneDrive / SharePoint : testez-le côté OneDrive.',
    })
  }

  try {
    const result =
      provider === 'google'
        ? await googleWriteTest(auth, folderUrl)
        : await microsoftWriteTest(auth, folderUrl)
    return res.status(200).json({
      ok: Boolean(result.ok),
      provider,
      fileName: TEST_FILE_NAME,
      cleaned: Boolean(result.cleaned),
      message: result.message,
      detail: result.detail || undefined,
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Test impossible.'
    return res.status(200).json({ ok: false, provider, message: msg })
  }
}

/**
 * Upload réel d'un document généré (PDF…) vers le cloud connecté, avec création
 * de l'arborescence de dossiers si besoin. Ouvert à tout membre authentifié de
 * la société (pas réservé au gérant) : n'importe qui génère des documents.
 */
async function handleUpload(res, auth, body) {
  const segments = normalizeSegments(body.segments)
  const fileName = String(body.fileName || '').trim()
  const contentType = String(body.contentType || 'application/octet-stream').trim()
  const contentBase64 = String(body.contentBase64 || '')

  if (!segments) {
    return res.status(400).json({ ok: false, error: 'invalid_segments', message: 'Chemin de dossier invalide.' })
  }
  if (!fileName || fileName.length > 200) {
    return res.status(400).json({ ok: false, error: 'invalid_filename', message: 'Nom de fichier invalide.' })
  }
  if (!contentBase64) {
    return res.status(400).json({ ok: false, error: 'missing_content', message: 'Fichier vide.' })
  }
  if (contentBase64.length * 0.75 > MAX_UPLOAD_BYTES) {
    return res.status(400).json({ ok: false, error: 'too_large', message: 'Fichier trop volumineux.' })
  }

  const folderUrl = normalizeHttpsUrl(body.folderUrl)
  const detected = detectCloudProviderFromUrl(folderUrl)
  const provider =
    normalizeCloudProvider(body.provider) || detected || (await seulCloudConnecte(auth.orgId))
  if (!provider) {
    return res.status(200).json({
      ok: false,
      message: 'Aucun cloud configuré — connectez Google Drive ou OneDrive dans Mon entreprise.',
    })
  }
  if (!(await hasCloudConnection(auth.orgId, provider))) {
    return res.status(200).json({
      ok: false,
      provider,
      message: `${cloudProviderLabel(provider)} n’est pas connecté — connectez-le dans Mon entreprise.`,
    })
  }

  let buffer
  try {
    buffer = Buffer.from(contentBase64, 'base64')
  } catch {
    return res.status(400).json({ ok: false, error: 'invalid_content', message: 'Contenu du fichier invalide.' })
  }

  try {
    const token = await getAccessToken(auth.orgId, provider)

    if (provider === 'google') {
      const rootFolderId = extractGoogleDriveFolderId(folderUrl) || undefined
      const folderId = await ensureGoogleFolderPath(token, segments, rootFolderId)
      const result = await uploadGoogleFile(token, { folderId, fileName, contentType, buffer })
      return res.status(200).json({
        ok: Boolean(result.ok),
        provider,
        url: result.url,
        fileId: result.fileId,
        message: result.message,
        detail: result.detail,
      })
    }

    let rootLoc = {}
    if (folderUrl) {
      const folder = await resolveGraphFolder(token, folderUrl)
      if (!folder.ok) {
        return res.status(200).json({
          ok: false,
          provider,
          message: 'OneDrive / SharePoint : dossier introuvable depuis ce lien.',
          detail: folder.detail,
        })
      }
      rootLoc = { driveId: folder.driveId, itemId: folder.itemId }
    }
    const folderLoc = await ensureGraphFolderPath(token, segments, rootLoc)
    const result = await uploadMicrosoftFile(token, { folderLoc, fileName, contentType, buffer })
    return res.status(200).json({
      ok: Boolean(result.ok),
      provider,
      url: result.url,
      fileId: result.fileId,
      message: result.message,
      detail: result.detail,
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Envoi impossible.'
    return res.status(200).json({ ok: false, provider, message: msg })
  }
}

/** Provider du callback OAuth, injecté par les rewrites /api/auth/:provider/callback. */
function callbackProviderOf(req) {
  try {
    const url = new URL(req.url || '/', 'https://climazen.fr')
    return normalizeCloudProvider(url.searchParams.get('callback'))
  } catch {
    return ''
  }
}

export default async function handler(req, res) {
  try {
    // Retour du fournisseur : navigation top-level, sans session Supabase ni CORS
    const callbackProvider = callbackProviderOf(req)
    if (callbackProvider) return handleOauthCallback(callbackProvider, req, res)

    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, POST, OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
    if (req.method === 'OPTIONS') return res.status(204).end()

    const { serviceKey } = getSupabaseConfig()
    if (!serviceKey) {
      return res.status(503).json({ error: 'Supabase service role non configuré.' })
    }

    const auth = await authorizeOrgRequest(req)
    if (!auth.ok) return res.status(auth.status).json({ error: auth.error, code: auth.code })

    if (req.method === 'GET' || req.method === 'HEAD') {
      const connections = await listCloudConnections(auth.orgId)
      return res.status(200).json({
        ok: true,
        canEdit: auth.isOwner,
        connections,
        available: {
          google: providerCredentials('google').ok,
          microsoft: providerCredentials('microsoft').ok,
        },
        // Valeur exacte attendue par le fournisseur : à déclarer telle quelle,
        // sinon Google répond redirect_uri_mismatch et Microsoft invalid_request.
        redirectUris: {
          google: redirectUriFor('google', req),
          microsoft: redirectUriFor('microsoft', req),
        },
      })
    }

    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {}
    const action = String(body.action || 'start')

    // Upload de document : tout membre authentifié de la société (génère des
    // documents au quotidien) — pas réservé au gérant, contrairement au reste.
    if (action === 'upload') return handleUpload(res, auth, body)

    if (!auth.isOwner) {
      return res.status(403).json({ error: 'Réservé au gérant.', code: 'owner_only' })
    }

    if (action === 'start') return handleStart(req, res, auth, body)

    if (action === 'disconnect') {
      const provider = normalizeCloudProvider(body.provider)
      if (!provider) return res.status(400).json({ error: 'Fournisseur cloud inconnu.' })
      await deleteCloudConnection(auth.orgId, provider)
      return res.status(200).json({ ok: true, provider })
    }

    if (action === 'test-write') return handleTestWrite(res, auth, body)

    return res.status(400).json({ error: 'Action inconnue.' })
  } catch (err) {
    console.error('cloud-oauth', err)
    const msg = err instanceof Error ? err.message : 'unknown'
    if (/cloud_oauth_states|organization_cloud_connections|schema cache|does not exist/i.test(msg)) {
      return res.status(503).json({
        error: 'Tables cloud absentes. Exécutez supabase/cloud-oauth.sql dans Supabase.',
        code: 'sql_missing',
      })
    }
    return res.status(500).json({ error: msg })
  }
}
