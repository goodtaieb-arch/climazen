/**
 * Classification unifiée des pannes coffre (NAS WebDAV = cloud Drive/Graph/S3).
 */

export const COFFRE_ALERT_MS = 24 * 60 * 60 * 1000

export function parseHttpStatus(raw) {
  const m = /HTTP\s+(\d{3})/i.exec(String(raw || ''))
  if (m) return Number(m[1])
  const n = Number(raw)
  return Number.isFinite(n) && n >= 100 && n < 600 ? n : 0
}

export function classifyStorageError(err) {
  const status = Number(err?.status) || parseHttpStatus(err?.message || err)
  const msg = String(err?.message || err || '').toLowerCase()
  const body = String(err?.body || '').toLowerCase()
  const text = `${msg} ${body}`

  if (
    status === 401 ||
    status === 403 ||
    /invalid_grant|unauthorized|unauthorised|token.*expir|expired|invalid_client|invalid_token|authfail|accessdenied|access denied|forbidden|mot de passe|password/.test(
      text,
    )
  ) {
    return 'auth'
  }
  if (
    status === 507 ||
    status === 413 ||
    /quota|storagequota|insufficient.?storage|storage.*full|espace.*plein|over.?quota|quotaexceeded|nospace/.test(
      text,
    )
  ) {
    return 'quota'
  }
  if (
    !status ||
    status === 408 ||
    status === 429 ||
    status === 502 ||
    status === 503 ||
    status === 504 ||
    /fetch|network|enotfound|econnrefused|econnreset|etimedout|timeout|injoignable|offline|dns|socket|abort/.test(
      text,
    )
  ) {
    return 'network'
  }
  if (status >= 500) return 'network'
  return 'unknown'
}

export function coffreErrorMessage(opts) {
  const destId = opts?.destId || 'nas'
  const kind = opts?.kind || 'webdav'
  const code = opts?.code || 'unknown'
  if (code === 'auth') {
    if (kind === 'gdrive') {
      return 'Votre accès Google Drive a expiré, veuillez vous re-connecter dans ClimaZEN.'
    }
    if (kind === 'onedrive') {
      return 'Votre accès OneDrive / SharePoint a expiré, veuillez vous re-connecter dans ClimaZEN.'
    }
    if (kind === 's3') {
      return 'Les clés AWS S3 sont refusées. Vérifiez l’access key / secret dans Mon entreprise.'
    }
    return destId === 'nas'
      ? 'Authentification NAS refusée (jeton ou mot de passe changé).'
      : 'Authentification cloud / WebDAV refusée (jeton expiré ou mot de passe changé).'
  }
  if (code === 'quota') {
    return destId === 'nas'
      ? 'Espace de stockage du NAS saturé (quota plein).'
      : 'Espace de stockage cloud saturé (quota plein).'
  }
  if (code === 'network') {
    return destId === 'nas'
      ? 'NAS hors ligne (coupure réseau ou serveur injoignable).'
      : 'Cloud injoignable (coupure réseau ou service indisponible).'
  }
  return destId === 'nas' ? 'NAS injoignable.' : 'Cloud injoignable.'
}

export function destLabel(kind, destId) {
  if (kind === 'gdrive') return 'Google Drive'
  if (kind === 'onedrive') return 'OneDrive / SharePoint'
  if (kind === 's3') return 'AWS S3'
  return destId === 'cloud' ? 'Cloud' : 'NAS'
}

/**
 * Fusionne un probe avec l’historique (conserve `since` tant que ça reste en panne).
 */
export function mergeDestHealth(prev, probe, nowIso) {
  const now = nowIso || new Date().toISOString()
  if (probe.ok) {
    return {
      ok: true,
      kind: probe.kind,
      label: probe.label,
      lastCheckAt: now,
      since: null,
      code: null,
      message: null,
    }
  }
  const sameOutage = prev && prev.ok === false && prev.since
  return {
    ok: false,
    kind: probe.kind,
    label: probe.label,
    code: probe.code,
    message: probe.message,
    lastCheckAt: now,
    since: sameOutage ? prev.since : now,
  }
}

export function summarizeCoffreHealth(dests) {
  const list = Object.values(dests || {}).filter(Boolean)
  const down = list.filter((d) => d.ok === false)
  const synced = list.length > 0 && down.length === 0
  const sinceTimes = down.map((d) => Date.parse(d.since || '')).filter((t) => Number.isFinite(t))
  const since = sinceTimes.length ? new Date(Math.min(...sinceTimes)).toISOString() : null
  const causes = down.map((d) => d.message).filter(Boolean)
  return {
    synced,
    interrupted: down.length > 0,
    since,
    message: causes[0] || (synced ? 'Coffre synchronisé' : ''),
    causes,
  }
}

export function shouldEmailCoffreAlert(health, now = Date.now()) {
  if (!health || health.synced) return false
  const since = Date.parse(health.since || '')
  if (!Number.isFinite(since)) return false
  if (now - since < COFFRE_ALERT_MS) return false
  const last = Date.parse(health.lastEmailAt || '')
  if (Number.isFinite(last) && last >= since) return false
  return true
}

export function httpError(message, status, extra) {
  const err = new Error(message)
  err.status = status
  if (extra) Object.assign(err, extra)
  return err
}
