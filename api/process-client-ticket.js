/**
 * Vercel Serverless — /api/process-client-ticket
 * Ticket portail client → OT dans org_data + e-mail bureau (Resend).
 *
 * Appelé par :
 * - Webhook Supabase (pg_net) à la soumission ticket (secret)
 * - App bureau authentifiée (Bearer) via syncClientPortalTickets
 *
 * Variables Vercel :
 *   SUPABASE_SERVICE_ROLE_KEY
 *   VITE_SUPABASE_URL (ou SUPABASE_URL)
 *   RESEND_API_KEY, MAIL_FROM
 *   TICKET_WEBHOOK_SECRET (pour pg_net / webhook DB)
 */

const DEFAULT_FROM = 'ClimaZEN <contact@climazen.fr>'
const APP_ORIGIN = (process.env.APP_ORIGIN || 'https://climazen.fr').replace(/\/$/, '')

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

function otBaseNumero(raw) {
  const v = String(raw || '').trim()
  if (!v) return ''
  const m = /^OT(\d{6,}(?:-\d+)?)$/i.exec(v)
  if (m) return m[1]
  return v.replace(/^OT/i, '')
}

function otDayKey(d = new Date()) {
  const parts = new Intl.DateTimeFormat('fr-FR', {
    timeZone: 'Europe/Paris',
    year: '2-digit',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(d)
  const yy = parts.find((p) => p.type === 'year')?.value ?? '00'
  const mm = parts.find((p) => p.type === 'month')?.value ?? '01'
  const jj = parts.find((p) => p.type === 'day')?.value ?? '01'
  return `${yy}${mm}${jj}`
}

function maxSeqDay(dayKey, values) {
  const re = new RegExp(`^${dayKey}(\\d{2,})(?:-\\d+)?$`)
  let max = 0
  for (const raw of values) {
    const v = otBaseNumero(raw)
    const m = re.exec(v)
    if (m) max = Math.max(max, Number(m[1]) || 0)
  }
  return max
}

function nextNumeroOt(payload) {
  const dayKey = otDayKey()
  const values = [
    ...(payload.ordresTravail || []).map((o) => o.numero),
    ...(payload.interventions || []).map((i) => i.numeroIntervention),
    ...(payload.fichesMaintenanceClim || []).map((f) => f.numero),
    ...(payload.fichesMaintenanceChaufferie || []).map((f) => f.numero),
    ...(payload.fichesMaintenanceCtaVmc || []).map((f) => f.numero),
  ]
  const unique = [...new Set(values.map((v) => otBaseNumero(v)).filter(Boolean))]
  const next = maxSeqDay(dayKey, unique) + 1
  return `${dayKey}${String(next).padStart(2, '0')}`
}

function formatOtNumero(raw) {
  const base = otBaseNumero(raw)
  return base ? `OT${base}` : ''
}

function uuid() {
  return crypto.randomUUID()
}

async function supabaseRest(path, opts = {}) {
  const supabaseUrl = (process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '').replace(/\/$/, '')
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceKey) {
    throw new Error('Supabase service role non configuré sur le serveur.')
  }
  const url = `${supabaseUrl}/rest/v1/${path}`
  const res = await fetch(url, {
    ...opts,
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      'Content-Type': 'application/json',
      Prefer: opts.prefer || 'return=representation',
      ...(opts.headers || {}),
    },
  })
  const text = await res.text()
  let data = null
  try {
    data = text ? JSON.parse(text) : null
  } catch {
    data = text
  }
  if (!res.ok) {
    const msg = data?.message || data?.error || text || res.statusText
    throw new Error(msg)
  }
  return data
}

async function verifySupabaseUser(req) {
  const auth = String(req.headers.authorization || '')
  const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : ''
  if (!token) return null
  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY
  if (!supabaseUrl || !anonKey) return null
  const r = await fetch(`${supabaseUrl.replace(/\/$/, '')}/auth/v1/user`, {
    headers: { Authorization: `Bearer ${token}`, apikey: anonKey },
  })
  if (!r.ok) return null
  return r.json()
}

