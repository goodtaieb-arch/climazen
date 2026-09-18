/**
 * Handler Trackdéchets — PAS un fichier api/ (Hobby Vercel = 12 fonctions max).
 * Exposé via rewrites :
 *   /api/trackdechets-token → /api/ai-org-key?service=trackdechets&scope=token
 *   /api/trackdechets-bsff  → /api/ai-org-key?service=trackdechets&scope=bsff
 *
 * Jeton API Trackdéchets personnel de l'utilisateur (Mon entreprise → Réglages)
 * + création automatique des BSFF (createBsff) une fois activée.
 */

import { authorizeOrgRequest } from './authorizeOrg.js'
import { getSupabaseConfig } from './supabaseServer.js'
import {
  fetchOrgTrackdechetsStatus,
  fetchOrgTrackdechetsToken,
  upsertOrgTrackdechetsToken,
  setOrgTrackdechetsEnabled,
  clearOrgTrackdechetsToken,
  parseTrackdechetsToken,
} from './trackdechetsSecrets.js'
import { testTrackdechetsToken, createBsff, fetchBsffStatus } from './trackdechetsClient.js'

function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
}

async function handleToken(req, res, auth) {
  if (req.method === 'GET' || req.method === 'HEAD') {
    const status = await fetchOrgTrackdechetsStatus(auth.orgId)
    return res.status(200).json({ ok: true, ...status, canEdit: auth.isOwner })
  }

  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  if (!auth.isOwner) {
    return res.status(403).json({ error: 'Réservé au gérant.', code: 'owner_only' })
  }

  const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {}

  if (body.clear === true) {
    await clearOrgTrackdechetsToken(auth.orgId, auth.user.id)
    return res.status(200).json({ ok: true, hasToken: false, hint: '', enabled: false })
  }

  // Bouton « Tester la connexion » — sans forcément enregistrer.
  if (body.test === true) {
    const raw = String(body.token || '').trim()
    let tokenToTest = raw
    if (!tokenToTest) {
      const stored = await fetchOrgTrackdechetsToken(auth.orgId)
      if (!stored.token) return res.status(400).json({ error: 'Collez un jeton avant de tester.' })
      tokenToTest = stored.token
    } else {
      const parsed = parseTrackdechetsToken(tokenToTest)
      if (!parsed.ok) return res.status(400).json({ error: parsed.error })
      tokenToTest = parsed.token
    }
    try {
      const me = await testTrackdechetsToken(tokenToTest)
      return res.status(200).json({ ok: true, valid: true, me })
    } catch (err) {
      return res.status(200).json({
        ok: true,
        valid: false,
        error: err instanceof Error ? err.message : 'Jeton invalide.',
      })
    }
  }

  if (typeof body.enabled === 'boolean' && !body.token) {
    const saved = await setOrgTrackdechetsEnabled(auth.orgId, body.enabled, auth.user.id)
    if (!saved.ok) return res.status(400).json({ error: saved.error })
    return res.status(200).json({ ok: true, ...(await fetchOrgTrackdechetsStatus(auth.orgId)) })
  }

  if (body.token) {
    const saved = await upsertOrgTrackdechetsToken(auth.orgId, body.token, auth.user.id)
    if (!saved.ok) return res.status(400).json({ error: saved.error })
    if (typeof body.enabled === 'boolean') {
      await setOrgTrackdechetsEnabled(auth.orgId, body.enabled, auth.user.id)
    }
    return res.status(200).json({ ok: true, ...(await fetchOrgTrackdechetsStatus(auth.orgId)) })
  }

  return res.status(400).json({ error: 'Rien à enregistrer.' })
}

/** Champs obligatoires côté serveur aussi — jamais d'appel Trackdéchets avec un champ manquant. */
function missingBsffFields(p) {
  const missing = []
  if (!p?.numeroContenant?.trim()) missing.push('N° de bouteille')
  if (!p?.codeDechet?.trim()) missing.push('Code déchet')
  if (!(Number(p?.quantiteKg) > 0)) missing.push('Quantité (kg) > 0')
  if (!p?.emitter?.siret?.trim()) missing.push('SIRET émetteur')
  if (!p?.emitter?.nom?.trim()) missing.push('Nom émetteur')
  if (!p?.emitter?.adresse?.trim()) missing.push('Adresse émetteur')
  if (!p?.destinataire?.siret?.trim()) missing.push('SIRET destinataire')
  if (!p?.destinataire?.nom?.trim()) missing.push('Nom destinataire')
  if (!p?.destinataire?.adresse?.trim()) missing.push('Adresse destinataire')
  if (!p?.destinataire?.codeCap?.trim()) missing.push('Code CAP destinataire')
  if (!p?.destinataire?.codeOperation?.trim()) missing.push('Code opération destinataire')
  if (!p?.transporteur?.siret?.trim()) missing.push('SIRET transporteur')
  return missing
}

async function handleBsff(req, res, auth) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const status = await fetchOrgTrackdechetsStatus(auth.orgId)
  if (!status.enabled || !status.hasToken) {
    return res.status(403).json({
      error: 'Création automatique des BSFF désactivée — activez-la dans Mon entreprise.',
      code: 'trackdechets_disabled',
    })
  }
  const { token } = await fetchOrgTrackdechetsToken(auth.orgId)
  if (!token) {
    return res.status(403).json({ error: 'Jeton Trackdéchets manquant.', code: 'trackdechets_disabled' })
  }

  const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {}

  if (body.action === 'status') {
    if (!body.id) return res.status(400).json({ error: 'Identifiant de bordereau manquant.' })
    try {
      const result = await fetchBsffStatus(token, body.id)
      return res.status(200).json({ ok: true, ...result })
    } catch (err) {
      return res.status(200).json({ ok: false, error: err instanceof Error ? err.message : 'Erreur Trackdéchets.' })
    }
  }

  // action === 'create' (défaut)
  const payload = body.payload || {}
  const missing = missingBsffFields(payload)
  if (missing.length > 0) {
    return res.status(400).json({
      error: `Champs obligatoires manquants pour le BSFF : ${missing.join(', ')}.`,
      code: 'missing_fields',
      missing,
    })
  }

  try {
    const result = await createBsff(token, payload)
    return res.status(200).json({ ok: true, ...result })
  } catch (err) {
    return res.status(200).json({ ok: false, error: err instanceof Error ? err.message : 'Erreur Trackdéchets.' })
  }
}

export default async function handleTrackdechetsRequest(req, res) {
  try {
    setCors(res)
    if (req.method === 'OPTIONS') return res.status(204).end()

    const { serviceKey } = getSupabaseConfig()
    if (!serviceKey) {
      return res.status(503).json({ error: 'Supabase service role non configuré.' })
    }

    const auth = await authorizeOrgRequest(req)
    if (!auth.ok) return res.status(auth.status).json({ error: auth.error, code: auth.code })

    const scope = String(req.query?.scope || 'token')
    if (scope === 'bsff') return handleBsff(req, res, auth)
    return handleToken(req, res, auth)
  } catch (err) {
    console.error('trackdechets', err)
    const msg = err instanceof Error ? err.message : 'unknown'
    if (/organization_trackdechets_secrets|schema cache|does not exist/i.test(msg)) {
      return res.status(503).json({
        error: 'Table jeton Trackdéchets absente. Exécutez supabase/trackdechets-secrets.sql.',
        code: 'sql_missing',
      })
    }
    return res.status(500).json({ error: msg })
  }
}
