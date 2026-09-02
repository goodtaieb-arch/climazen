import { answerAideLocal, AIDE_SYSTEM_PROMPT, buildAideContext } from './assistantKnowledge'
import { getSupabase, isSupabaseConfigured } from './supabase'

export type AideMessage = {
  role: 'user' | 'assistant'
  content: string
}

export type AideReply = {
  reply: string
  source: 'api' | 'local'
  /** Raison du fallback local (quota Gemini, clé, etc.) */
  fallbackHint?: string
}

/**
 * Demande une réponse à l’assistant.
 * Essaie /api/assistant (Gemini si clé serveur), sinon guide local.
 * @param entityCatalog — liste clients/sites (pour créer OT/CERFA par la voix)
 */
export async function askAideAssistant(opts: {
  messages: AideMessage[]
  pathname?: string
  entityCatalog?: string
  /** Chatbot Light : guide local uniquement (pas d’appel Gemini). */
  chatbotOnly?: boolean
  /** Société — vocabulaire technique Supabase injecté dans Gemini. */
  organizationId?: string
}): Promise<AideReply> {
  const lastUser = [...opts.messages].reverse().find((m) => m.role === 'user')
  const question = lastUser?.content || ''
  const pathname = opts.pathname || '/app'

  let fallbackHint: string | undefined
  const context = [
    buildAideContext(pathname),
    opts.entityCatalog?.trim() || '',
  ]
    .filter(Boolean)
    .join('\n\n')

  if (opts.chatbotOnly) {
    const local = answerAideLocal(question, pathname)
    return { reply: local, source: 'local' }
  }

  try {
    let token: string | undefined
    if (isSupabaseConfigured()) {
      try {
        const sb = getSupabase()
        const { data: sessionData } = await sb.auth.getSession()
        token = sessionData.session?.access_token
      } catch {
        /* hors ligne / storage */
      }
    }
    const headers: Record<string, string> = { 'Content-Type': 'application/json' }
    if (token) headers.Authorization = `Bearer ${token}`

    const res = await fetch('/api/assistant', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        messages: opts.messages.slice(-12),
        pathname,
        system: AIDE_SYSTEM_PROMPT,
        context,
        organizationId: opts.organizationId,
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
      else if (data.error === 'gemini_429' || data.error === 'openai_429') {
        fallbackHint =
          'Quota IA cloud atteint — réponses en guide local pour l’instant.'
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