async function userOrgId(userId) {
  const rows = await supabaseRest(
    `profiles?id=eq.${encodeURIComponent(userId)}&select=organization_id,email,role&limit=1`,
  )
  return rows?.[0] || null
}

function buildTicketEmail({ siteNom, clientNom, localisation, description, otNumero, otUrl, contact }) {
  const subject = `[ClimaZEN] Ticket client — ${localisation} — ${siteNom || 'Site'}`
  const lines = [
    'Bonjour,',
    '',
    'Un client a ouvert un ticket via le portail maintenance ClimaZEN.',
    '',
    `Site : ${siteNom || '—'}${clientNom ? ` (${clientNom})` : ''}`,
    `Lieu : ${localisation}`,
    `Description : ${description}`,
    '',
    `Ordre de travail créé : ${formatOtNumero(otNumero)}`,
    `Ouvrir dans ClimaZEN : ${otUrl}`,
  ]
  if (contact?.nom || contact?.email || contact?.tel) {
    lines.push('', 'Contact client :')
    if (contact.nom) lines.push(`  Nom : ${contact.nom}`)
    if (contact.email) lines.push(`  E-mail : ${contact.email}`)
    if (contact.tel) lines.push(`  Tél : ${contact.tel}`)
  }
  lines.push('', 'Cordialement,', 'ClimaZEN', APP_ORIGIN)
  const text = lines.join('\n')

  const html = `<!DOCTYPE html>
<html lang="fr">
<head><meta charset="utf-8" /></head>
<body style="margin:0;padding:24px;background:#f0fdfa;font-family:Segoe UI,Roboto,sans-serif;color:#0f172a;">
  <div style="max-width:520px;margin:0 auto;background:#fff;border-radius:16px;border:1px solid #99f6e4;overflow:hidden;">
    <div style="background:#0f766e;padding:20px 24px;color:#fff;">
      <div style="font-size:20px;font-weight:800;">ClimaZEN</div>
      <div style="font-size:12px;margin-top:4px;opacity:0.9;">Nouveau ticket client</div>
    </div>
    <div style="padding:24px;font-size:15px;line-height:1.5;">
      <p>Un client a signalé un problème via le portail maintenance.</p>
      <p><strong>Site :</strong> ${escapeHtml(siteNom)}${clientNom ? ` · ${escapeHtml(clientNom)}` : ''}</p>
      <p><strong>Lieu :</strong> ${escapeHtml(localisation)}</p>
      <p><strong>Description :</strong><br/>${escapeHtml(description)}</p>
      <p style="margin:24px 0;text-align:center;">
        <a href="${escapeHtml(otUrl)}" style="display:inline-block;background:#0f766e;color:#fff;text-decoration:none;font-weight:700;padding:14px 22px;border-radius:12px;">
          Ouvrir l’OT ${escapeHtml(formatOtNumero(otNumero))}
        </a>
      </p>
      ${
        contact?.nom || contact?.email || contact?.tel
          ? `<p style="font-size:13px;color:#64748b;"><strong>Contact :</strong> ${escapeHtml(
              [contact.nom, contact.email, contact.tel].filter(Boolean).join(' · '),
            )}</p>`
          : ''
      }
    </div>
  </div>
</body>
</html>`

  return { subject, text, html }
}

async function sendTicketEmail({ toList, ...body }) {
  const key = process.env.RESEND_API_KEY
  const from = (process.env.MAIL_FROM || DEFAULT_FROM).trim() || DEFAULT_FROM
  if (!key) {
    return { ok: false, skipped: true, reason: 'RESEND_API_KEY absent' }
  }
  const recipients = [...new Set(toList.filter(isValidEmail))]
  if (!recipients.length) {
    return { ok: false, skipped: true, reason: 'Aucun e-mail bureau valide' }
  }
  const { subject, text, html } = buildTicketEmail(body)
  const sendRes = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from, to: recipients, subject, text, html }),
  })
  const sendData = await sendRes.json().catch(() => ({}))
  if (!sendRes.ok) {
    return { ok: false, error: sendData?.message || `Resend ${sendRes.status}` }
  }
  return { ok: true, id: sendData.id, to: recipients }
}

