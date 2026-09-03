/**
 * Vercel — /api/phone-reception
 * Agent d’accueil téléphonique (OpenAI) — même clé société que l’assistant site.
 *
 * POST { transcript, callerContext?, learn? }
 * Authorization: Bearer <session Supabase>
 *
 * OPENAI_API_KEY requis. Modèle par défaut : gpt-4o-mini
 */

import { verifySupabaseUser, userOrgProfile } from '../server/lib/supabaseServer.js'
import {
  fetchVocabularyContext,
  learnFromText,
  normalizeTechnicalText,
  extractTechnicalMentions,
} from '../server/lib/aiVocabularyCore.js'

const SYSTEM_BASE = `Tu es l’agent d’accueil téléphonique ClimaZEN pour une société de froid / climatisation.
Tu comprends le jargon terrain (PAC, R-32, CERFA, contrôle d’étanchéité, dépannage, monobloc, chambre froide…).
Objectifs :
1) Comprendre la demande client (panne, entretien, urgence, RDV).
2) Repérer site, équipement, fluide, symptômes techniques.
3) Proposer une synthèse structurée pour créer un OT dans ClimaZEN.

Réponds en JSON strict :
{
  "reply": "texte à dire au client (français, professionnel, court)",
  "intent": "depannage|entretien|rdv|info|autre",
  "urgent": boolean,
  "technicalSummary": "synthèse technique pour le technicien",
  "suggestedOt": {
    "action": "description OT",
    "localisation": "pièce / étage si mentionné",
    "clientHint": "nom client si entendu",
    "siteHint": "nom site si entendu",
    "equipements": ["liste équipements / fluides mentionnés"]
  },
  "termsDetected": ["termes techniques repérés"]
}`

export default async function handler(req, res) {
  try {
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, POST, OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')

    if (req.method === 'OPTIONS') return res.status(204).end()

    if (req.method === 'GET' || req.method === 'HEAD') {
      const user = await verifySupabaseUser(req)
      if (!user?.id) {
        return res.status(200).json({ ok: true, configured: false, provider: 'openai' })
      }
      const profile = await userOrgProfile(user.id)
      let configured = false
      if (profile?.organization_id) {
        try {
          const { fetchOrgOpenaiHint } = await import('../server/lib/orgOpenaiKey.js')
          configured = (await fetchOrgOpenaiHint(profile.organization_id)).hasKey
        } catch {
          configured = false
        }
      }
      return res.status(200).json({
        ok: true,
        configured,
        provider: 'openai',
      })
    }

    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

    const user = await verifySupabaseUser(req)
    if (!user?.id) return res.status(401).json({ error: 'Session requise.' })
    const profile = await userOrgProfile(user.id)
    if (!profile?.organization_id) {
      return res.status(403).json({ error: 'Profil société introuvable.' })
    }

    const { fetchOrgOpenaiKey } = await import('../server/lib/orgOpenaiKey.js')
    const openaiKey = await fetchOrgOpenaiKey(profile.organization_id)
    if (!openaiKey) {
      return res.status(503).json({
        error: 'openai_not_configured',
        hint: 'Collez la clé OpenAI de votre société dans Mon entreprise (même clé pour Lola et l’assistant site).',
      })
    }

    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {}
    const transcript = String(body.transcript || body.text || '').trim()
    if (!transcript) return res.status(400).json({ error: 'transcript requis' })

    const normalized = normalizeTechnicalText(transcript)
    const localTerms = extractTechnicalMentions(normalized)
    const vocabContext = await fetchVocabularyContext(profile.organization_id, 60)

    const callerContext = String(body.callerContext || '').trim()
    const model = process.env.OPENAI_MODEL || 'gpt-4o-mini'

    const system = [
      SYSTEM_BASE,
      '',
      vocabContext || 'Vocabulaire : PAC, CERFA 15497, fluides R-32/R-410A, OT dépannage.',
      callerContext ? `\nContexte appelant :\n${callerContext}` : '',
      localTerms.length
        ? `\nTermes déjà détectés localement : ${localTerms.map((t) => t.canonical).join(', ')}`
        : '',
    ]
      .filter(Boolean)
      .join('\n')

    const { openaiChatCompletions } = await import('../server/lib/openaiChat.js')
    const ai = await openaiChatCompletions({
      apiKey: openaiKey,
      model,
      temperature: 0.3,
      maxTokens: 900,
      json: true,
      messages: [
        { role: 'system', content: system },
        {
          role: 'user',
          content: `Transcription appel téléphonique :\n${normalized}`,
        },
      ],
    })

    if (!ai.ok) {
      console.error('OpenAI phone-reception', ai.status, ai.error)
      const hint =
        ai.status === 429
          ? 'Quota OpenAI de votre société atteint.'
          : ai.status === 401 || ai.status === 403
            ? 'Clé OpenAI invalide (Mon entreprise).'
            : `Erreur OpenAI (${ai.status}).`
      return res.status(200).json({
        ok: false,
        error: `openai_${ai.status}`,
        hint,
        normalized,
        termsDetected: localTerms.map((t) => t.canonical),
      })
    }

    const raw = ai.content || '{}'
    let parsed
    try {
      parsed = JSON.parse(raw)
    } catch {
      parsed = { reply: raw, intent: 'autre', technicalSummary: normalized, suggestedOt: null }
    }

    if (body.learn !== false) {
      void learnFromText({
        orgId: profile.organization_id,
        text: transcript,
        agent: 'phone',
        normalizedText: normalized,
        metadata: {
          intent: parsed.intent,
          userId: user.id,
          termsFromModel: parsed.termsDetected,
        },
      }).catch(() => undefined)
    }

    return res.status(200).json({
      ok: true,
      provider: 'openai',
      model,
      normalized,
      ...parsed,
    })
  } catch (err) {
    console.error('phone-reception', err)
    return res.status(500).json({
      error: err instanceof Error ? err.message : 'unknown',
    })
  }
}
