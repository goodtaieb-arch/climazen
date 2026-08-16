/**
 * Vercel Serverless — /api/assistant
 * GEMINI_API_KEY (optionnel, Google AI Studio). Sans clé → guide local côté client.
 *
 * Important : le projet est "type": "module" → export ESM (pas module.exports).
 */

export default async function handler(req, res) {
  try {
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, POST, OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

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

    const contents = messages
      .filter((m) => m && (m.role === 'user' || m.role === 'assistant') && m.content)
      .slice(-12)
      .map((m) => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: String(m.content).slice(0, 4000) }],
      }))

    // Gemini exige souvent un dernier message "user"
    if (contents.length === 0 || contents[contents.length - 1].role !== 'user') {
      contents.push({
        role: 'user',
        parts: [{ text: 'Peux-tu m’aider sur ClimaZEN ?' }],
      })
    }

    const model = process.env.GEMINI_MODEL || 'gemini-2.0-flash'
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(key)}`

    const aiRes = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: {
          parts: [
            {
              text: `${system}\n\nContexte page :\n${context}\n\nURL : ${pathname}`,
            },
          ],
        },
        contents,
        generationConfig: {
          temperature: 0.4,
          maxOutputTokens: 700,
        },
      }),
    })

    if (!aiRes.ok) {
      const errText = await aiRes.text()
      console.error('Gemini error', aiRes.status, errText.slice(0, 800))
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
      return res.status(200).json({
        reply: '',
        source: 'local',
        error: 'gemini_empty',
        hint: 'Réponse Gemini vide. Guide local utilisé.',
      })
    }

    return res.status(200).json({ reply, source: 'api', provider: 'gemini' })
  } catch (err) {
    console.error('assistant api', err)
    return res.status(200).json({
      reply: '',
      source: 'local',
      error: err instanceof Error ? err.message : 'unknown',
    })
  }
}
