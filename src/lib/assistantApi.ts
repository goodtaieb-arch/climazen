import { answerAideLocal, AIDE_SYSTEM_PROMPT, buildAideContext } from './assistantKnowledge'

export type AideMessage = {
  role: 'user' | 'assistant'
  content: string
}

export type AideReply = {
  reply: string
  source: 'api' | 'local'
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
      const data = (await res.json()) as { reply?: string; source?: string }
      if (data.reply?.trim()) {
        return {
          reply: data.reply.trim(),
          source: data.source === 'local' ? 'local' : 'api',
        }
      }
    }
  } catch {
    /* réseau / pas d’API → fallback local */
  }

  return {
    reply: answerAideLocal(question, pathname),
    source: 'local',
  }
}
