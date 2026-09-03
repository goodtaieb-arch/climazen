/**
 * Vercel — /api/telephony-config
 * Gérant : enregistrer le numéro entrant de SA société (isolation multi-tenant).
 *
 * GET  — lire config téléphonie société courante
 * POST — { inboundNumber, provider, lolaEnabled, managerNotifyEmail, notes }
 */

import { authorizeOrgRequest } from '../server/authorizeOrg.js'
import { supabaseRest, getSupabaseConfig } from '../server/supabaseServer.js'
import { logAiAudit } from '../server/aiAuditLog.js'
import { normalizeInboundE164 } from '../server/phoneE164.js'

const WEBHOOK_URL = 'https://climazen.fr/api/telephony-inbound'

export default async function handler(req, res) {
  try {
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, POST, OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')

    if (req.method === 'OPTIONS') return res.status(204).end()

    const { serviceKey } = getSupabaseConfig()
    if (!serviceKey) {
      return res.status(503).json({ error: 'Supabase service role non configuré.' })
    }

    if (req.method === 'GET' || req.method === 'HEAD') {
      const auth = await authorizeOrgRequest(req)
      if (!auth.ok) return res.status(auth.status).json({ error: auth.error, code: auth.code })
      if (!auth.isOwner) {
        return res.status(403).json({ error: 'Réservé au gérant.', code: 'owner_only' })
      }

      const rows = await supabaseRest(
        `organization_telephony?organization_id=eq.${encodeURIComponent(auth.orgId)}&select=*&limit=1`,
      )
      const row = rows?.[0] || null
      return res.status(200).json({
        ok: true,
        configured: Boolean(row),
        webhookUrl: WEBHOOK_URL,
        config: row
          ? {
              provider: row.provider,
              inboundE164: row.inbound_e164,
              lolaEnabled: row.lola_enabled,
              managerNotifyEmail: row.manager_notify_email,
              notes: row.notes,
              updatedAt: row.updated_at,
            }
          : null,
        setupSteps: buildSetupSteps(row?.provider || 'twilio'),
      })
    }

    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

    const auth = await authorizeOrgRequest(req)
    if (!auth.ok) return res.status(auth.status).json({ error: auth.error, code: auth.code })
    if (!auth.isOwner) {
      return res.status(403).json({ error: 'Réservé au gérant.', code: 'owner_only' })
    }

    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {}
    const inboundE164 = normalizeInboundE164(body.inboundNumber || body.inboundE164 || '')
    if (!inboundE164) {
      return res.status(400).json({
        error: 'Numéro invalide. Utilisez le format +33… ou 06…',
      })
    }

    const provider = String(body.provider || 'twilio').trim()
    if (!['twilio', 'vonage', 'plivo', 'other'].includes(provider)) {
      return res.status(400).json({ error: 'Fournisseur non supporté.' })
    }

    const payload = {
      organization_id: auth.orgId,
      provider,
      inbound_e164: inboundE164,
      lola_enabled: Boolean(body.lolaEnabled),
      manager_notify_email: String(body.managerNotifyEmail || '').trim() || null,
      notes: String(body.notes || '').trim() || null,
      updated_at: new Date().toISOString(),
    }

    const existing = await supabaseRest(
      `organization_telephony?organization_id=eq.${encodeURIComponent(auth.orgId)}&select=organization_id&limit=1`,
    )

    if (existing?.[0]) {
      await supabaseRest(`organization_telephony?organization_id=eq.${encodeURIComponent(auth.orgId)}`, {
        method: 'PATCH',
        body: JSON.stringify(payload),
        prefer: 'return=minimal',
      })
    } else {
      await supabaseRest('organization_telephony', {
        method: 'POST',
        body: JSON.stringify(payload),
        prefer: 'return=minimal',
      })
    }

    await logAiAudit({
      orgId: auth.orgId,
      agent: 'system',
      action: 'telephony_config_saved',
      actorUserId: auth.user.id,
      detail: { provider, lolaEnabled: payload.lola_enabled },
    })

    return res.status(200).json({
      ok: true,
      inboundE164,
      webhookUrl: WEBHOOK_URL,
      setupSteps: buildSetupSteps(provider),
    })
  } catch (err) {
    console.error('telephony-config', err)
    const msg = err instanceof Error ? err.message : 'unknown'
    if (/duplicate|unique/i.test(msg)) {
      return res.status(409).json({
        error: 'Ce numéro est déjà utilisé par une autre société ClimaZEN.',
        code: 'phone_taken',
      })
    }
    return res.status(500).json({ error: msg })
  }
}

function buildSetupSteps(provider) {
  const name =
    provider === 'vonage' ? 'Vonage' : provider === 'plivo' ? 'Plivo' : 'Twilio'
  return [
    `1. Créez un compte ${name} et achetez un numéro français (voice).`,
    `2. Configurez le webhook « appel entrant » → POST ${WEBHOOK_URL}`,
    '3. Collez le numéro acheté ci-dessous (format +33…) et activez Lola.',
    '4. Chaque société a son propre numéro — aucun mélange entre clients ClimaZEN.',
  ]
}
