import { answerAideLocal, AIDE_SYSTEM_PROMPT, buildAideContext } from './assistantKnowledge'

export type AideMessage = {
  role: 'user' | 'assistant'
  content: string
}

export type AideReply = {
  reply: string
  source: 'api' | 'local'
  /** Raison du fallback local (quota OpenAI, clé, etc.) */
  fallbackHint?: string
}

/**
 * Demande une réponse à l’assistant.
 * Essaie /api/assistant (OpenAI si clé serveur), sinon guide local.
 */
export async function askAideAssistant(opts: {
  messages: AideMessage[]
  pathname?: string
}): Promise<AideReply> {
  const lastUser = [...opts.messages].reverse().find((m) => m.role === 'user')
  const question = lastUser?.content || ''
  const pathname = opts.pathname || '/app'

  let fallbackHint: string | undefined

  try {
    const res = await fetch('/api/assistant', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: opts.messages.slice(-12),
        pathname,
        system: AIDE_SYSTEM_PROMPT,
        context: buildAideContext(pathname),
      }),
    })
    if (res.ok) {
      const data = (await res.json()) as {
        reply?: string
        source?: string
        hint?: string
        error?: string
      }
      if (data.reply?.trim()) {
        return {
          reply: data.reply.trim(),
          source: data.source === 'local' ? 'local' : 'api',
        }
      }
      if (data.hint?.trim()) fallbackHint = data.hint.trim()
      else if (data.error === 'openai_429') {
        fallbackHint =
          'Quota OpenAI atteint — réponses en guide local pour l’instant.'
      }
    }
  } catch {
    /* réseau / pas d’API → fallback local */
  }

  const local = answerAideLocal(question, pathname)
  return {
    reply: fallbackHint ? `${local}\n\n—\n${fallbackHint}` : local,
    source: 'local',
    fallbackHint,
  }
}
