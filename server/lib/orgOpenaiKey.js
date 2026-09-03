/**
 * Clé OpenAI par société — validation / masquage (jamais renvoyer la clé complète).
 */

export function maskOpenaiKey(raw) {
  const key = String(raw || '').trim()
  if (key.length < 8) return ''
  const last = key.slice(-4)
  if (key.startsWith('sk-')) return `sk-…${last}`
  return `…${last}`
}

/** @returns {{ ok: true, key: string } | { ok: false, error: string }} */
export function parseOpenaiKey(raw) {
  const key = String(raw || '').trim()
  if (!key) return { ok: false, error: 'empty' }
  if (key.length < 20 || key.length > 256) {
    return { ok: false, error: 'Clé OpenAI invalide (longueur).' }
  }
  if (!/^sk-[A-Za-z0-9_\-]+$/.test(key)) {
    return { ok: false, error: 'La clé doit commencer par sk- (clé API OpenAI).' }
  }
  return { ok: true, key }
}

export async function fetchOrgOpenaiKey(orgId) {
  const { supabaseRest } = await import('./supabaseServer.js')
  const id = String(orgId || '').trim()
  if (!id) return null
  const rows = await supabaseRest(
    `organization_ai_secrets?organization_id=eq.${encodeURIComponent(id)}&select=openai_api_key,openai_key_hint&limit=1`,
  )
  const key = String(rows?.[0]?.openai_api_key || '').trim()
  return key || null
}

export async function fetchOrgOpenaiHint(orgId) {
  const { supabaseRest } = await import('./supabaseServer.js')
  const id = String(orgId || '').trim()
  if (!id) return { hasKey: false, hint: '' }
  const rows = await supabaseRest(
    `organization_ai_secrets?organization_id=eq.${encodeURIComponent(id)}&select=openai_key_hint,openai_api_key&limit=1`,
  )
  const row = rows?.[0]
  const key = String(row?.openai_api_key || '').trim()
  const hint = String(row?.openai_key_hint || '').trim() || (key ? maskOpenaiKey(key) : '')
  return { hasKey: Boolean(key), hint }
}

export async function upsertOrgOpenaiKey(orgId, key, actorUserId) {
  const { supabaseRest } = await import('./supabaseServer.js')
  const parsed = parseOpenaiKey(key)
  if (!parsed.ok) return parsed
  const hint = maskOpenaiKey(parsed.key)
  const payload = {
    organization_id: orgId,
    openai_api_key: parsed.key,
    openai_key_hint: hint,
    updated_at: new Date().toISOString(),
    updated_by_user_id: actorUserId || null,
  }
  const existing = await supabaseRest(
    `organization_ai_secrets?organization_id=eq.${encodeURIComponent(orgId)}&select=organization_id&limit=1`,
  )
  if (existing?.[0]) {
    await supabaseRest(`organization_ai_secrets?organization_id=eq.${encodeURIComponent(orgId)}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
      prefer: 'return=minimal',
    })
  } else {
    await supabaseRest('organization_ai_secrets', {
      method: 'POST',
      body: JSON.stringify(payload),
      prefer: 'return=minimal',
    })
  }
  return { ok: true, hint }
}

export async function clearOrgOpenaiKey(orgId, actorUserId) {
  const { supabaseRest } = await import('./supabaseServer.js')
  const existing = await supabaseRest(
    `organization_ai_secrets?organization_id=eq.${encodeURIComponent(orgId)}&select=organization_id&limit=1`,
  )
  if (!existing?.[0]) return { ok: true }
  await supabaseRest(`organization_ai_secrets?organization_id=eq.${encodeURIComponent(orgId)}`, {
    method: 'PATCH',
    body: JSON.stringify({
      openai_api_key: null,
      openai_key_hint: null,
      updated_at: new Date().toISOString(),
      updated_by_user_id: actorUserId || null,
    }),
    prefer: 'return=minimal',
  })
  return { ok: true }
}
