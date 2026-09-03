/**
 * Appel OpenAI Chat Completions — une clé par société (jamais la clé plateforme ClimaZEN).
 */

export async function openaiChatCompletions(opts) {
  const apiKey = String(opts.apiKey || '').trim()
  if (!apiKey) {
    return { ok: false, status: 0, error: 'missing_key' }
  }
  const model = opts.model || process.env.OPENAI_MODEL || 'gpt-4o-mini'
  const body = {
    model,
    temperature: opts.temperature ?? 0.4,
    max_tokens: opts.maxTokens ?? 700,
    messages: opts.messages,
  }
  if (opts.json) body.response_format = { type: 'json_object' }

  const aiRes = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })

  if (!aiRes.ok) {
    const errText = await aiRes.text()
    return {
      ok: false,
      status: aiRes.status,
      error: errText.slice(0, 400),
      model,
    }
  }

  const data = await aiRes.json()
  const content = data?.choices?.[0]?.message?.content || ''
  return { ok: true, content, model, raw: data }
}
