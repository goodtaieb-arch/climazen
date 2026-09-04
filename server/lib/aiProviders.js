/**
 * Façade multi-fournisseurs IA — OpenAI / Anthropic Claude / Google Gemini.
 * Même interface pour /api/assistant et /api/phone-reception.
 */

import { openaiChatCompletions } from './openaiChat.js'

export const AI_PROVIDERS = ['openai', 'anthropic', 'gemini']

export const AI_PROVIDER_LABELS = {
  openai: 'OpenAI',
  anthropic: 'Anthropic Claude',
  gemini: 'Google Gemini',
}

export const AI_PROVIDER_DEFAULT_MODELS = {
  openai: () => process.env.OPENAI_MODEL || 'gpt-4o-mini',
  /** Sonnet = plus adapté aux consignes longues + français métier */
  anthropic: () => process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-5',
  gemini: () => process.env.GEMINI_MODEL || 'gemini-2.5-flash',
}

export function normalizeAiProvider(raw) {
  const p = String(raw || 'openai').trim().toLowerCase()
  if (p === 'anthropic' || p === 'claude') return 'anthropic'
  if (p === 'gemini' || p === 'google') return 'gemini'
  return 'openai'
}

function splitSystemMessages(messages) {
  const list = Array.isArray(messages) ? messages : []
  const systemParts = []
  const rest = []
  for (const m of list) {
    if (!m) continue
    if (m.role === 'system') systemParts.push(String(m.content || ''))
    else rest.push({ role: m.role === 'assistant' ? 'assistant' : 'user', content: String(m.content || '') })
  }
  return { system: systemParts.filter(Boolean).join('\n\n'), messages: rest }
}

async function anthropicChatCompletions(opts) {
  const apiKey = String(opts.apiKey || '').trim()
  if (!apiKey) return { ok: false, status: 0, error: 'missing_key' }
  const model = opts.model || AI_PROVIDER_DEFAULT_MODELS.anthropic()
  const { system, messages } = splitSystemMessages(opts.messages)
  // Anthropic exige alternance user/assistant ; fusionner user consécutifs
  const merged = []
  for (const m of messages) {
    const last = merged[merged.length - 1]
    if (last && last.role === m.role) {
      last.content = `${last.content}\n\n${m.content}`
    } else {
      merged.push({ ...m })
    }
  }
  if (!merged.length || merged[0].role !== 'user') {
    merged.unshift({ role: 'user', content: 'Bonjour' })
  }

  const body = {
    model,
    max_tokens: opts.maxTokens ?? 700,
    temperature: opts.temperature ?? 0.4,
    messages: merged,
  }
  if (system) body.system = system
  // JSON mode soft : demander dans le system côté appelant ; Anthropic n’a pas response_format identique

  const aiRes = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify(body),
  })

  if (!aiRes.ok) {
    const errText = await aiRes.text()
    return { ok: false, status: aiRes.status, error: errText.slice(0, 400), model }
  }

  const data = await aiRes.json()
  const parts = Array.isArray(data?.content) ? data.content : []
  const content = parts
    .filter((p) => p?.type === 'text')
    .map((p) => p.text)
    .join('\n')
  return { ok: true, content, model, raw: data, provider: 'anthropic' }
}

async function geminiChatCompletions(opts) {
  const apiKey = String(opts.apiKey || '').trim()
  if (!apiKey) return { ok: false, status: 0, error: 'missing_key' }
  const model = opts.model || AI_PROVIDER_DEFAULT_MODELS.gemini()
  const { system, messages } = splitSystemMessages(opts.messages)

  const contents = []
  for (const m of messages) {
    contents.push({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    })
  }
  if (!contents.length) {
    contents.push({ role: 'user', parts: [{ text: 'Bonjour' }] })
  }

  const body = {
    contents,
    generationConfig: {
      temperature: opts.temperature ?? 0.4,
      maxOutputTokens: opts.maxTokens ?? 700,
    },
  }
  if (opts.json) {
    body.generationConfig.responseMimeType = 'application/json'
  }
  if (system) {
    body.systemInstruction = { parts: [{ text: system }] }
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`
  const aiRes = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

  if (!aiRes.ok) {
    const errText = await aiRes.text()
    return { ok: false, status: aiRes.status, error: errText.slice(0, 400), model }
  }

  const data = await aiRes.json()
  const parts = data?.candidates?.[0]?.content?.parts || []
  const content = parts.map((p) => p.text || '').join('\n')
  return { ok: true, content, model, raw: data, provider: 'gemini' }
}

/**
 * @param {{ provider?: string, apiKey: string, model?: string, messages: any[], temperature?: number, maxTokens?: number, json?: boolean }} opts
 */
export async function orgChatCompletions(opts) {
  const provider = normalizeAiProvider(opts.provider)
  const model =
    opts.model ||
    (provider === 'anthropic'
      ? AI_PROVIDER_DEFAULT_MODELS.anthropic()
      : provider === 'gemini'
        ? AI_PROVIDER_DEFAULT_MODELS.gemini()
        : AI_PROVIDER_DEFAULT_MODELS.openai())

  if (provider === 'anthropic') {
    const r = await anthropicChatCompletions({ ...opts, model })
    return { ...r, provider }
  }
  if (provider === 'gemini') {
    const r = await geminiChatCompletions({ ...opts, model })
    return { ...r, provider }
  }
  const r = await openaiChatCompletions({ ...opts, model })
  return { ...r, provider: 'openai' }
}

export function providerErrorHint(provider, status) {
  const label = AI_PROVIDER_LABELS[provider] || 'IA'
  if (status === 429) return `Quota ${label} de votre société atteint.`
  if (status === 401 || status === 403) return `Clé ${label} invalide. Vérifiez-la dans Mon entreprise.`
  return `Erreur ${label} (${status || 'réseau'}). Guide local utilisé.`
}
