/**
 * Vercel — /api/ai-org-key
 * Gérant : coller / retirer la clé OpenAI de SA société (site + Lola).
 * GET  — { hasKey, hint }  (jamais la clé complète)
 * POST — { openaiApiKey } | { clear: true }
 */

import { authorizeOrgRequest } from '../server/lib/authorizeOrg.js'
import { getSupabaseConfig } from '../server/lib/supabaseServer.js'
import { logAiAudit } from '../server/lib/aiAuditLog.js'
import {
  fetchOrgOpenaiHint,
  upsertOrgOpenaiKey,
  clearOrgOpenaiKey,
} from '../server/lib/orgOpenaiKey.js'

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
      const status = await fetchOrgOpenaiHint(auth.orgId)
      return res.status(200).json({
        ok: true,
        provider: 'openai',
        hasKey: status.hasKey,
        hint: auth.isOwner ? status.hint : status.hasKey ? 'configurée' : '',
        canEdit: auth.isOwner,
      })
    }

    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
    if (!auth.isOwner) {
      return res.status(403).json({ error: 'Réservé au gérant.', code: 'owner_only' })
    }

    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {}
    if (body.clear === true || String(body.openaiApiKey || '').trim() === '') {
      await clearOrgOpenaiKey(auth.orgId, auth.user.id)
      await logAiAudit({
        orgId: auth.orgId,
        agent: 'system',
        action: 'openai_key_cleared',
        actorUserId: auth.user.id,
      })
      return res.status(200).json({ ok: true, hasKey: false, hint: '' })
    }

    const saved = await upsertOrgOpenaiKey(auth.orgId, body.openaiApiKey, auth.user.id)
    if (!saved.ok) {
      return res.status(400).json({ error: saved.error })
    }
    await logAiAudit({
      orgId: auth.orgId,
      agent: 'system',
      action: 'openai_key_saved',
      actorUserId: auth.user.id,
      detail: { hint: saved.hint },
    })
    return res.status(200).json({ ok: true, hasKey: true, hint: saved.hint })
  } catch (err) {
    console.error('ai-org-key', err)
    const msg = err instanceof Error ? err.message : 'unknown'
    if (/organization_ai_secrets|schema cache|does not exist/i.test(msg)) {
      return res.status(503).json({
        error:
          'Table clé OpenAI absente. Exécutez supabase/ai-org-openai.sql dans l’éditeur SQL Supabase.',
        code: 'sql_missing',
      })
    }
    return res.status(500).json({ error: msg })
  }
}
