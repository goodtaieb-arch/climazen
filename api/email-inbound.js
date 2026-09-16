/**
 * Vercel Serverless — /api/email-inbound
 * Webhook réception e-mail pour Lola : un e-mail arrive sur l'adresse dédiée
 * (Mon entreprise → « E-mail dédié à Lola »), Lola l'analyse et crée une
 * proposition dans la file de validation humaine (jamais d'action directe).
 *
 * Appelé par le fournisseur d'e-mail entrant configuré côté hébergeur
 * (Resend Inbound, ou tout webhook capable de POSTer from/to/subject/text).
 *
 * Variables Vercel :
 *   SUPABASE_SERVICE_ROLE_KEY, VITE_SUPABASE_URL (ou SUPABASE_URL)
 *   RESEND_API_KEY, MAIL_FROM
 *   EMAIL_WEBHOOK_SECRET (header X-Email-Webhook-Secret attendu du fournisseur)
 *
 * NOTE : le format exact du payload dépend du fournisseur retenu pour la
 * réception (non configuré à ce jour) — normalizeInboundPayload() couvre les
 * noms de champs les plus courants (Resend/Postmark/SendGrid/Mailgun) ; à
 * ajuster une fois le fournisseur choisi et le webhook réellement branché.
 */

import { supabaseRest } from '../server/lib/supabaseServer.js'

const DEFAULT_FROM = 'ClimaZEN <contact@climazen.fr>'

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || '').trim())
}

function uuid() {
  return crypto.randomUUID()
}

/** Normalise les champs selon le fournisseur (Resend/Postmark/SendGrid/Mailgun…). */
function normalizeInboundPayload(body) {
  const pickEmail = (v) => {
    const raw = String(v || '').trim()
    const m = raw.match(/<([^>]+)>/)
    return (m ? m[1] : raw).trim().toLowerCase()
  }
  const from = pickEmail(body.from || body.From || body.sender || body.envelope?.from)
  const to = pickEmail(
    body.to || body.To || body.recipient || body.envelope?.to || body.original_recipient,
  )
  const subject = String(body.subject || body.Subject || '').trim()
  const text = String(
    body.text || body.Text || body['stripped-text'] || body.plain || body.TextBody || '',
  ).trim()
  const html = String(body.html || body.Html || body.HtmlBody || '').trim()
  return { from, to, subject, text: text || html.replace(/<[^>]+>/g, ' ').trim() }
}

/** Repli JS minimal (miroir de src/lib/aiPendingValidation.ts) — évite d'importer du TS ici. */
const SECTEUR_KEYWORDS = [
  { re: /\b(clim|cvc|pac|chauffage|vmc|cta|climatis)/i, id: 'tech_cvc' },
  { re: /\b(frigo|froid|chambre\s*froide|groupe\s*froid|r-?\d{2,4}|fluide)/i, id: 'tech_frigoriste' },
  { re: /\b(multi[\s-]?tech|multitechnique)/i, id: 'tech_multitechnique' },
  { re: /\bplomb/i, id: 'plombier' },
  { re: /\b[eé]lectri/i, id: 'electricien' },
]

function inferSecteur(text) {
  for (const { re, id } of SECTEUR_KEYWORDS) {
    if (re.test(text)) return id
  }
  return undefined
}

async function findOrgByLolaEmail(to) {
  const rows = await supabaseRest(
    `org_data?select=organization_id,payload&payload->operateur->>lolaEmail=eq.${encodeURIComponent(to)}`,
  )
  return rows?.[0] || null
}

async function sendAcknowledgement({ to, subject, technicienName }) {
  const key = process.env.RESEND_API_KEY
  const from = (process.env.MAIL_FROM || DEFAULT_FROM).trim() || DEFAULT_FROM
  if (!key || !isValidEmail(to)) return { ok: false, skipped: true }
  const replySubject = subject ? `Re: ${subject}` : 'Bien reçu — ClimaZEN'
  const text = [
    'Bonjour,',
    '',
    'Votre message a bien été reçu et transmis à notre équipe, qui revient vers vous rapidement.',
    '',
    'Cordialement,',
    'ClimaZEN',
  ].join('\n')
  const html = `<!DOCTYPE html><html lang="fr"><body style="margin:0;padding:24px;background:#f0fdfa;font-family:Segoe UI,Roboto,sans-serif;color:#0f172a;">
  <div style="max-width:480px;margin:0 auto;background:#fff;border-radius:16px;border:1px solid #99f6e4;overflow:hidden;">
    <div style="background:#0f766e;padding:18px 22px;color:#fff;font-weight:800;font-size:18px;">ClimaZEN</div>
    <div style="padding:22px;font-size:15px;line-height:1.5;">
      <p>Bonjour,</p>
      <p>Votre message a bien été reçu et transmis à notre équipe, qui revient vers vous rapidement.</p>
      <p>Cordialement,<br/>ClimaZEN</p>
    </div>
  </div>
  </body></html>`
  const sendRes = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from, to: [to], subject: replySubject, text, html }),
  })
  const sendData = await sendRes.json().catch(() => ({}))
  if (!sendRes.ok) return { ok: false, error: sendData?.message || `Resend ${sendRes.status}` }
  void technicienName // réservé — personnalisation future
  return { ok: true, id: sendData.id }
}

