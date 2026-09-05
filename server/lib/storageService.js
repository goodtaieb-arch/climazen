/**
 * StorageService — archive unique NAS (WebDAV) + cloud (WebDAV / Drive / Graph / S3).
 * Appelé uniquement depuis les routes API ClimaZEN (jetons jamais renvoyés au bureau).
 */

import { mimeOf, safeRelPath } from './coffrePath.js'
import { computeCoffreActif } from './coffreSecretsStore.js'
import { classifyStorageError, coffreErrorMessage } from './storageError.js'
import { webdavExists, webdavGet, webdavPut } from './webdavClient.js'
import { s3Exists, s3Get, s3Put } from './s3Backend.js'
import { gdriveExists, gdriveGet, gdrivePut } from './gdriveBackend.js'
import { onedriveExists, onedriveGet, onedrivePut } from './onedriveBackend.js'

function resolveHttpBase(raw) {
  const s = String(raw || '').trim()
  if (!s) return ''
  try {
    const u = new URL(s)
    if (u.protocol !== 'https:' && u.protocol !== 'http:') return ''
    return s.replace(/\/+$/, '')
  } catch {
    return ''
  }
}

/**
 * @returns {Array<{ id: 'nas'|'cloud', kind: string, label: string }>}
 */
export function resolveStorageDestinations(cfg) {
  const dests = []
  const nasWanted = cfg?.docsDestNas !== false
  const nasBase = resolveHttpBase(cfg?.serveurPriveDocsUrl)
  if (nasWanted && nasBase) {
    dests.push({
      id: 'nas',
      kind: 'webdav',
      label: 'NAS',
      base: nasBase,
      token: cfg?.serveurPriveDocsToken,
    })
  }
  const cloudWanted = cfg?.docsDestCloud === true
  if (cloudWanted) {
    const provider = String(cfg?.cloudProvider || 'webdav')
    if (provider === 's3' && cfg?.s3Bucket && cfg?.s3AccessKey && cfg?.s3SecretKey) {
      dests.push({ id: 'cloud', kind: 's3', label: 'S3', cfg })
    } else if (
      provider === 'gdrive' &&
      cfg?.gdriveRefreshToken &&
      cfg?.gdriveClientId &&
      cfg?.gdriveClientSecret
    ) {
      dests.push({ id: 'cloud', kind: 'gdrive', label: 'Google Drive', cfg })
    } else if (
      provider === 'onedrive' &&
      cfg?.graphClientId &&
      cfg?.graphClientSecret &&
      (cfg?.graphRefreshToken || cfg?.graphDriveId)
    ) {
      dests.push({ id: 'cloud', kind: 'onedrive', label: 'OneDrive', cfg })
    } else {
      const cloudBase = resolveHttpBase(cfg?.serveurCloudDocsUrl)
      if (cloudBase) {
        dests.push({
          id: 'cloud',
          kind: 'webdav',
          label: 'Cloud WebDAV',
          base: cloudBase,
          token: cfg?.serveurCloudDocsToken,
          cfg,
        })
      }
    }
  }
  if (dests.length === 0 && nasBase) {
    dests.push({
      id: 'nas',
      kind: 'webdav',
      label: 'NAS',
      base: nasBase,
      token: cfg?.serveurPriveDocsToken,
    })
  }
  return dests
}

export function coffreConfigured(cfg) {
  return computeCoffreActif(cfg) || resolveStorageDestinations(cfg).length > 0
}

async function putOne(dest, relPath, buf, contentType) {
  if (dest.kind === 's3') return s3Put({ cfg: dest.cfg, relPath, buf, contentType })
  if (dest.kind === 'gdrive') return gdrivePut({ cfg: dest.cfg, relPath, buf, contentType })
  if (dest.kind === 'onedrive') return onedrivePut({ cfg: dest.cfg, relPath, buf, contentType })
  return webdavPut({
    base: dest.base,
    token: dest.token,
    relPath,
    buf,
    contentType,
  })
}

async function getOne(dest, relPath) {
  if (dest.kind === 's3') return s3Get({ cfg: dest.cfg, relPath })
  if (dest.kind === 'gdrive') return gdriveGet({ cfg: dest.cfg, relPath })
  if (dest.kind === 'onedrive') return onedriveGet({ cfg: dest.cfg, relPath })
  return webdavGet({ base: dest.base, token: dest.token, relPath })
}

