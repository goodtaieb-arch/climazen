/**
 * StorageHealthCheck — même logique NAS (WebDAV) et cloud (Drive / Graph / S3).
 */

import { supabaseRest } from './supabaseServer.js'
import { loadCoffreConfig, loadOrgPayload } from './coffreSecretsStore.js'
import { s3Ping } from './s3Backend.js'
import { gdrivePing } from './gdriveBackend.js'
import { onedrivePing } from './onedriveBackend.js'
import { webdavPing } from './webdavClient.js'
import {
  classifyStorageError,
  coffreErrorMessage,
  destLabel,
  mergeDestHealth,
  shouldEmailCoffreAlert,
  summarizeCoffreHealth,
} from './storageError.js'

const DEFAULT_FROM = 'ClimaZEN <contact@climazen.fr>'
const APP_ORIGIN = (process.env.APP_ORIGIN || 'https://climazen.fr').replace(/\/$/, '')

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || '').trim())
}

export async function pingStorageDest(dest) {
  const kind = dest.kind || 'webdav'
  const destId = dest.id
  const label = dest.label || destLabel(kind, destId)
  try {
    if (kind === 's3') await s3Ping({ cfg: dest.cfg })
    else if (kind === 'gdrive') await gdrivePing({ cfg: dest.cfg })
    else if (kind === 'onedrive') await onedrivePing({ cfg: dest.cfg })
    else await webdavPing({ base: dest.base, token: dest.token })
    return { ok: true, destId, kind, label }
  } catch (err) {
    const code = classifyStorageError(err)
    return {
      ok: false,
      destId,
      kind,
      label,
      code,
      message: coffreErrorMessage({ destId, kind, code }),
    }
  }
}

export function probeFromPutError(dest, errOrMessage) {
  const kind = dest.kind || 'webdav'
  const destId = dest.id
  const err = errOrMessage instanceof Error ? errOrMessage : new Error(String(errOrMessage || ''))
  const code = classifyStorageError(err)
  return {
    ok: false,
    destId,
    kind,
    label: dest.label || destLabel(kind, destId),
    code,
    message: coffreErrorMessage({ destId, kind, code }),
  }
}

export async function loadCoffreHealth(orgId) {
  try {
    const rows = await supabaseRest(
      `organization_coffre_secrets?organization_id=eq.${encodeURIComponent(orgId)}&select=health,secrets&limit=1`,
    )
    const health = rows?.[0]?.health
    if (health && typeof health === 'object' && !Array.isArray(health) && Object.keys(health).length) {
      return health
    }
    const secrets = rows?.[0]?.secrets
    if (secrets?.__health && typeof secrets.__health === 'object') return secrets.__health
  } catch {
    /* colonne absente */
  }
  return { dests: {}, synced: true, interrupted: false }
}

