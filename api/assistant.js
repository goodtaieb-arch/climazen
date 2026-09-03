/**
 * Vercel Serverless — /api/assistant
 * GEMINI_API_KEY (optionnel, Google AI Studio). Sans clé → guide local côté client.
 *
 * Body POST : messages, system, context, pathname, organizationId? (vocabulaire Supabase)
 */

import {
  fetchVocabularyContext,
  learnFromText,
  normalizeTechnicalText,
} from '../server/aiVocabularyCore.js'
import { authorizeOrgRequest } from '../server/authorizeOrg.js'
import { logAiAudit } from '../server/aiAuditLog.js'

const DEFAULT_MODELS = [
  'gemini-2.5-flash',
  'gemini-2.5-flash-lite',
  'gemini-3.5-flash',
  'gemini-1.5-flash',
]

export default async function handler(req, res) {
  try {
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, POST, OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')

    if (req.method === 'OPTIONS') {
      return res.status(204).end()
    }

    const key =
      process.env.GEMINI_API_KEY ||
      process.env.GOOGLE_AI_API_KEY ||
      process.env.GOOGLE_GENERATIVE_AI_API_KEY

    if (req.method === 'GET' || req.method === 'HEAD') {
      return res.status(200).json({ cloud: Boolean(key), ok: true, provider: 'gemini' })
    }

    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method not allowed' })
    }

    if (!key) {
      return res.status(200).json({
        reply: '',
        source: 'local',
        hint: 'Ajoutez GEMINI_API_KEY dans Vercel (Google AI Studio) pour activer l’IA cloud.',
      })
    }

    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {}
    const messages = Array.isArray(body.messages) ? body.messages : []
    const system = String(body.system || 'Tu es l’assistant ClimaZEN. Réponds en français, court et clair.')
    const context = String(body.context || '')
    const pathname = String(body.pathname || '')
    const organizationId = String(body.organizationId || body.orgId || '').trim()

    const lastUserMsg = [...messages].reverse().find((m) => m?.role === 'user')
    const lastUserText = lastUserMsg?.content ? String(lastUserMsg.content) : ''

    let vocabBlock = ''
    let mayLearn = false
    let actorUserId = null
    if (organizationId && process.env.SUPABASE_SERVICE_ROLE_KEY) {
      const auth = await authorizeOrgRequest(req, organizationId)
      if (auth.ok) {
        vocabBlock = await fetchVocabularyContext(auth.orgId, 70)
        mayLearn = true
        actorUserId = auth.user.id
      } else {
        // Pas de vocabulaire / apprentissage si org non vérifiée — évite fuite inter-sociétés
        console.warn('assistant: org auth refused', auth.code)
      }
    }

    const contents = messages
      .filter((m) => m && (m.role === 'user' || m.role === 'assistant') && m.content)
      .slice(-12)
      .map((m) => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: String(m.content).slice(0, 4000) }],
      }))

    if (contents.length === 0 || contents[contents.length - 1].role !== 'user') {
      contents.push({
        role: 'user',
        parts: [{ text: 'Peux-tu m’aider sur ClimaZEN ?' }],
      })
    }

    const preferred = process.env.GEMINI_MODEL || DEFAULT_MODELS[0]
    const models = [preferred, ...DEFAULT_MODELS.filter((m) => m !== preferred)]

    const payload = {
      systemInstruction: {
        parts: [
          {
            text: [
              system,
              context ? `\n\nContexte page :\n${context}` : '',
              vocabBlock ? `\n\n${vocabBlock}\n\nUtilise ce vocabulaire pour interpréter correctement les termes techniques et reformulations du technicien.` : '',
              pathname ? `\n\nURL : ${pathname}` : '',
            ]
              .filter(Boolean)
              .join(''),
          },
        ],
      },
      contents,
      generationConfig: {
        temperature: 0.4,
        maxOutputTokens: 700,
      },
    }

    let lastStatus = 0
    let lastErr = ''

    for (const model of models) {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`
      const aiRes = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': key,
        },
        body: JSON.stringify(payload),
      })

      if (!aiRes.ok) {
        lastStatus = aiRes.status
        lastErr = await aiRes.text()
        console.error('Gemini error', model, aiRes.status, lastErr.slice(0, 400))
        // 404 = modèle indisponible → essayer le suivant
        if (aiRes.status === 404) continue
        const hint =
          aiRes.status === 429
            ? 'Quota Gemini atteint. Réessayez plus tard — en attendant, guide local.'
            : aiRes.status === 400 || aiRes.status === 403
              ? 'Clé Gemini invalide ou modèle non autorisé. Vérifiez GEMINI_API_KEY / GEMINI_MODEL sur Vercel.'
              : `Erreur Gemini (${aiRes.status}). Guide local utilisé.`
        return res.status(200).json({
          reply: '',
          source: 'local',
          error: `gemini_${aiRes.status}`,
          hint,
        })
      }

      const data = await aiRes.json()
      const parts = data?.candidates?.[0]?.content?.parts
      const reply = Array.isArray(parts)
        ? parts
            .map((p) => (typeof p?.text === 'string' ? p.text : ''))
            .join('')
            .trim()
        : ''

      if (!reply) {
        lastStatus = 200
        lastErr = 'empty'
        continue
      }

      if (mayLearn && lastUserText.trim()) {
        void learnFromText({
          orgId: organizationId,
          text: lastUserText,
          agent: 'gemini',
          normalizedText: normalizeTechnicalText(lastUserText),
          metadata: { pathname, model },
        }).catch(() => undefined)
        void logAiAudit({
          orgId: organizationId,
          agent: 'gemini',
          action: 'assistant_reply',
          actorUserId,
          detail: { pathname, model },
        })
      }

      return res.status(200).json({ reply, source: 'api', provider: 'gemini', model })
    }

    return res.status(200).json({
      reply: '',
      source: 'local',
      error: lastStatus ? `gemini_${lastStatus}` : 'gemini_empty',
      hint:
        lastStatus === 404
          ? 'Aucun modèle Gemini disponible. Définissez GEMINI_MODEL sur Vercel (ex. gemini-2.5-flash).'
          : 'Réponse Gemini vide. Guide local utilisé.',
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
