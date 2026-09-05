/**
 * Routes coffre : PUT/GET/exists/backup-excel/save-config + download par id.
 * Le client n’envoie que le JWT — jamais d’URL NAS ni de jeton.
 */

import { authorizeOrgRequest } from './authorizeOrg.js'
import { buildExcelBackupBuffer } from './buildExcelBackup.js'
import { COPIE_SECOURS_RELPATH, MAX_DOCUMENT_BYTES, mimeOf, safeRelPath } from './coffrePath.js'
import {
  loadCoffreConfig,
  loadOrgPayload,
  ownerSafeConfig,
  publicCoffreView,
  saveCoffreConfig,
} from './coffreSecretsStore.js'
import { chiffrerCopieSecoursBuffer, motDePasseExcelValide } from './documentCrypto.js'
import { storageExists, storageGet, storagePut } from './storageService.js'

function bad(res, status, message) {
  res.status(status).json({ ok: false, error: message, message })
}

function parseBody(req) {
  if (!req.body) return {}
  if (typeof req.body === 'string') {
    try {
      return JSON.parse(req.body || '{}')
    } catch {
      return {}
    }
  }
  return req.body
}

function findArchive(payload, id) {
  const list = payload?.documentsArchives || []
  return list.find((a) => a && a.id === id)
}

async function withAuth(req, res) {
  const auth = await authorizeOrgRequest(req)
  if (!auth.ok) {
    bad(res, auth.status, auth.error)
    return null
  }
  return auth
}

export async function handleDocumentsPost(req, res) {
  const auth = await withAuth(req, res)
  if (!auth) return
  const body = parseBody(req)
  const action = String(body.action || '')
  const cfg = await loadCoffreConfig(auth.orgId)

  if (action === 'save-config') {
    if (!auth.isOwner) {
      bad(res, 403, 'Configuration coffre réservée au gérant.')
      return
    }
    const saved = await saveCoffreConfig(auth.orgId, body.config || body, auth.user.id)
    if (!saved.ok) {
      bad(res, 503, saved.error)
      return
    }
    res.status(200).json({
      ok: true,
      coffreActif: saved.coffreActif,
      stored: saved.stored,
      warning: saved.warning,
      public: publicCoffreView(saved.config),
    })
    return
  }

  if (action === 'config') {
    if (auth.isOwner) {
      res.status(200).json({
        ok: true,
        owner: true,
        config: ownerSafeConfig(cfg),
        public: publicCoffreView(cfg),
      })
      return
    }
    res.status(200).json({ ok: true, owner: false, public: publicCoffreView(cfg) })
    return
  }

  if (action === 'health') {
    const { runStorageHealthCheck, loadCoffreHealth, publicHealthView } = await import(
      './storageHealthCheck.js'
    )
    const probe = auth.isOwner && body.probe !== false
    const health = probe
      ? await runStorageHealthCheck(auth.orgId, { cfg })
      : publicHealthView(await loadCoffreHealth(auth.orgId))
    res.status(200).json({
      ok: true,
      coffreActif: Boolean(cfg.coffreActif),
      health,
    })
    return
  }

  if (action === 'backup-excel') {
    if (!motDePasseExcelValide(cfg.coffreExcelMotDePasse)) {
      bad(
        res,
        400,
        'Copie Excel : le gérant doit définir un mot de passe (8 caractères min.) dans Mon entreprise.',
      )
      return
    }
    const { payload } = await loadOrgPayload(auth.orgId)
    const plain = buildExcelBackupBuffer(payload)
    const enc = chiffrerCopieSecoursBuffer(plain, cfg.coffreExcelMotDePasse)
    const put = await storagePut(cfg, {
      relPath: COPIE_SECOURS_RELPATH,
      buf: enc,
      contentType: 'application/octet-stream',
      orgId: auth.orgId,
    })
    if (!put.ok) {
      bad(res, 502, put.message || 'Copie Excel : coffre injoignable.')
      return
    }
    res.status(200).json({
      ok: true,
      queued: put.queued,
      nasOk: put.nasOk,
      cloudOk: put.cloudOk,
      message: `Copie Excel chiffrée (${COPIE_SECOURS_RELPATH}).${put.queued ? ' File d’attente distante partielle.' : ''}`,
    })
    return
  }

  const relPath = safeRelPath(body.relPath)
  if (action !== 'put' && action !== 'get' && action !== 'exists') {
    bad(res, 400, 'Action inconnue.')
    return
  }
  if (!relPath) {
    bad(res, 400, 'Chemin document invalide.')
    return
  }

  if (action === 'put') {
    const b64 = String(body.contentBase64 || '')
    if (!b64 || b64.length > 14_000_000) {
      bad(res, 400, 'Fichier trop volumineux ou vide (max ~10 Mo).')
      return
    }
    const buf = Buffer.from(b64, 'base64')
    if (buf.length > MAX_DOCUMENT_BYTES) {
      bad(res, 400, 'Fichier trop volumineux (max 10 Mo).')
      return
    }
    const put = await storagePut(cfg, {
      relPath,
      buf,
      contentType: String(body.contentType || mimeOf(relPath)),
      dests: Array.isArray(body.dests) ? body.dests : undefined,
      orgId: auth.orgId,
    })
    if (!put.ok) {
      res.status(200).json({
        ok: false,
        queued: true,
        nasOk: false,
        cloudOk: false,
        failedDests: put.failedDests || ['nas', 'cloud'],
        message: put.message,
      })
      return
    }
    res.status(200).json({
      ok: true,
      queued: put.queued,
      nasOk: put.nasOk,
      cloudOk: put.cloudOk,
      confirmed: put.confirmed,
      failedDests: put.failedDests || [],
      okDests: put.okDests || [],
      message: put.message,
    })
    return
  }

  if (action === 'exists') {
    const ex = await storageExists(cfg, { relPath })
    if (ex.exists) {
      res.status(200).json({ ok: true, exists: true })
      return
    }
    res.status(200).json({
      ok: true,
      exists: false,
      unsupported: ex.unsupported,
    })
    return
  }

  const got = await storageGet(cfg, { relPath })
  if (!got.ok || !got.buf) {
    bad(res, 404, got.message || 'Document introuvable.')
    return
  }
  if (got.buf.length > MAX_DOCUMENT_BYTES) {
    bad(res, 400, 'Fichier trop volumineux.')
    return
  }
  res.status(200).json({
    ok: true,
    contentBase64: got.buf.toString('base64'),
    contentType: got.contentType,
  })
}