async function persistCoffreHealth(orgId, health) {
  const body = { health, updated_at: new Date().toISOString() }
  try {
    await supabaseRest(`organization_coffre_secrets?organization_id=eq.${encodeURIComponent(orgId)}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
      prefer: 'return=minimal',
    })
    return true
  } catch {
    try {
      const rows = await supabaseRest(
        `organization_coffre_secrets?organization_id=eq.${encodeURIComponent(orgId)}&select=secrets&limit=1`,
      )
      const secrets = { ...(rows?.[0]?.secrets || {}), __health: health }
      await supabaseRest(`organization_coffre_secrets?organization_id=eq.${encodeURIComponent(orgId)}`, {
        method: 'PATCH',
        body: JSON.stringify({ secrets, updated_at: body.updated_at }),
        prefer: 'return=minimal',
      })
      return true
    } catch {
      return false
    }
  }
}

export function publicHealthView(health) {
  const dests = {}
  for (const [id, d] of Object.entries(health?.dests || {})) {
    dests[id] = {
      ok: Boolean(d?.ok),
      kind: d?.kind || null,
      label: d?.label || destLabel(d?.kind, id),
      code: d?.ok ? null : d?.code || null,
      message: d?.ok ? null : d?.message || null,
      since: d?.ok ? null : d?.since || null,
      lastCheckAt: d?.lastCheckAt || null,
    }
  }
  const summary = summarizeCoffreHealth(dests)
  return {
    synced: summary.synced,
    interrupted: summary.interrupted,
    since: summary.since,
    message: summary.synced ? 'Coffre synchronisé' : summary.message || 'Synchro interrompue',
    dests,
    lastCheckAt: health?.lastCheckAt || null,
    lastEmailAt: health?.lastEmailAt || null,
  }
}

export async function runStorageHealthCheck(orgId, opts = {}) {
  const { resolveStorageDestinations } = await import('./storageService.js')
  const cfg = opts.cfg || (await loadCoffreConfig(orgId))
  const dests = resolveStorageDestinations(cfg)
  const prev = await loadCoffreHealth(orgId)
  const nowIso = new Date().toISOString()
  const nextDests = { ...(prev.dests || {}) }

  if (opts.putResults && Array.isArray(opts.putResults)) {
    for (const r of opts.putResults) {
      const dest = dests.find((d) => d.id === r.dest) || {
        id: r.dest,
        kind: 'webdav',
        label: destLabel('webdav', r.dest),
      }
      const probe = r.ok
        ? { ok: true, destId: dest.id, kind: dest.kind, label: dest.label }
        : probeFromPutError(dest, r.message)
      nextDests[dest.id] = mergeDestHealth(nextDests[dest.id], probe, nowIso)
    }
  } else {
    const probes = await Promise.all(dests.map((d) => pingStorageDest(d)))
    for (const probe of probes) {
      nextDests[probe.destId] = mergeDestHealth(nextDests[probe.destId], probe, nowIso)
    }
    for (const id of Object.keys(nextDests)) {
      if (!dests.some((d) => d.id === id)) delete nextDests[id]
    }
  }

  const summary = summarizeCoffreHealth(nextDests)
  const health = {
    dests: nextDests,
    synced: summary.synced,
    interrupted: summary.interrupted,
    since: summary.since,
    message: summary.synced ? 'Coffre synchronisé' : summary.message,
    lastCheckAt: nowIso,
    lastEmailAt: prev.lastEmailAt || null,
    lastEmailCause: prev.lastEmailCause || null,
  }

  let emailed = false
  if (shouldEmailCoffreAlert(health, Date.parse(nowIso))) {
    const sent = await sendCoffreAlertEmail(orgId, health)
    if (sent.ok) {
      health.lastEmailAt = nowIso
      health.lastEmailCause = health.message
      emailed = true
    }
  }
  if (health.synced) {
    health.lastEmailAt = null
    health.lastEmailCause = null
    health.since = null
  }

  await persistCoffreHealth(orgId, health)
  return { ...publicHealthView(health), emailed, configured: dests.length > 0 }
}

async function ownerEmails(orgId) {
  const emails = []
  try {
    const rows = await supabaseRest(
      `profiles?organization_id=eq.${encodeURIComponent(orgId)}&role=eq.owner&active=eq.true&select=email&limit=5`,
    )
    for (const r of rows || []) {
      if (isValidEmail(r.email)) emails.push(String(r.email).trim())
    }
  } catch {
    /* ignore */
  }
  try {
    const { payload } = await loadOrgPayload(orgId)
    const op = payload?.operateur || {}
    if (isValidEmail(op.email)) emails.push(String(op.email).trim())
    if (isValidEmail(op.ticketNotificationEmail)) emails.push(String(op.ticketNotificationEmail).trim())
  } catch {
    /* ignore */
  }
  return [...new Set(emails)]
}

function escapeHtml(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

async function sendCoffreAlertEmail(orgId, health) {
  const key = process.env.RESEND_API_KEY
  const from = (process.env.MAIL_FROM || DEFAULT_FROM).trim() || DEFAULT_FROM
  if (!key) return { ok: false, skipped: true, reason: 'RESEND_API_KEY absent' }
  const toList = await ownerEmails(orgId)
  if (!toList.length) return { ok: false, skipped: true, reason: 'Aucun e-mail gérant' }

  const causes = Object.values(health.dests || {})
    .filter((d) => d && d.ok === false)
    .map((d) => `• ${d.label || 'Coffre'} : ${d.message}`)
  const cause = causes.join('\n') || health.message || 'Coffre injoignable.'
  const subject = 'ClimaZEN — coffre documents : synchro interrompue depuis 24 h'
  const text = `Bonjour,

Le coffre documents (NAS / cloud) est inaccessible depuis plus de 24 heures.

${cause}

Reconnectez ou corrigez l’accès dans ClimaZEN → Mon entreprise :
${APP_ORIGIN}/app/operateur

Les PDF en attente restent dans la file locale queue_backup et seront renvoyés dès que le coffre répond.

— ClimaZEN`

  const html = `<!DOCTYPE html>
<html><body style="font-family:sans-serif;color:#0f172a;">
  <div style="max-width:560px;margin:0 auto;padding:24px;">
    <h1 style="font-size:18px;">Synchro coffre interrompue</h1>
    <p>Le coffre documents (NAS / cloud) est inaccessible depuis plus de <strong>24 heures</strong>.</p>
    <p style="background:#fef2f2;border:1px solid #fecaca;border-radius:12px;padding:12px 14px;">
      ${escapeHtml(cause).replace(/\n/g, '<br/>')}
    </p>
    <p><a href="${APP_ORIGIN}/app/operateur">Ouvrir Mon entreprise</a> pour re-connecter l’accès.</p>
    <p style="font-size:13px;color:#64748b;">Les PDF en file d’attente (queue_backup) seront renvoyés dès que le coffre répond.</p>
  </div>
</body></html>`

  const sendRes = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from, to: toList, subject, text, html }),
  })
  const sendData = await sendRes.json().catch(() => ({}))
  if (!sendRes.ok) {
    return { ok: false, error: sendData?.message || `Resend ${sendRes.status}` }
  }
  return { ok: true, id: sendData.id, to: toList }
}

export async function runHealthForAllOrgs() {
  let rows = []
  try {
    rows = await supabaseRest(
      'organization_coffre_secrets?coffre_actif=eq.true&select=organization_id&limit=200',
    )
  } catch {
    return { ok: false, error: 'Table coffre indisponible.', checked: 0 }
  }
  const ids = [...new Set((rows || []).map((r) => r.organization_id).filter(Boolean))]
  let interrupted = 0
  let emailed = 0
  for (const orgId of ids) {
    try {
      const r = await runStorageHealthCheck(orgId)
      if (r.interrupted) interrupted += 1
      if (r.emailed) emailed += 1
    } catch (err) {
      console.warn('coffre-health org', orgId, err)
    }
  }
  return { ok: true, checked: ids.length, interrupted, emailed }
}