async function processTicket(ticketId) {
  const tickets = await supabaseRest(
    `client_tickets?id=eq.${encodeURIComponent(ticketId)}&select=*&limit=1`,
  )
  const ticket = tickets?.[0]
  if (!ticket) throw new Error('Ticket introuvable.')

  if (ticket.statut === 'ot_cree' && ticket.ot_id) {
    return {
      ok: true,
      alreadyExists: true,
      otId: ticket.ot_id,
      otNumero: ticket.ot_numero,
      ticketId: ticket.id,
    }
  }

  const orgRows = await supabaseRest(
    `org_data?organization_id=eq.${encodeURIComponent(ticket.organization_id)}&select=payload&limit=1`,
  )
  const payload = orgRows?.[0]?.payload || {}
  const ordres = [...(payload.ordresTravail || [])]

  const existingOt = ordres.find((o) => o.ticketClientId === ticket.id)
  if (existingOt) {
    await supabaseRest(`client_tickets?id=eq.${encodeURIComponent(ticket.id)}`, {
      method: 'PATCH',
      body: JSON.stringify({
        statut: 'ot_cree',
        ot_id: existingOt.id,
        ot_numero: existingOt.numero,
        traite_at: new Date().toISOString(),
      }),
      prefer: 'return=minimal',
    })
    return {
      ok: true,
      alreadyExists: true,
      otId: existingOt.id,
      otNumero: existingOt.numero,
      ot: existingOt,
      ticketId: ticket.id,
    }
  }

  const site = (payload.chantiers || []).find((s) => s.id === ticket.site_id)
  if (!site) throw new Error('Site du ticket introuvable dans org_data.')

  const portalRows = await supabaseRest(
    `site_portals?organization_id=eq.${encodeURIComponent(ticket.organization_id)}&site_id=eq.${encodeURIComponent(ticket.site_id)}&select=site_nom,client_nom&limit=1`,
  )
  const portal = portalRows?.[0] || {}

  const now = new Date().toISOString()
  const otId = uuid()
  const otNumero = nextNumeroOt(payload)
  const ot = {
    id: otId,
    numero: otNumero,
    date: now.slice(0, 10),
    typeOt: 'depanage',
    action: `[Ticket client] ${ticket.localisation} — ${ticket.description}`,
    rapportAction: '',
    observations: '',
    localisationClient: ticket.localisation,
    ticketClient: true,
    ticketClientId: ticket.id,
    clientId: site.clientId,
    chantierId: site.id,
    technicien: '',
    technicienUserIds: [],
    lienCommandeType: 'aucun',
    lienCommandeRef: '',
    origineOt: 'depannage_urgence',
    statutFacturation: 'non_facture',
    sousGarantie: false,
    mainOeuvreIncluseContrat: false,
    statut: 'pret_a_planifier',
    interventionPartielle: false,
    avancementPct: 0,
    visitesPresence: [],
    docsRequis: [],
    maintenanceParSousTraitant: false,
    techAccompagneSousTraitant: false,
    registreSecuriteConfirme: false,
    parcoursStep: 'ot',
    createdAt: now,
    updatedAt: now,
  }

  ordres.push(ot)
  payload.ordresTravail = ordres

  await supabaseRest(`org_data?organization_id=eq.${encodeURIComponent(ticket.organization_id)}`, {
    method: 'PATCH',
    body: JSON.stringify({ payload, updated_at: now }),
    prefer: 'return=minimal',
  })

  await supabaseRest(`client_tickets?id=eq.${encodeURIComponent(ticket.id)}`, {
    method: 'PATCH',
    body: JSON.stringify({
      statut: 'ot_cree',
      ot_id: otId,
      ot_numero: otNumero,
      traite_at: now,
    }),
    prefer: 'return=minimal',
  })

  const otUrl = `${APP_ORIGIN}/app/ot?id=${encodeURIComponent(otId)}`
  const toList = []
  const opEmail = payload.operateur?.email
  if (opEmail) toList.push(opEmail)
  if (payload.ticketNotificationEmail) toList.push(payload.ticketNotificationEmail)

  const profiles = await supabaseRest(
    `profiles?organization_id=eq.${encodeURIComponent(ticket.organization_id)}&active=eq.true&select=email,role`,
  )
  for (const p of profiles || []) {
    if (p.role === 'owner' && p.email) toList.push(p.email)
  }

  const mail = await sendTicketEmail({
    toList,
    siteNom: portal.site_nom || site.nom,
    clientNom: portal.client_nom || '',
    localisation: ticket.localisation,
    description: ticket.description,
    otNumero,
    otUrl,
    contact: {
      nom: ticket.contact_nom,
      email: ticket.contact_email,
      tel: ticket.contact_tel,
    },
  })

  void learnTicketVocabulary(ticket, ticket.organization_id)

  return {
    ok: true,
    otId,
    otNumero,
    ot,
    ticketId: ticket.id,
    email: mail,
  }
}