export default async function handler(req, res) {
  try {
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Email-Webhook-Secret')

    if (req.method === 'OPTIONS') return res.status(204).end()

    if (req.method === 'GET' || req.method === 'HEAD') {
      return res.status(200).json({
        ok: true,
        configured: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY && process.env.EMAIL_WEBHOOK_SECRET),
      })
    }

    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

    const webhookSecret = String(process.env.EMAIL_WEBHOOK_SECRET || '').trim()
    const headerSecret = String(req.headers['x-email-webhook-secret'] || '').trim()
    if (!webhookSecret || headerSecret !== webhookSecret) {
      return res.status(401).json({ error: 'unauthorized', hint: 'X-Email-Webhook-Secret invalide ou absent.' })
    }

    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {}
    const { from, to, subject, text } = normalizeInboundPayload(body)

    if (!isValidEmail(from) || !isValidEmail(to)) {
      return res.status(400).json({ error: 'invalid_addresses', hint: 'from/to invalides dans le payload.' })
    }
    if (!text) {
      return res.status(400).json({ error: 'empty_body', hint: 'Corps du message vide.' })
    }

    const org = await findOrgByLolaEmail(to)
    if (!org) {
      // Pas d'org configurée avec cette adresse — on accuse quand même réception (best-effort), sans créer de tâche.
      await sendAcknowledgement({ to: from, subject }).catch(() => undefined)
      return res.status(200).json({ ok: true, orgFound: false })
    }

    const payload = org.payload || {}
    const orgId = org.organization_id

    let aiResult = null
    try {
      const { fetchOrgAiCredentials } = await import('../server/lib/orgOpenaiKey.js')
      const creds = await fetchOrgAiCredentials(orgId)
      if (creds.apiKey) {
        const { orgChatCompletions } = await import('../server/lib/aiProviders.js')
        const system = `Tu es Lola / l'intelligence ClimaZEN (e-mail). Société de froid / climatisation.
VALIDATION HUMAINE OBLIGATOIRE : tu proposes uniquement, tu ne crées jamais rien directement.
Analyse cet e-mail client et réponds en JSON strict :
{
  "intent": "depannage|entretien|rdv|devis|commande|info|autre",
  "urgent": boolean,
  "clientHint": "nom client si mentionné",
  "siteHint": "site/adresse si mentionné",
  "localisation": "pièce/étage si mentionné",
  "technicalSummary": "résumé technique court pour le technicien",
  "secteur": "tech_cvc|tech_frigoriste|tech_multitechnique|plombier|electricien|null"
}`
        const ai = await orgChatCompletions({
          provider: creds.provider,
          apiKey: creds.apiKey,
          model: creds.model,
          temperature: 0.3,
          maxTokens: 500,
          json: true,
          messages: [
            { role: 'system', content: system },
            { role: 'user', content: `Sujet : ${subject}\n\nMessage :\n${text}` },
          ],
        })
        if (ai.ok) {
          try {
            aiResult = JSON.parse(ai.content || '{}')
          } catch {
            aiResult = null
          }
        }
      }
    } catch (err) {
      console.warn('email-inbound: analyse IA indisponible', err instanceof Error ? err.message : err)
    }

    const secteur = aiResult?.secteur && aiResult.secteur !== 'null' ? aiResult.secteur : inferSecteur(text)
    const summary = aiResult?.technicalSummary || text.slice(0, 500)
    const now = new Date().toISOString()

    const pending = {
      id: uuid(),
      createdAt: now,
      updatedAt: now,
      source: 'email',
      kind: 'ot',
      secteur,
      title: `E-mail client — ${subject || 'Sans objet'}`.slice(0, 160),
      summary: summary.slice(0, 2000),
      callerHint: text.slice(0, 2000),
      clientHint: aiResult?.clientHint || '',
      siteHint: aiResult?.siteHint || '',
      notifyEmail: payload.ticketNotificationEmail || payload.operateur?.email || '',
      statut: 'a_valider',
    }

    const list = [...(payload.aiPendingValidations || []), pending]
    const nextPayload = { ...payload, aiPendingValidations: list }

    await supabaseRest(`org_data?organization_id=eq.${encodeURIComponent(orgId)}`, {
      method: 'PATCH',
      body: JSON.stringify({ payload: nextPayload, updated_at: now }),
      prefer: 'return=minimal',
    })

    const ack = await sendAcknowledgement({ to: from, subject }).catch((err) => ({
      ok: false,
      error: err instanceof Error ? err.message : 'unknown',
    }))

    return res.status(200).json({ ok: true, orgFound: true, pendingId: pending.id, ack })
  } catch (err) {
    console.error('email-inbound', err)
    return res.status(500).json({ error: err instanceof Error ? err.message : 'unknown' })
  }
}
