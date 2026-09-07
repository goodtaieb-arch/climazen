import { answerAideLocal, AIDE_SYSTEM_PROMPT, buildAideContext } from './assistantKnowledge'
import { getSupabase, isSupabaseConfigured } from './supabase'
import type { AppData } from './types'

export type AideMessage = {
  role: 'user' | 'assistant'
  content: string
}

export type AideReply = {
  reply: string
  source: 'api' | 'local'
  /** Raison du fallback local (quota OpenAI, clé manquante, etc.) */

  fallbackHint?: string
}

/**
 * Demande une réponse à l’assistant.
 * Essaie /api/assistant (OpenAI si clé société), sinon guide local.
 * @param entityCatalog — liste clients/sites (pour créer OT/CERFA par la voix)
 */
export async function askAideAssistant(opts: {
  messages: AideMessage[]
  pathname?: string
  entityCatalog?: string
  /** Chatbot Light : guide local uniquement (pas d’appel OpenAI). */
  chatbotOnly?: boolean
  /** Société — vocabulaire technique Supabase injecté dans OpenAI. */
  organizationId?: string
  /** Requête issue du mode main libre : réponse orale très courte. */
  voiceMode?: boolean
  /** Utilisateur et appareil courants, sans donnée sensible. */
  userContext?: string
  /** Données société — lectures locales si le cloud est indisponible. */
  data?: AppData
}): Promise<AideReply> {
  const lastUser = [...opts.messages].reverse().find((m) => m.role === 'user')
  const question = lastUser?.content || ''
  const pathname = opts.pathname || '/app'

  let fallbackHint: string | undefined
  const context = [
    buildAideContext(pathname),
    opts.userContext?.trim() || '',
    opts.entityCatalog?.trim() || '',
    opts.voiceMode
      ? `MODE VOCAL TERRAIN :
- Réponds en français en 1 ou 2 phrases très courtes (25 mots maximum).
- Donne d’abord le résultat ou l’action utile, sans introduction ni longue explication.
- Si une action doit être validée, dis clairement qu’elle est préparée et demande « oui ».
- Ne dis jamais qu’une action est exécutée tant que l’application ne l’a pas réellement enregistrée.`
      : '',
  ]
    .filter(Boolean)
    .join('\n\n')

  if (opts.chatbotOnly) {
    const local = answerAideLocal(question, pathname, opts.data)
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
        voiceMode: opts.voiceMode,
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

  const local = answerAideLocal(question, pathname, opts.data)
  return {
    reply: fallbackHint ? `${local}\n\n—\n${fallbackHint}` : local,
    source: 'local',
    fallbackHint,
  }
}
