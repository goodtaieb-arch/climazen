/**
 * Vercel Serverless — /api/send-signature-email
 * Envoi du lien de signature depuis ClimaZEN (Resend).
 *
 * Variables Vercel (Production) :
 *   RESEND_API_KEY=re_...
 *   MAIL_FROM=ClimaZEN <contact@climazen.fr>   (domaine vérifié sur Resend)
 *   VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY (déjà présentes)
 */

const DEFAULT_FROM = 'ClimaZEN <contact@climazen.fr>'

function escapeHtml(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || '').trim())
}

function isClimazenSignUrl(url) {
  try {
    const u = new URL(String(url || ''))
    if (u.protocol !== 'https:' && u.protocol !== 'http:') return false
    const host = u.hostname.toLowerCase()
    const okHost =
      host === 'climazen.fr' ||
      host === 'www.climazen.fr' ||
      host.endsWith('.vercel.app') ||
      host === 'localhost'
    return okHost && u.pathname.startsWith('/signer/')
  } catch {
    return false
  }
}

async function verifySupabaseUser(req) {
  const auth = String(req.headers.authorization || '')
  const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : ''
  if (!token) return null

  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY
  if (!supabaseUrl || !anonKey) return null

  const r = await fetch(`${supabaseUrl.replace(/\/$/, '')}/auth/v1/user`, {
    headers: {
      Authorization: `Bearer ${token}`,
      apikey: anonKey,
    },
  })
  if (!r.ok) return null
  return r.json()
}

function buildBodies({ techName, siteNom, url }) {
  const tech = techName || 'Votre technicien'
  const site = siteNom || 'intervention'
  const text = [
    'Bonjour,',
    '',
    `${tech} vous demande de signer à distance via ClimaZEN (client absent sur site).`,
    '',
    `Site / intervention : ${site}`,
    '',
    'Ouvrez ce lien sur votre téléphone :',
    url,
    '',
    'Le lien est valable 72 heures.',
    '',
    'Cordialement,',
    'ClimaZEN',
    'https://climazen.fr',
  ].join('\n')

  const html = `<!DOCTYPE html>
<html lang="fr">
<head><meta charset="utf-8" /><meta name="viewport" content="width=device-width" /></head>
<body style="margin:0;padding:0;background:#f0fdfa;font-family:Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#0f172a;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f0fdfa;padding:24px 12px;">
    <tr><td align="center">
      <table role="presentation" width="100%" style="max-width:520px;background:#ffffff;border-radius:16px;border:1px solid #99f6e4;overflow:hidden;">
        <tr>
          <td style="background:#0f766e;padding:20px 24px;">
            <div style="font-size:20px;font-weight:800;letter-spacing:0.02em;color:#ffffff;">ClimaZEN</div>
            <div style="font-size:12px;color:#ccfbf1;margin-top:4px;">Signature à distance</div>
          </td>
        </tr>
        <tr>
          <td style="padding:24px;">
            <p style="margin:0 0 12px;font-size:15px;line-height:1.5;">Bonjour,</p>
            <p style="margin:0 0 12px;font-size:15px;line-height:1.5;">
              <strong>${escapeHtml(tech)}</strong> vous demande de signer à distance
              (client absent sur site).
            </p>
            <p style="margin:0 0 20px;font-size:14px;color:#334155;line-height:1.5;">
              Site / intervention : <strong>${escapeHtml(site)}</strong>
            </p>
            <p style="margin:0 0 24px;text-align:center;">
              <a href="${escapeHtml(url)}"
                 style="display:inline-block;background:#0f766e;color:#ffffff;text-decoration:none;font-weight:700;font-size:15px;padding:14px 22px;border-radius:12px;">
                Signer maintenant
              </a>
            </p>
            <p style="margin:0 0 8px;font-size:12px;color:#64748b;line-height:1.5;word-break:break-all;">
              Ou copiez ce lien :<br />${escapeHtml(url)}
            </p>
            <p style="margin:16px 0 0;font-size:12px;color:#64748b;">Le lien est valable 72 heures.</p>
          </td>
        </tr>
        <tr>
          <td style="padding:14px 24px;background:#f8fafc;border-top:1px solid #e2e8f0;font-size:11px;color:#94a3b8;">
            Envoyé par ClimaZEN · <a href="https://climazen.fr" style="color:#0f766e;">climazen.fr</a>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`

  return { text, html, subject: `Signature ClimaZEN — ${site}` }
}

export default async function handler(req, res) {
  try {
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, POST, OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')

    if (req.method === 'OPTIONS') {
      return res.status(204).end()
    }

    const key = process.env.RESEND_API_KEY
    const from = (process.env.MAIL_FROM || DEFAULT_FROM).trim() || DEFAULT_FROM

    if (req.method === 'GET' || req.method === 'HEAD') {
      return res.status(200).json({
        ok: true,
        configured: Boolean(key),
        from: key ? from : null,
        provider: 'resend',
      })
    }

    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method not allowed' })
    }

    if (!key) {
      return res.status(503).json({
        error: 'email_not_configured',
        hint: 'Ajoutez RESEND_API_KEY (et MAIL_FROM) dans Vercel → Environment Variables.',
      })
    }

    const user = await verifySupabaseUser(req)
    if (!user?.id) {
      return res.status(401).json({
        error: 'unauthorized',
        hint: 'Connectez-vous pour envoyer un e-mail depuis ClimaZEN.',
      })
    }

    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {}
    const to = String(body.to || '').trim()
    const url = String(body.url || '').trim()
    const siteNom = String(body.siteNom || '').trim()
    const techName = String(body.techName || user.email || 'Votre technicien').trim()

    if (!isValidEmail(to)) {
      return res.status(400).json({ error: 'invalid_email', hint: 'Adresse e-mail client invalide.' })
    }
    if (!isClimazenSignUrl(url)) {
      return res.status(400).json({ error: 'invalid_url', hint: 'Lien de signature invalide.' })
    }

    const { text, html, subject } = buildBodies({ techName, siteNom, url })

    const payload = {
      from,
      to: [to],
      subject,
      text,
      html,
    }
    if (isValidEmail(user.email)) {
      payload.reply_to = user.email
    }

    const sendRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    })

    const sendData = await sendRes.json().catch(() => ({}))
    if (!sendRes.ok) {
      console.error('Resend error', sendRes.status, sendData)
      const msg =
        sendData?.message ||
        (sendRes.status === 403
          ? 'Domaine d’envoi non vérifié sur Resend (climazen.fr).'
          : `Erreur Resend (${sendRes.status}).`)
      return res.status(502).json({ error: 'send_failed', hint: msg })
    }

    return res.status(200).json({
      ok: true,
      id: sendData.id || null,
      from,
      to,
    })
  } catch (err) {
    console.error('send-signature-email', err)
    return res.status(500).json({
      error: err instanceof Error ? err.message : 'unknown',
      hint: 'Erreur serveur lors de l’envoi.',
    })
  }
}