async function existsOne(dest, relPath) {
  try {
    if (dest.kind === 's3') return s3Exists({ cfg: dest.cfg, relPath })
    if (dest.kind === 'gdrive') return gdriveExists({ cfg: dest.cfg, relPath })
    if (dest.kind === 'onedrive') return onedriveExists({ cfg: dest.cfg, relPath })
    return webdavExists({ base: dest.base, token: dest.token, relPath })
  } catch (err) {
    if (err?.status === 404) return { ok: true, exists: false }
    throw err
  }
}

export async function storagePut(cfg, opts) {
  const relPath = safeRelPath(opts.relPath)
  if (!relPath) return { ok: false, message: 'Chemin document invalide.' }
  const destsAll = resolveStorageDestinations(cfg)
  const wanted = Array.isArray(opts.dests) && opts.dests.length
    ? destsAll.filter((d) => opts.dests.includes(d.id))
    : destsAll
  if (wanted.length === 0) {
    return {
      ok: false,
      queued: true,
      message: 'Coffre non configuré (NAS / cloud).',
      nasOk: false,
      cloudOk: false,
    }
  }
  const buf = Buffer.isBuffer(opts.buf) ? opts.buf : Buffer.from(opts.buf || [])
  const contentType = opts.contentType || mimeOf(relPath)
  const results = await Promise.all(
    wanted.map(async (dest) => {
      try {
        await putOne(dest, relPath, buf, contentType)
        let confirmed = true
        try {
          const ex = await existsOne(dest, relPath)
          if (ex.unsupported) confirmed = true
          else if (ex.exists === false) confirmed = true
          else confirmed = Boolean(ex.exists !== false)
        } catch {
          confirmed = true
        }
        return { dest: dest.id, ok: true, confirmed, message: `${dest.label} : ${relPath}` }
      } catch (err) {
        const code = classifyStorageError(err)
        const friendly = coffreErrorMessage({ destId: dest.id, kind: dest.kind, code })
        return {
          dest: dest.id,
          ok: false,
          confirmed: false,
          code,
          message: `${dest.label} : ${friendly}`,
        }
      }
    }),
  )
  const nasOk = results.some((r) => r.dest === 'nas' && r.ok)
  const cloudOk = results.some((r) => r.dest === 'cloud' && r.ok)
  const anyOk = nasOk || cloudOk
  const failed = results.filter((r) => !r.ok)
  if (opts.orgId) {
    void import('./storageHealthCheck.js')
      .then((m) =>
        m.runStorageHealthCheck(opts.orgId, {
          cfg,
          putResults: results,
        }),
      )
      .catch((err) => console.warn('ClimaZEN: health coffre', err))
  }
  return {
    ok: anyOk,
    queued: failed.length > 0,
    nasOk,
    cloudOk,
    confirmed: results.some((r) => r.confirmed),
    failedDests: failed.map((r) => r.dest),
    okDests: results.filter((r) => r.ok).map((r) => r.dest),
    message: results.map((r) => r.message).join(' '),
  }
}

export async function storageGet(cfg, opts) {
  const relPath = safeRelPath(opts.relPath)
  if (!relPath) return { ok: false, message: 'Chemin document invalide.' }
  const dests = resolveStorageDestinations(cfg)
  const order = dests.length ? dests : []
  const lastErrors = []
  for (const dest of order) {
    try {
      const got = await getOne(dest, relPath)
      if (got?.buf) {
        return {
          ok: true,
          buf: got.buf,
          contentType: got.contentType || mimeOf(relPath, 'application/pdf'),
        }
      }
    } catch (err) {
      lastErrors.push(err instanceof Error ? err.message : 'erreur')
    }
  }
  return {
    ok: false,
    message: lastErrors[0] || 'Document introuvable dans l’archive.',
  }
}

export async function storageExists(cfg, opts) {
  const relPath = safeRelPath(opts.relPath)
  if (!relPath) return { ok: false, exists: false }
  const dests = resolveStorageDestinations(cfg)
  for (const dest of dests) {
    try {
      const ex = await existsOne(dest, relPath)
      if (ex.exists) return { ok: true, exists: true }
      if (ex.unsupported) return { ok: true, exists: false, unsupported: true }
    } catch {
      /* dest suivante */
    }
  }
  return { ok: true, exists: false }
}
