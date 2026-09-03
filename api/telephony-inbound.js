/**
 * Vercel — /api/telephony-inbound
 * Webhook entrant (Twilio, Vonage, Plivo…) — 1 numéro appelé = 1 société.
 *
 * Configuration Twilio (exemple) :
 *   Voice → A call comes in → Webhook POST
 *   URL : https://climazen.fr/api/telephony-inbound
 *
 * Variables Vercel :
 *   SUPABASE_SERVICE_ROLE_KEY
 *   TWILIO_AUTH_TOKEN (optionnel — validation signature)
 */

import { supabaseRpc, supabaseRest } from '../server/lib/supabaseServer.js'
import { logAiAudit } from '../server/lib/aiAuditLog.js'
import { normalizeInboundE164 } from '../server/lib/phoneE164.js'

function parseBody(req) {
  const b = req.body
  if (!b) return {}
  if (typeof b === 'string') {
    try {
      return JSON.parse(b)
    } catch {
      /* Twilio form urlencoded often pre-parsed by Vercel */
    }
  }
  return b
}

/** Twilio envoie To, From, CallSid */
function extractCallFields(body) {
  return {
    to: normalizeInboundE164(body.To || body.to || body.destination || ''),
    from: normalizeInboundE164(body.From || body.from || body.caller || ''),
    callSid: String(body.CallSid || body.call_sid || body.uuid || '').trim(),
    provider: body.AccountSid ? 'twilio' : body.provider || 'unknown',
  }
}

function twimlSay(message) {
  const escaped = String(message || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say language="fr-FR">${escaped}</Say>
  <Pause length="1"/>
  <Say language="fr-FR">Merci. Votre demande est enregistrée pour votre société ClimaZEN.</Say>
</Response>`
}

async function resolveOrgByPhone(inboundE164) {
  if (!inboundE164) return null
  try {
    const orgId = await supabaseRpc('resolve_org_id_by_inbound_phone', {
      p_e164: inboundE164,
    })
    return orgId || null
  } catch {
    const rows = await supabaseRest(
      `organization_telephony?inbound_e164=eq.${encodeURIComponent(inboundE164)}&lola_enabled=eq.true&select=organization_id&limit=1`,
    )
    return rows?.[0]?.organization_id || null
  }
}

export default async function handler(req, res) {
  try {
    if (req.method === 'GET' || req.method === 'HEAD') {
      return res.status(200).json({
        ok: true,
        service: 'telephony-inbound',
        hint: 'Webhook POST Twilio/Vonage — numéro appelé routé vers une société.',
      })
    }

    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method not allowed' })
    }

    const body = parseBody(req)
    const { to, from, callSid, provider } = extractCallFields(body)

    if (!to) {
      res.setHeader('Content-Type', 'text/xml')
      return res.status(200).send(twimlSay('Numéro non reconnu. Contactez votre administrateur ClimaZEN.'))
    }

    const orgId = await resolveOrgByPhone(to)

    if (!orgId) {
      console.warn('telephony-inbound: unknown To', to)
      res.setHeader('Content-Type', 'text/xml')
      return res.status(200).send(
        twimlSay('Ce numéro n’est pas encore configuré dans ClimaZEN. Merci de contacter votre société.'),
      )
    }

    await logAiAudit({
      orgId,
      agent: 'phone',
      action: 'inbound_call_received',
      detail: { callSid, provider, fromLast4: from ? from.slice(-4) : undefined },
    })

    // Phase suivante : STT + Lola + actions OT. Pour l’instant : accueil + preuve de routage org OK.
    res.setHeader('Content-Type', 'text/xml')
    return res.status(200).send(
      twimlSay(
        'Bonjour, vous êtes bien en contact avec l’accueil ClimaZEN de votre société. Lola sera bientôt disponible pour prendre votre demande.',
      ),
    )
  } catch (err) {
    console.error('telephony-inbound', err)
    res.setHeader('Content-Type', 'text/xml')
    return res.status(200).send(twimlSay('Désolé, un incident technique est survenu. Merci de rappeler.'))
  }
}