async function learnTicketVocabulary(ticket, orgId) {
  const text = [ticket.localisation, ticket.description].filter(Boolean).join(' — ')
  if (!text.trim() || !process.env.SUPABASE_SERVICE_ROLE_KEY) return
  try {
    const { learnFromText, normalizeTechnicalText } = await import('../server/lib/aiVocabularyCore.js')
    await learnFromText({
      orgId,
      text,
      agent: 'ticket',
      normalizedText: normalizeTechnicalText(text),
      metadata: { ticketId: ticket.id, siteId: ticket.site_id },
    })
  } catch (err) {
    console.warn('learnTicketVocabulary', err instanceof Error ? err.message : err)
  }
}

export default async function handler(req, res) {
  try {
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, POST, OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Ticket-Webhook-Secret')

    if (req.method === 'OPTIONS') return res.status(204).end()

    if (req.method === 'GET' || req.method === 'HEAD') {
      return res.status(200).json({
        ok: true,
        configured: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
        email: Boolean(process.env.RESEND_API_KEY),
      })
    }

    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {}
    const ticketId = String(body.ticketId || '').trim()
    if (!ticketId) return res.status(400).json({ error: 'ticketId requis' })

    const webhookSecret = String(process.env.TICKET_WEBHOOK_SECRET || '').trim()
    const headerSecret = String(req.headers['x-ticket-webhook-secret'] || '').trim()
    const authorizedWebhook = webhookSecret && headerSecret === webhookSecret

    let authorizedUser = false
    if (!authorizedWebhook) {
      const user = await verifySupabaseUser(req)
      if (user?.id) {
        const profile = await userOrgId(user.id)
        if (profile?.organization_id) {
          const tickets = await supabaseRest(
            `client_tickets?id=eq.${encodeURIComponent(ticketId)}&select=organization_id&limit=1`,
          )
          if (tickets?.[0]?.organization_id === profile.organization_id) {
            authorizedUser = true
          }
        }
      }
    }

    if (!authorizedWebhook && !authorizedUser) {
      return res.status(401).json({
        error: 'unauthorized',
        hint: 'Webhook secret ou session bureau requise.',
      })
    }

    const result = await processTicket(ticketId)
    return res.status(200).json(result)
  } catch (err) {
    console.error('process-client-ticket', err)
    return res.status(500).json({
      error: err instanceof Error ? err.message : 'unknown',
    })
  }
}
