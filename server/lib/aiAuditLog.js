/**
 * Journal audit actions IA — sans données clients sensibles dans detail.
 */

import { supabaseRpc } from './supabaseServer.js'

/**
 * @param {object} opts
 * @param {string} opts.orgId
 * @param {string} opts.agent
 * @param {string} opts.action
 * @param {string} [opts.actorUserId]
 * @param {boolean} [opts.success]
 * @param {object} [opts.detail]
 */
export async function logAiAudit(opts) {
  if (!opts.orgId || !process.env.SUPABASE_SERVICE_ROLE_KEY) return null
  try {
    const safeDetail = sanitizeAuditDetail(opts.detail || {})
    return await supabaseRpc('log_ai_action_audit', {
      p_org_id: opts.orgId,
      p_agent: opts.agent,
      p_action: opts.action,
      p_actor_user_id: opts.actorUserId || null,
      p_success: opts.success !== false,
      p_detail: safeDetail,
    })
  } catch (err) {
    console.warn('logAiAudit', err instanceof Error ? err.message : err)
    return null
  }
}

const SENSITIVE_KEYS = /email|telephone|tel|siret|adresse|password|token|secret|signature|openai|api.?key/i

function sanitizeAuditDetail(detail) {
  const out = {}
  for (const [k, v] of Object.entries(detail)) {
    if (SENSITIVE_KEYS.test(k)) continue
    if (typeof v === 'string' && v.length > 500) {
      out[k] = `${v.slice(0, 500)}…`
    } else {
      out[k] = v
    }
  }
  return out
}
