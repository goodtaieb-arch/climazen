/**
 * Vercel — /api/ai-vocabulary
 * Vocabulaire technique partagé (Gemini + OpenAI accueil + tickets/e-mails/voix).
 *
 * GET  ?orgId=… — contexte pour injection prompt (auth requise, même org)
 * POST { action, organizationId?, text, agent, before?, after?, metadata? }
 *   action: 'learn' | 'context' | 'correction'
 */

import { getSupabaseConfig } from '../server/supabaseServer.js'
import { authorizeOrgRequest } from '../server/authorizeOrg.js'
import {
  fetchVocabularyContext,
  learnFromText,
  learnFromCorrection,
  extractTechnicalMentions,
  normalizeTechnicalText,
} from '../server/aiVocabularyCore.js'

async function authorizeOrg(req, orgId) {
  const auth = await authorizeOrgRequest(req, orgId)
  if (!auth.ok) {
    return { ok: false, status: auth.status, error: auth.error }
  }
  return { ok: true, user: auth.user, profile: auth.profile, orgId: auth.orgId }
}

export default async function handler(req, res) {
  try {
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, POST, OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')

    if (req.method === 'OPTIONS') return res.status(204).end()

    const { serviceKey } = getSupabaseConfig()

    if (req.method === 'GET' || req.method === 'HEAD') {
      const orgId = String(req.query?.orgId || '').trim()
      if (!serviceKey) {
        return res.status(200).json({ ok: true, configured: false, context: '' })
      }
      if (!orgId) {
        return res.status(400).json({ error: 'orgId requis' })
      }
      const auth = await authorizeOrg(req, orgId)
      if (!auth.ok) return res.status(auth.status).json({ error: auth.error })
      const context = await fetchVocabularyContext(auth.orgId)
      return res.status(200).json({ ok: true, configured: true, context })
    }

    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {}
    const action = String(body.action || 'learn').trim()
    const orgId = String(body.organizationId || body.orgId || '').trim()

    if (!serviceKey) {
      return res.status(200).json({ ok: true, configured: false, skipped: true })
    }

    const auth = await authorizeOrg(req, orgId)
    if (!auth.ok) return res.status(auth.status).json({ error: auth.error })

    if (action === 'context') {
      const context = await fetchVocabularyContext(auth.orgId)
      return res.status(200).json({ ok: true, context })
    }

    if (action === 'correction') {
      const before = String(body.before || '')
      const after = String(body.after || '')
      const agent = String(body.agent || 'voice')
      const pair = await learnFromCorrection({
        orgId: auth.orgId,
        before,
        after,
        agent,
      })
      return res.status(200).json({ ok: true, pair })
    }

    if (action === 'extract') {
      const text = String(body.text || '')
      return res.status(200).json({
        ok: true,
        normalized: normalizeTechnicalText(text),
        mentions: extractTechnicalMentions(text),
      })
    }

    // learn (default)
    const text = String(body.text || '')
    const agent = String(body.agent || 'gemini')
    const normalizedText = body.normalizedText
      ? String(body.normalizedText)
      : normalizeTechnicalText(text)

    const result = await learnFromText({
      orgId: auth.orgId,
      text,
      agent,
      normalizedText,
      metadata: body.metadata || {},
    })

    return res.status(200).json({ ok: true, ...result })
  } catch (err) {
    console.error('ai-vocabulary', err)
    return res.status(500).json({
      error: err instanceof Error ? err.message : 'unknown',
    })
  }
}
