/**
 * Vercel — /api/ai-org-key
 * Gérant : choisir le fournisseur IA + coller la clé (OpenAI / Claude / Gemini).
 * GET  — { provider, hasKey, hint, keys, model }
 * POST — { provider, apiKey?, model?, clear?, clearKey?, providerOnly? }
 */

import { authorizeOrgRequest } from '../server/lib/authorizeOrg.js'
import { getSupabaseConfig } from '../server/lib/supabaseServer.js'
import { logAiAudit } from '../server/lib/aiAuditLog.js'
import {
  fetchOrgAiStatus,
  upsertOrgAiConfig,
  upsertOrgOpenaiKey,
  clearOrgOpenaiKey,
} from '../server/lib/orgOpenaiKey.js'
import { normalizeAiProvider } from '../server/lib/aiProviders.js'

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

    const auth = await authorizeOrgRequest(req)
    if (!auth.ok) return res.status(auth.status).json({ error: auth.error, code: auth.code })

    if (req.method === 'GET' || req.method === 'HEAD') {
      const status = await fetchOrgAiStatus(auth.orgId)
      return res.status(200).json({
        ok: true,
        provider: status.provider,
        model: status.model,
        hasKey: status.hasKey,
        hint: auth.isOwner ? status.hint : status.hasKey ? 'configurée' : '',
        keys: status.keys || { openai: status.hasKey, anthropic: false, gemini: false },
        hints: auth.isOwner ? status.hints : undefined,
        canEdit: auth.isOwner,
      })
    }

    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
    if (!auth.isOwner) {
      return res.status(403).json({ error: 'Réservé au gérant.', code: 'owner_only' })
    }

    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {}

    // Compat ancienne API : { clear: true } ou { openaiApiKey }
    if (body.clear === true) {
      await clearOrgOpenaiKey(auth.orgId, auth.user.id)
      await logAiAudit({
        orgId: auth.orgId,
        agent: 'system',
        action: 'ai_key_cleared',
        actorUserId: auth.user.id,
      })
      return res.status(200).json({ ok: true, hasKey: false, hint: '', provider: 'openai' })
    }

    if (body.openaiApiKey && !body.provider && !body.apiKey) {
      const saved = await upsertOrgOpenaiKey(auth.orgId, body.openaiApiKey, auth.user.id)
      if (!saved.ok) return res.status(400).json({ error: saved.error })
      await logAiAudit({
        orgId: auth.orgId,
        agent: 'system',
        action: 'openai_key_saved',
        actorUserId: auth.user.id,
        detail: { hint: saved.hint },
      })
      return res.status(200).json({
        ok: true,
        hasKey: true,
        hint: saved.hint,
        provider: 'openai',
      })
    }

    const provider = normalizeAiProvider(body.provider || 'openai')
    const saved = await upsertOrgAiConfig(
      auth.orgId,
      {
        provider,
        apiKey: body.apiKey || body.openaiApiKey || body.anthropicApiKey || body.geminiApiKey,
        model: body.model,
        clearKey: body.clearKey === true,
        saveKeyOnly: body.saveKeyOnly === true,
        providerOnly:
          body.providerOnly === true ||
          (!body.apiKey && !body.openaiApiKey && !body.anthropicApiKey && body.provider),
      },
      auth.user.id,
    )
    if (!saved.ok) return res.status(400).json({ error: saved.error })

    await logAiAudit({
      orgId: auth.orgId,
      agent: 'system',
      action: body.clearKey ? 'ai_key_cleared' : 'ai_provider_saved',
      actorUserId: auth.user.id,
      detail: { provider: saved.provider, hint: saved.hint },
    })

    return res.status(200).json({
      ok: true,
      hasKey: Boolean(saved.hasKey),
      hint: saved.hint || '',
      provider: saved.provider,
      model: saved.model,
    })
  } catch (err) {
    console.error('ai-org-key', err)
    const msg = err instanceof Error ? err.message : 'unknown'
    if (/organization_ai_secrets|schema cache|does not exist/i.test(msg)) {
      return res.status(503).json({
        error:
          'Table clé IA absente. Exécutez supabase/ai-org-openai.sql puis supabase/ai-org-providers.sql.',
        code: 'sql_missing',
      })
    }
    return res.status(500).json({ error: msg })
  }
}
