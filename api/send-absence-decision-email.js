/**
 * Vercel Serverless — /api/send-absence-decision-email
 * Envoi automatique du PDF (validé ou refusé) au salarié après décision direction (Resend).
 *
 * Variables Vercel (Production) :
 *   RESEND_API_KEY=re_...
 *   MAIL_FROM=ClimaZEN <contact@climazen.fr>   (domaine vérifié sur Resend)
 *   VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY (déjà présentes)
 */

const DEFAULT_FROM = 'ClimaZEN <contact@climazen.fr>'
const MAX_PDF_BYTES = 5 * 1024 * 1024 // 5 Mo — largement suffisant pour cette feuille PDF

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

function fmtDate(iso) {
  const d = String(iso || '').slice(0, 10)
  const [y, m, day] = d.split('-')
  if (!y || !m || !day) return iso || '—'
  return `${day}/${m}/${y}`
}

function buildBodies({ technicienName, statut, dateDebut, dateFin, typeLabel, motifRefus, decidedByName }) {
  const tech = technicienName || 'Bonjour'
  const validee = statut === 'validee'
  const periode = dateFin && dateFin !== dateDebut ? `du ${fmtDate(dateDebut)} au ${fmtDate(dateFin)}` : `le ${fmtDate(dateDebut)}`
  const subject = validee
    ? `Absence validée — ${periode}`
    : `Absence refusée — ${periode}`

  const textLines = [
    `Bonjour ${tech},`,
    '',
    validee
      ? `Votre demande d'absence (${typeLabel}) ${periode} a été validée par ${decidedByName || 'la direction'}.`
      : `Votre demande d'absence (${typeLabel}) ${periode} a été refusée par ${decidedByName || 'la direction'}.`,
  ]
  if (!validee && motifRefus) textLines.push('', `Motif : ${motifRefus}`)
  textLines.push('', 'Le certificat PDF est joint à cet e-mail.', '', 'Cordialement,', 'ClimaZEN', 'https://climazen.fr')
  const text = textLines.join('\n')

  const color = validee ? '#0f766e' : '#b91c1c'
  const html = `<!DOCTYPE html>
<html lang="fr">
<head><meta charset="utf-8" /><meta name="viewport" content="width=device-width" /></head>
<body style="margin:0;padding:0;background:#f0fdfa;font-family:Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#0f172a;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f0fdfa;padding:24px 12px;">
    <tr><td align="center">
      <table role="presentation" width="100%" style="max-width:520px;background:#ffffff;border-radius:16px;border:1px solid #99f6e4;overflow:hidden;">
        <tr>
          <td style="background:${color};padding:20px 24px;">
            <div style="font-size:20px;font-weight:800;letter-spacing:0.02em;color:#ffffff;">ClimaZEN</div>
            <div style="font-size:12px;color:#ffffffcc;margin-top:4px;">${validee ? 'Absence validée' : 'Absence refusée'}</div>
          </td>
        </tr>
        <tr>
          <td style="padding:24px;">
            <p style="margin:0 0 12px;font-size:15px;line-height:1.5;">Bonjour ${escapeHtml(tech)},</p>
            <p style="margin:0 0 12px;font-size:15px;line-height:1.5;">
              Votre demande d'absence (<strong>${escapeHtml(typeLabel)}</strong>) ${escapeHtml(periode)}
              a été <strong>${validee ? 'validée' : 'refusée'}</strong> par ${escapeHtml(decidedByName || 'la direction')}.
            </p>
            ${!validee && motifRefus ? `<p style="margin:0 0 12px;font-size:14px;color:#334155;">Motif : ${escapeHtml(motifRefus)}</p>` : ''}
            <p style="margin:16px 0 0;font-size:13px;color:#64748b;">Le certificat PDF est joint à cet e-mail.</p>
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

  return { text, html, subject }
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
      return res.status(200).json({ ok: true, configured: Boolean(key), from: key ? from : null, provider: 'resend' })
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
    const statut = body.statut === 'validee' || body.statut === 'refusee' ? body.statut : null
    const technicienName = String(body.technicienName || '').trim()
    const dateDebut = String(body.dateDebut || '').trim()
    const dateFin = String(body.dateFin || '').trim()
    const typeLabel = String(body.typeLabel || 'Absence').trim()
    const motifRefus = String(body.motifRefus || '').trim()
    const decidedByName = String(body.decidedByName || user.email || '').trim()
    const pdfBase64 = String(body.pdfBase64 || '')
    const fileName = String(body.fileName || 'absence.pdf').replace(/[^a-zA-Z0-9_.-]/g, '_')

    if (!isValidEmail(to)) {
      return res.status(400).json({ error: 'invalid_email', hint: 'Adresse e-mail du salarié invalide.' })
    }
    if (!statut) {
      return res.status(400).json({ error: 'invalid_statut', hint: 'Statut de décision invalide.' })
    }
    if (!dateDebut) {
      return res.status(400).json({ error: 'missing_dates', hint: 'Dates de la demande manquantes.' })
    }
    if (!pdfBase64) {
      return res.status(400).json({ error: 'missing_pdf', hint: 'PDF manquant.' })
    }
    // Estimation taille réelle depuis le base64 (~4/3 du binaire) pour éviter un payload abusif.
    if (pdfBase64.length * 0.75 > MAX_PDF_BYTES) {
      return res.status(400).json({ error: 'pdf_too_large', hint: 'PDF trop volumineux.' })
    }

    const { text, html, subject } = buildBodies({
      technicienName,
      statut,
      dateDebut,
      dateFin,
      typeLabel,
      motifRefus,
      decidedByName,
    })

    const payload = {
      from,
      to: [to],
      subject,
      text,
      html,
      attachments: [{ filename: fileName, content: pdfBase64 }],
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

    return res.status(200).json({ ok: true, id: sendData.id || null, from, to })
  } catch (err) {
    console.error('send-absence-decision-email', err)
    return res.status(500).json({
      error: err instanceof Error ? err.message : 'unknown',
      hint: 'Erreur serveur lors de l’envoi.',
    })
  }
}
