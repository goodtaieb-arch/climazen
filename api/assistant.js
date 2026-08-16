/**
 * Vercel Serverless — /api/assistant
 * OPENAI_API_KEY (optionnel). Sans clé → source local côté client.
 */

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') {
    return res.status(204).end()
  }

  const key = process.env.OPENAI_API_KEY || process.env.CLIMAZEN_OPENAI_KEY

  // Health : IA cloud configurée ? (sans appeler OpenAI)
  if (req.method === 'GET' || req.method === 'HEAD') {
    return res.status(200).json({ cloud: Boolean(key) })
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  if (!key) {
    return res.status(200).json({
      reply: '',
      source: 'local',
      hint: 'Ajoutez OPENAI_API_KEY dans Vercel pour activer l’IA cloud.',
    })
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {}
    const messages = Array.isArray(body.messages) ? body.messages : []
    const system = String(body.system || '')
    const context = String(body.context || '')
    const pathname = String(body.pathname || '')

    const openaiMessages = [
      {
        role: 'system',
        content: `${system}\n\nContexte page :\n${context}\n\nURL : ${pathname}`,
      },
      ...messages
        .filter((m) => m && (m.role === 'user' || m.role === 'assistant') && m.content)
        .slice(-12)
        .map((m) => ({
          role: m.role,
          content: String(m.content).slice(0, 4000),
        })),
    ]

    const aiRes = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
        temperature: 0.3,
        max_tokens: 700,
        messages: openaiMessages,
      }),
    })

    if (!aiRes.ok) {
      const errText = await aiRes.text()
      console.error('OpenAI error', aiRes.status, errText.slice(0, 500))
      return res.status(200).json({ reply: '', source: 'local' })
    }

    const data = await aiRes.json()
    const reply = (data?.choices?.[0]?.message?.content || '').trim()
    return res.status(200).json({ reply, source: 'api' })
  } catch (err) {
    console.error('assistant api', err)
    return res.status(200).json({ reply: '', source: 'local' })
  }
}
