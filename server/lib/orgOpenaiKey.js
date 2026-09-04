/**
 * Secrets IA par société — OpenAI / Anthropic / Gemini (jamais renvoyer la clé complète).
 */

import { normalizeAiProvider, AI_PROVIDER_DEFAULT_MODELS } from './aiProviders.js'

/** Nettoie un collage mobile (espaces, guillemets, Bearer, caractères invisibles). */
export function sanitizeApiKeyPaste(raw) {
  return String(raw || '')
    .replace(/^\uFEFF/, '')
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .trim()
    .replace(/^Bearer\s+/i, '')
    .replace(/^["'`]+|["'`]+$/g, '')
    .replace(/["'`]/g, '')
    .replace(/\s+/g, '')
    .trim()
}

export function maskOpenaiKey(raw) {
  const key = sanitizeApiKeyPaste(raw)
  if (key.length < 8) return ''
  const last = key.slice(-4)
  if (key.startsWith('sk-ant-')) return `sk-ant-…${last}`
  if (key.startsWith('sk-')) return `sk-…${last}`
  return `…${last}`
}

export function maskApiKey(raw, provider = 'openai') {
  const key = sanitizeApiKeyPaste(raw)
  if (key.length < 8) return ''
  const last = key.slice(-4)
  if (provider === 'anthropic' || key.startsWith('sk-ant-')) return `sk-ant-…${last}`
  if (provider === 'openai' || key.startsWith('sk-')) return `sk-…${last}`
  return `…${last}`
}

/** @returns {{ ok: true, key: string } | { ok: false, error: string }} */
export function parseOpenaiKey(raw) {
  const key = sanitizeApiKeyPaste(raw)
  if (!key) return { ok: false, error: 'empty' }
  if (key.startsWith('sk-ant-')) {
    return {
      ok: false,
      error: 'Ça ressemble à une clé Claude (sk-ant-…). Collez-la dans le bloc Claude, pas OpenAI.',
    }
  }
  if (key.length < 20 || key.length > 512) {
    return { ok: false, error: 'Clé OpenAI invalide (longueur).' }
  }
  if (!/^sk-[A-Za-z0-9_\-]+$/.test(key)) {
    return { ok: false, error: 'La clé OpenAI doit commencer par sk- ou sk-proj-.' }
  }
  return { ok: true, key }
}

export function parseAnthropicKey(raw) {
  const key = sanitizeApiKeyPaste(raw)
  if (!key) return { ok: false, error: 'empty' }

  // Erreurs fréquentes : mauvaise clé collée
  if (/^sk-(?!ant-)/i.test(key) || key.startsWith('sk-proj-')) {
    return {
      ok: false,
      error:
        'Vous avez collé une clé OpenAI (sk-… / sk-proj-…). Pour Claude, créez une clé sur console.anthropic.com/settings/keys — elle commence par sk-ant-.',
    }
  }
  if (/^AIza/i.test(key)) {
    return {
      ok: false,
      error: 'Ça ressemble à une clé Google Gemini. Pour Claude il faut sk-ant-…',
    }
  }

  if (key.length < 20 || key.length > 512) {
    return {
      ok: false,
      error: `Clé Anthropic invalide (longueur ${key.length}). Copiez toute la clé sk-ant-… affichée une seule fois.`,
    }
  }

  // Format réel : sk-ant-api03-… (lettres, chiffres, tirets, underscores)
  if (!/^sk-ant-[A-Za-z0-9_\-]+$/.test(key)) {
    const debut = key.slice(0, 12)
    return {
      ok: false,
      error: `Clé Claude refusée (début reçu : « ${debut}… »). Elle doit commencer exactement par sk-ant- (pas un ID workspace ni un code cloud). Page : console.anthropic.com/settings/keys → Create Key → copier tout de suite.`,
    }
  }
  return { ok: true, key }
}

export function parseGeminiKey(raw) {
  const key = sanitizeApiKeyPaste(raw)
  if (!key) return { ok: false, error: 'empty' }
  if (key.length < 20 || key.length > 512) {
    return { ok: false, error: 'Clé Gemini invalide (longueur).' }
  }
  if (!/^[A-Za-z0-9_\-]+$/.test(key)) {
    return { ok: false, error: 'Clé Gemini invalide (caractères).' }
  }
  return { ok: true, key }
}

async function restSelect(orgId, select) {
  const { supabaseRest } = await import('./supabaseServer.js')
  const id = String(orgId || '').trim()
  if (!id) return null
  const rows = await supabaseRest(
    `organization_ai_secrets?organization_id=eq.${encodeURIComponent(id)}&select=${select}&limit=1`,
  )
  return rows?.[0] || null
}

export async function fetchOrgOpenaiKey(orgId) {
  const row = await restSelect(orgId, 'openai_api_key')
  const key = String(row?.openai_api_key || '').trim()
  return key || null
}

/**
 * Credentials actifs selon ai_provider (fallback openai).
 * @returns {{ provider: string, apiKey: string|null, model: string, hasKey: boolean }}
 */
export async function fetchOrgAiCredentials(orgId) {
  let row = null
  try {
    row = await restSelect(
      orgId,
      'ai_provider,ai_model,openai_api_key,anthropic_api_key,gemini_api_key',
    )
  } catch {
    // Colonnes multi-provider absentes → OpenAI seul
    const key = await fetchOrgOpenaiKey(orgId)
    return {
      provider: 'openai',
      apiKey: key,
      model: AI_PROVIDER_DEFAULT_MODELS.openai(),
      hasKey: Boolean(key),
    }
  }

  if (!row) {
    return {
      provider: 'openai',
      apiKey: null,
      model: AI_PROVIDER_DEFAULT_MODELS.openai(),
      hasKey: false,
    }
  }

  const provider = normalizeAiProvider(row.ai_provider)
  const customModel = String(row.ai_model || '').trim()
  let apiKey = null
  if (provider === 'anthropic') apiKey = String(row.anthropic_api_key || '').trim() || null
  else if (provider === 'gemini') apiKey = String(row.gemini_api_key || '').trim() || null
  else apiKey = String(row.openai_api_key || '').trim() || null

  // Si provider choisi sans clé → tenter OpenAI déjà collée (compat)
  if (!apiKey && provider !== 'openai') {
    const fallback = String(row.openai_api_key || '').trim()
    if (fallback) {
      return {
        provider: 'openai',
        apiKey: fallback,
        model: customModel || AI_PROVIDER_DEFAULT_MODELS.openai(),
        hasKey: true,
        fallbackFrom: provider,
      }
    }
  }

  const model =
    customModel ||
    (provider === 'anthropic'
      ? AI_PROVIDER_DEFAULT_MODELS.anthropic()
      : provider === 'gemini'
        ? AI_PROVIDER_DEFAULT_MODELS.gemini()
        : AI_PROVIDER_DEFAULT_MODELS.openai())

  return { provider, apiKey, model, hasKey: Boolean(apiKey) }
}

export async function fetchOrgOpenaiHint(orgId) {
  return fetchOrgAiStatus(orgId)
}

export async function fetchOrgAiStatus(orgId) {
  let row = null
  try {
    row = await restSelect(
      orgId,
      'ai_provider,ai_model,openai_api_key,openai_key_hint,anthropic_api_key,anthropic_key_hint,gemini_api_key,gemini_key_hint',
    )
  } catch {
    const key = await fetchOrgOpenaiKey(orgId)
    return {
      provider: 'openai',
      model: AI_PROVIDER_DEFAULT_MODELS.openai(),
      hasKey: Boolean(key),
      hint: key ? maskApiKey(key, 'openai') : '',
      keys: { openai: Boolean(key), anthropic: false, gemini: false },
    }
  }

  if (!row) {
    return {
      provider: 'openai',
      model: AI_PROVIDER_DEFAULT_MODELS.openai(),
      hasKey: false,
      hint: '',
      keys: { openai: false, anthropic: false, gemini: false },
    }
  }

  const provider = normalizeAiProvider(row.ai_provider)
  const keys = {
    openai: Boolean(String(row.openai_api_key || '').trim()),
    anthropic: Boolean(String(row.anthropic_api_key || '').trim()),
    gemini: Boolean(String(row.gemini_api_key || '').trim()),
  }
  const hints = {
    openai: String(row.openai_key_hint || '').trim() || (keys.openai ? maskApiKey(row.openai_api_key, 'openai') : ''),
    anthropic:
      String(row.anthropic_key_hint || '').trim() ||
      (keys.anthropic ? maskApiKey(row.anthropic_api_key, 'anthropic') : ''),
    gemini:
      String(row.gemini_key_hint || '').trim() ||
      (keys.gemini ? maskApiKey(row.gemini_api_key, 'gemini') : ''),
  }
  const hasKey = Boolean(keys[provider])
  const model =
    String(row.ai_model || '').trim() ||
    (provider === 'anthropic'
      ? AI_PROVIDER_DEFAULT_MODELS.anthropic()
      : provider === 'gemini'
        ? AI_PROVIDER_DEFAULT_MODELS.gemini()
        : AI_PROVIDER_DEFAULT_MODELS.openai())

  return {
    provider,
    model,
    hasKey,
    hint: hints[provider] || '',
    keys,
    hints,
  }
}

async function upsertRow(orgId, patch, actorUserId) {
  const { supabaseRest } = await import('./supabaseServer.js')
  const payload = {
    organization_id: orgId,
    ...patch,
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
}

export async function upsertOrgOpenaiKey(orgId, key, actorUserId) {
  const parsed = parseOpenaiKey(key)
  if (!parsed.ok) return parsed
  const hint = maskApiKey(parsed.key, 'openai')
  try {
    await upsertRow(
      orgId,
      {
        openai_api_key: parsed.key,
        openai_key_hint: hint,
        ai_provider: 'openai',
      },
      actorUserId,
    )
  } catch (err) {
    // Sans colonnes multi-provider
    await upsertRow(
      orgId,
      { openai_api_key: parsed.key, openai_key_hint: hint },
      actorUserId,
    )
  }
  return { ok: true, hint, provider: 'openai' }
}

/**
 * Enregistre provider + clé associée (+ modèle optionnel).
 * opts.saveKeyOnly = true → enregistre la clé SANS changer le fournisseur actif
 *   (ex. coller Claude tout en gardant OpenAI actif pour le moment).
 */
export async function upsertOrgAiConfig(orgId, opts, actorUserId) {
  const provider = normalizeAiProvider(opts.provider)
  const model = String(opts.model || '').trim() || null
  const saveKeyOnly = opts.saveKeyOnly === true
  const patch = {}
  if (!saveKeyOnly) {
    patch.ai_provider = provider
    if (model) patch.ai_model = model
  } else if (model) {
    // Ne touche pas au modèle actif si on ne fait que stocker une clé secondaire
  }

  if (opts.clearKey) {
    if (provider === 'anthropic') {
      patch.anthropic_api_key = null
      patch.anthropic_key_hint = null
    } else if (provider === 'gemini') {
      patch.gemini_api_key = null
      patch.gemini_key_hint = null
    } else {
      patch.openai_api_key = null
      patch.openai_key_hint = null
    }
    // Si on retire la clé du provider actif, basculer vers openai s’il reste une clé
    if (!saveKeyOnly) {
      // keep patch.ai_provider if set; on clearKey of active, caller may set providerOnly later
    }
    await upsertRow(orgId, patch, actorUserId)
    const status = await fetchOrgAiStatus(orgId)
    return { ok: true, provider: status.provider, hasKey: status.hasKey, hint: status.hint }
  }

  const rawKey = String(opts.apiKey || '').trim()
  if (rawKey) {
    if (provider === 'anthropic') {
      const parsed = parseAnthropicKey(rawKey)
      if (!parsed.ok) return parsed
      patch.anthropic_api_key = parsed.key
      patch.anthropic_key_hint = maskApiKey(parsed.key, 'anthropic')
    } else if (provider === 'gemini') {
      const parsed = parseGeminiKey(rawKey)
      if (!parsed.ok) return parsed
      patch.gemini_api_key = parsed.key
      patch.gemini_key_hint = maskApiKey(parsed.key, 'gemini')
    } else {
      const parsed = parseOpenaiKey(rawKey)
      if (!parsed.ok) return parsed
      patch.openai_api_key = parsed.key
      patch.openai_key_hint = maskApiKey(parsed.key, 'openai')
    }
  } else if (opts.providerOnly) {
    // Changer de provider sans nouvelle clé
    if (saveKeyOnly) return { ok: false, error: 'Rien à enregistrer.' }
  } else {
    return { ok: false, error: 'Clé API requise.' }
  }

  try {
    await upsertRow(orgId, patch, actorUserId)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    if (/ai_provider|anthropic_api_key|gemini_api_key|schema cache|column/i.test(msg)) {
      if (provider !== 'openai') {
        return {
          ok: false,
          error:
            'Colonnes multi-IA absentes. Exécutez supabase/ai-org-providers.sql dans Supabase, puis réessayez.',
        }
      }
      // OpenAI seul sur ancien schéma
      if (patch.openai_api_key) {
        await upsertRow(
          orgId,
          { openai_api_key: patch.openai_api_key, openai_key_hint: patch.openai_key_hint },
          actorUserId,
        )
        return { ok: true, provider: 'openai', hint: patch.openai_key_hint, hasKey: true }
      }
    }
    throw err
  }

  const status = await fetchOrgAiStatus(orgId)
  return {
    ok: true,
    provider: status.provider,
    hint: status.hint,
    hasKey: status.hasKey,
    model: status.model,
  }
}

export async function clearOrgOpenaiKey(orgId, actorUserId) {
  const { supabaseRest } = await import('./supabaseServer.js')
  const existing = await supabaseRest(
    `organization_ai_secrets?organization_id=eq.${encodeURIComponent(orgId)}&select=organization_id&limit=1`,
  )
  if (!existing?.[0]) return { ok: true }
  const patch = {
    openai_api_key: null,
    openai_key_hint: null,
    updated_at: new Date().toISOString(),
    updated_by_user_id: actorUserId || null,
  }
  try {
    await supabaseRest(`organization_ai_secrets?organization_id=eq.${encodeURIComponent(orgId)}`, {
      method: 'PATCH',
      body: JSON.stringify({
        ...patch,
        anthropic_api_key: null,
        anthropic_key_hint: null,
        gemini_api_key: null,
        gemini_key_hint: null,
      }),
      prefer: 'return=minimal',
    })
  } catch {
    await supabaseRest(`organization_ai_secrets?organization_id=eq.${encodeURIComponent(orgId)}`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
      prefer: 'return=minimal',
    })
  }
  return { ok: true }
}
