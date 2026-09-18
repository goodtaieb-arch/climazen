/**
 * Handler facturation électronique — PAS un fichier api/ (Hobby Vercel = 12
 * fonctions max). Exposé via rewrite :
 *   /api/invoicing-config → /api/ai-org-key?service=invoicing&scope=config
 *
 * Multi-prestataire (cahier des charges §7) : la société choisit son
 * prestataire (FactPulse, IOPOLE, B2Brouter…) et colle ses propres
 * identifiants — jamais de "FactPulse" en dur. Seul FactPulse a une
 * intégration réelle pour l'instant (server/lib/factpulseClient.js) ; les
 * autres prestataires renvoient une erreur claire "pas encore disponible"
 * tant qu'ils ne sont pas câblés.
 *
 * Sans identifiants enregistrés : rien ne change (facturation manuelle /
 * Tiime / Pennylane comme aujourd'hui).
 */

import { authorizeOrgRequest } from './authorizeOrg.js'
import { getSupabaseConfig } from './supabaseServer.js'
import {
  fetchOrgInvoicingStatus,
  fetchOrgInvoicingCredentials,
  upsertOrgInvoicingCredentials,
  setOrgInvoicingEnabled,
  setOrgInvoicingFranchiseTva,
  clearOrgInvoicingCredentials,
} from './invoicingSecrets.js'
import { normalizeInvoicingProvider, isInvoicingProviderAvailable } from './invoicingProviders.js'
import { testFactpulseCredentials } from './factpulseClient.js'

function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
}

/** Ajoute ici les autres prestataires au fur et à mesure de leur intégration. */
async function testProviderCredentials(provider, { email, password, clientUid }) {
  if (provider === 'factpulse') return testFactpulseCredentials(email, password, clientUid)
  throw new Error('Ce prestataire n’est pas encore disponible dans ClimaZEN.')
}

async function handleConfig(req, res, auth) {
  if (req.method === 'GET' || req.method === 'HEAD') {
    const status = await fetchOrgInvoicingStatus(auth.orgId)
    return res.status(200).json({ ok: true, ...status, canEdit: auth.isOwner })
  }

  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  if (!auth.isOwner) {
    return res.status(403).json({ error: 'Réservé au gérant.', code: 'owner_only' })
  }

  const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {}

  if (body.clear === true) {
    await clearOrgInvoicingCredentials(auth.orgId, auth.user.id)
    return res.status(200).json({ ok: true, hasCredentials: false, email: '', clientUid: '', enabled: false })
  }

  // Bouton « Tester la connexion » — sans forcément enregistrer.
  if (body.test === true) {
    const provider = normalizeInvoicingProvider(body.provider)
    if (!isInvoicingProviderAvailable(provider)) {
      return res.status(200).json({
        ok: true,
        valid: false,
        error: 'Ce prestataire n’est pas encore disponible dans ClimaZEN.',
      })
    }
    let email = String(body.email || '').trim()
    let password = String(body.password || '')
    let clientUid = String(body.clientUid || '').trim()
    if (!email || !password) {
      const stored = await fetchOrgInvoicingCredentials(auth.orgId)
      if (stored.provider !== provider || !stored.email || !stored.password) {
        return res.status(400).json({ error: 'Renseignez email et mot de passe avant de tester.' })
      }
      email = email || stored.email
      password = password || stored.password
      clientUid = clientUid || stored.clientUid
    }
    try {
      const me = await testProviderCredentials(provider, { email, password, clientUid: clientUid || undefined })
      return res.status(200).json({ ok: true, valid: true, me })
    } catch (err) {
      return res.status(200).json({
        ok: true,
        valid: false,
        error: err instanceof Error ? err.message : 'Identifiants invalides.',
      })
    }
  }

  // Case « franchise en base de TVA » seule (sans retoucher aux identifiants).
  if (typeof body.franchiseTva === 'boolean' && !body.email && !body.password) {
    const saved = await setOrgInvoicingFranchiseTva(auth.orgId, body.franchiseTva, auth.user.id)
    if (!saved.ok) return res.status(400).json({ error: saved.error })
    return res.status(200).json({ ok: true, ...(await fetchOrgInvoicingStatus(auth.orgId)) })
  }

  if (typeof body.enabled === 'boolean' && !body.email && !body.password) {
    const saved = await setOrgInvoicingEnabled(auth.orgId, body.enabled, auth.user.id)
    if (!saved.ok) return res.status(400).json({ error: saved.error })
    return res.status(200).json({ ok: true, ...(await fetchOrgInvoicingStatus(auth.orgId)) })
  }

  if (body.email || body.password) {
    const provider = normalizeInvoicingProvider(body.provider)
    if (!isInvoicingProviderAvailable(provider)) {
      return res.status(400).json({ error: 'Ce prestataire n’est pas encore disponible dans ClimaZEN.' })
    }
    const saved = await upsertOrgInvoicingCredentials(
      auth.orgId,
      {
        provider,
        email: body.email,
        password: body.password,
        clientUid: body.clientUid,
        franchiseTva: body.franchiseTva,
      },
      auth.user.id,
    )
    if (!saved.ok) return res.status(400).json({ error: saved.error })
    if (typeof body.enabled === 'boolean') {
      await setOrgInvoicingEnabled(auth.orgId, body.enabled, auth.user.id)
    }
    return res.status(200).json({ ok: true, ...(await fetchOrgInvoicingStatus(auth.orgId)) })
  }

  return res.status(400).json({ error: 'Rien à enregistrer.' })
}

export default async function handleInvoicingRequest(req, res) {
  try {
    setCors(res)
    if (req.method === 'OPTIONS') return res.status(204).end()

    const { serviceKey } = getSupabaseConfig()
    if (!serviceKey) {
      return res.status(503).json({ error: 'Supabase service role non configuré.' })
    }

    const auth = await authorizeOrgRequest(req)
    if (!auth.ok) return res.status(auth.status).json({ error: auth.error, code: auth.code })

    return handleConfig(req, res, auth)
  } catch (err) {
    console.error('invoicing', err)
    const msg = err instanceof Error ? err.message : 'unknown'
    if (/organization_invoicing_secrets|schema cache|does not exist/i.test(msg)) {
      return res.status(503).json({
        error: 'Table identifiants facturation absente. Exécutez supabase/invoicing-secrets.sql.',
        code: 'sql_missing',
      })
    }
    return res.status(500).json({ error: msg })
  }
}
