/**
 * Vercel Serverless — /api/assistant
 * Clé IA par société (OpenAI / Claude / Gemini). Sans clé → guide local.
 *
 * Body POST : messages, system, context, pathname, organizationId?
 */

import {
  fetchVocabularyContext,
  learnFromText,
  normalizeTechnicalText,
} from '../server/lib/aiVocabularyCore.js'
import { authorizeOrgRequest } from '../server/lib/authorizeOrg.js'
import { logAiAudit } from '../server/lib/aiAuditLog.js'
import { fetchOrgAiCredentials, fetchOrgAiStatus } from '../server/lib/orgOpenaiKey.js'
import { orgChatCompletions, providerErrorHint, AI_PROVIDER_LABELS } from '../server/lib/aiProviders.js'

const NO_KEY_HINT =
  'Ajoutez une clé IA (OpenAI, Claude ou Gemini) dans Mon entreprise — votre société paie l’usage (site + Lola).'

export default async function handler(req, res) {
  try {
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, POST, OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')

    if (req.method === 'OPTIONS') {
      return res.status(204).end()
    }

    if (req.method === 'GET' || req.method === 'HEAD') {
      const auth = await authorizeOrgRequest(req)
      if (!auth.ok) {
        return res.status(200).json({ cloud: false, ok: true, provider: 'openai' })
      }
      const status = await fetchOrgAiStatus(auth.orgId).catch(() => ({ hasKey: false, provider: 'openai' }))
      return res.status(200).json({
        cloud: Boolean(status.hasKey),
        ok: true,
        provider: status.provider || 'openai',
        model: status.model,
        hasOrgKey: Boolean(status.hasKey),
      })
    }

    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method not allowed' })
    }

    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {}
    const messages = Array.isArray(body.messages) ? body.messages : []
    const system = String(body.system || 'Tu es l’assistant ClimaZEN. Réponds en français, court et clair.')
    const context = String(body.context || '')
    const pathname = String(body.pathname || '')
    const organizationId = String(body.organizationId || body.orgId || '').trim()

    const auth = await authorizeOrgRequest(req, organizationId || undefined)
    if (!auth.ok) {
      return res.status(200).json({
        reply: '',
        source: 'local',
        error: auth.code || 'unauthorized',
        hint: auth.error,
      })
    }

    let creds
    try {
      creds = await fetchOrgAiCredentials(auth.orgId)
    } catch (err) {
      const msg = err instanceof Error ? err.message : ''
      if (/organization_ai_secrets|schema cache|does not exist/i.test(msg)) {
        return res.status(200).json({
          reply: '',
          source: 'local',
          error: 'sql_missing',
          hint: 'Exécutez supabase/ai-org-openai.sql (+ ai-org-providers.sql) puis collez votre clé IA dans Mon entreprise.',
        })
      }
      throw err
    }

    if (!creds.apiKey) {
      return res.status(200).json({
        reply: '',
        source: 'local',
        error: 'ai_key_missing',
        hint: NO_KEY_HINT,
      })
    }

    const lastUserMsg = [...messages].reverse().find((m) => m?.role === 'user')
    const lastUserText = lastUserMsg?.content ? String(lastUserMsg.content) : ''

    const vocabBlock = await fetchVocabularyContext(auth.orgId, 70)

    const chatMessages = [
      {
        role: 'system',
        content: [
          system,
          context ? `\n\nContexte page :\n${context}` : '',
          vocabBlock
            ? `\n\n${vocabBlock}\n\nUtilise ce vocabulaire pour interpréter correctement les termes techniques et reformulations du technicien.`
            : '',
          pathname ? `\n\nURL : ${pathname}` : '',
        ]
          .filter(Boolean)
          .join(''),
      },
      ...messages
        .filter((m) => m && (m.role === 'user' || m.role === 'assistant') && m.content)
        .slice(-12)
        .map((m) => ({
          role: m.role === 'assistant' ? 'assistant' : 'user',
          content: String(m.content).slice(0, 4000),
        })),
    ]

    if (chatMessages[chatMessages.length - 1]?.role !== 'user') {
      chatMessages.push({ role: 'user', content: 'Peux-tu m’aider sur ClimaZEN ?' })
    }

    const ai = await orgChatCompletions({
      provider: creds.provider,
      apiKey: creds.apiKey,
      model: creds.model,
      messages: chatMessages,
      temperature: 0.4,
      maxTokens: 900,
    })

    if (!ai.ok) {
      const hint = providerErrorHint(creds.provider, ai.status)
      return res.status(200).json({
        reply: '',
        source: 'local',
        error: `ai_${ai.status || 'error'}`,
        hint,
        provider: creds.provider,
      })
    }

    const reply = String(ai.content || '').trim()
    if (!reply) {
      return res.status(200).json({
        reply: '',
        source: 'local',
        error: 'ai_empty',
        hint: `Réponse ${AI_PROVIDER_LABELS[creds.provider] || 'IA'} vide. Guide local utilisé.`,
        provider: creds.provider,
      })
    }

    if (lastUserText.trim()) {
      void learnFromText({
        orgId: auth.orgId,
        text: lastUserText,
        agent: 'openai',
        normalizedText: normalizeTechnicalText(lastUserText),
        metadata: { pathname, model: ai.model, provider: creds.provider },
      }).catch(() => undefined)
      void logAiAudit({
        orgId: auth.orgId,
        agent: 'openai',
        action: 'assistant_reply',
        actorUserId: auth.user.id,
        detail: { pathname, model: ai.model, provider: creds.provider },
      })
    }

    return res.status(200).json({
      reply,
      source: 'api',
      provider: creds.provider,
      model: ai.model,
    })
  } catch (err) {
    console.error('assistant api', err)
    return res.status(200).json({
      reply: '',
      source: 'local',
      error: err instanceof Error ? err.message : 'unknown',
    })
  }
}