export async function handleDocumentsDownload(req, res, archiveId) {
  const auth = await withAuth(req, res)
  if (!auth) return
  const id = String(archiveId || req.query?.id || '').trim()
  const relQuery = safeRelPath(req.query?.relPath)
  const cfg = await loadCoffreConfig(auth.orgId)
  let relPath = relQuery
  let fileName = relPath ? relPath.split('/').pop() : 'document.pdf'
  if (id) {
    const { payload } = await loadOrgPayload(auth.orgId)
    const hit = findArchive(payload, id)
    if (!hit?.relPath) {
      bad(res, 404, 'Archive introuvable.')
      return
    }
    relPath = safeRelPath(hit.relPath)
    fileName = hit.fileName || fileName
  }
  if (!relPath) {
    bad(res, 400, 'Document introuvable.')
    return
  }
  const got = await storageGet(cfg, { relPath })
  if (!got.ok || !got.buf) {
    bad(res, 404, got.message || 'Document introuvable dans le coffre.')
    return
  }
  const type = got.contentType || mimeOf(relPath, 'application/pdf')
  const inline = !String(req.query?.download || '').trim()
  res.setHeader('Content-Type', type)
  res.setHeader(
    'Content-Disposition',
    `${inline ? 'inline' : 'attachment'}; filename="${fileName.replace(/"/g, '')}"`,
  )
  res.setHeader('Cache-Control', 'private, no-store')
  res.setHeader('X-Content-Type-Options', 'nosniff')
  res.status(200).send(got.buf)
}
