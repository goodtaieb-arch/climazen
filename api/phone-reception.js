/**
 * Vercel — /api/phone-reception
 * Agent d’accueil téléphonique (OpenAI) — partage le vocabulaire Supabase avec Gemini.
 *
 * POST { transcript, callerContext?, learn? }
 * Authorization: Bearer <session Supabase>
 *
 * OPENAI_API_KEY requis. Modèle par défaut : gpt-4o-mini
 */

import { verifySupabaseUser, userOrgProfile } from './lib/supabaseServer.js'
import {
  fetchVocabularyContext,
  learnFromText,
  normalizeTechnicalText,
  extractTechnicalMentions,
} from './lib/aiVocabularyCore.js'

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

    const openaiKey = process.env.OPENAI_API_KEY

    if (req.method === 'GET' || req.method === 'HEAD') {
      return res.status(200).json({
        ok: true,
        configured: Boolean(openaiKey),
        provider: 'openai',
      })
    }

    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

    if (!openaiKey) {
      return res.status(503).json({
        error: 'openai_not_configured',
        hint: 'Ajoutez OPENAI_API_KEY sur Vercel pour l’agent d’accueil téléphonique.',
      })
    }

    const user = await verifySupabaseUser(req)
    if (!user?.id) return res.status(401).json({ error: 'Session requise.' })
    const profile = await userOrgProfile(user.id)
    if (!profile?.organization_id) {
      return res.status(403).json({ error: 'Profil société introuvable.' })
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

    const aiRes = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${openaiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        temperature: 0.3,
        max_tokens: 900,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: system },
          {
            role: 'user',
            content: `Transcription appel téléphonique :\n${normalized}`,
          },
        ],
      }),
    })

    if (!aiRes.ok) {
      const errText = await aiRes.text()
      console.error('OpenAI phone-reception', aiRes.status, errText.slice(0, 400))
      const hint =
        aiRes.status === 429
          ? 'Quota OpenAI atteint.'
          : `Erreur OpenAI (${aiRes.status}).`
      return res.status(200).json({
        ok: false,
        error: `openai_${aiRes.status}`,
        hint,
        normalized,
        termsDetected: localTerms.map((t) => t.canonical),
      })
    }

    const data = await aiRes.json()
    const raw = data?.choices?.[0]?.message?.content || '{}'
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
