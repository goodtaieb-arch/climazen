/**
 * Archive documents : les PDF ne sont PAS stockés sur ClimaZEN.
 * Source de vérité = serveur privé (NAS / Nextcloud / WebDAV).
 * Le site ne garde que le chemin + métadonnées. Le bureau télécharge via l’app.
 */

import type { CoffreDestId, DocKind, OperateurDocsStockage } from './docStockage'
import {
  cheminRelatifDocument,
  coffreDestConfig,
  coffreDestinationsVoulues,
  resolveServeurCloudBase,
  resolveServeurPriveBase,
} from './docStockage'

export type DocumentArchive = {
  id: string
  kind: DocKind
  fileName: string
  relPath: string
  interventionId?: string
  otId?: string
  devisId?: string
  commandeId?: string
  clientId?: string
  createdAt: string
  createdByUserId?: string
  archivedAt?: string
}

export const COPIE_SECOURS_RELPATH = 'ClimaZEN/Documents/Secours/climazen-donnees.xlsx.enc'
export const COPIE_SECOURS_RELPATH_CLAIR = 'ClimaZEN/Documents/Secours/climazen-donnees.xlsx'
export const QUEUE_BACKUP_FOLDER = 'ClimaZEN/Documents/queue_backup'

export function peutConfigurerCoffreDocs(opts: {
  isOwner?: boolean
  userId?: string
  personnelStockageDocsUserIds?: string[]
}): boolean {
  if (opts.isOwner) return true
  const id = String(opts.userId || '').trim()
  if (!id) return false
  return (opts.personnelStockageDocsUserIds || []).includes(id)
}

export function archivePriveConfigure(op?: OperateurDocsStockage | null): boolean {
  return Boolean(resolveServeurPriveBase(op) || resolveServeurCloudBase(op))
}

export function normalizePersonnelStockageDocsUserIds(ids?: string[] | null): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const raw of ids || []) {
    const id = String(raw || '').trim()
    if (!id || seen.has(id)) continue
    seen.add(id)
    out.push(id)
  }
  return out
}

export function findArchive(opts: {
  archives?: DocumentArchive[]
  interventionId?: string
  devisId?: string
  commandeId?: string
  relPath?: string
  kind?: DocKind
}): DocumentArchive | undefined {
  const list = (opts.archives || []).filter((a) => !opts.kind || a.kind === opts.kind)
  if (opts.interventionId) {
    const hit = list.find((a) => a.interventionId === opts.interventionId)
    if (hit) return hit
  }
  if (opts.devisId) {
    const hit = list.find((a) => a.devisId === opts.devisId)
    if (hit) return hit
  }
  if (opts.commandeId) {
    const hit = list.find((a) => a.commandeId === opts.commandeId)
    if (hit) return hit
  }
  if (opts.relPath) return list.find((a) => a.relPath === opts.relPath)
  return undefined
}

/** Remplace une archive existante (même chemin, ou même pièce + type). */
export function mergeArchive(
  list: DocumentArchive[] | undefined,
  meta: DocumentArchive,
): DocumentArchive[] {
  const prev = list || []
  const next = prev.filter((a) => {
    if (a.id === meta.id) return false
    if (a.relPath === meta.relPath) return false
    if (
      meta.interventionId &&
      a.interventionId === meta.interventionId &&
      a.kind === meta.kind
    ) {
      return false
    }
    if (meta.devisId && a.devisId === meta.devisId && a.kind === meta.kind) return false
    if (meta.commandeId && a.commandeId === meta.commandeId && a.kind === meta.kind) {
      return false
    }
    return true
  })
  return [...next, { ...meta, archivedAt: meta.archivedAt || new Date().toISOString() }]
}

/** Chemin relatif sûr (sous ClimaZEN/, pas de ..). */
export function isSafeDocumentRelPath(relPath: string): boolean {
  try {
    assertSafeRelPath(relPath)
    return true
  } catch {
    return false
  }
}

export function buildArchiveMeta(opts: {
  kind: DocKind
  fileName: string
  clientNom?: string
  interventionId?: string
  otId?: string
  devisId?: string
  commandeId?: string
  clientId?: string
  createdByUserId?: string
}): DocumentArchive {
  const relPath = cheminRelatifDocument({
    kind: opts.kind,
    fileName: opts.fileName,
    clientNom: opts.clientNom,
  })
  return {
    id: crypto.randomUUID(),
    kind: opts.kind,
    fileName: opts.fileName,
    relPath,
    interventionId: opts.interventionId,
    otId: opts.otId,
    devisId: opts.devisId,
    commandeId: opts.commandeId,
    clientId: opts.clientId,
    createdAt: new Date().toISOString(),
    createdByUserId: opts.createdByUserId,
  }
}

function assertSafeRelPath(relPath: string): string {
  const p = String(relPath || '').replace(/^\/+/, '').trim()
  if (!p || p.length > 500 || p.includes('..') || p.includes('\\') || p.includes('\0')) {
    throw new Error('Chemin document invalide.')
  }
  if (!p.startsWith('ClimaZEN/')) {
    throw new Error('Chemin document hors coffre ClimaZEN/.')
  }
  return p
}

async function blobToBase64(blob: Blob): Promise<string> {
  const buf = await blob.arrayBuffer()
  const bytes = new Uint8Array(buf)
  let bin = ''
  const chunk = 0x8000
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode(...bytes.subarray(i, i + chunk))
  }
  return btoa(bin)
}

function base64ToBlob(b64: string, mime: string): Blob {
  const bin = atob(b64)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return new Blob([bytes], { type: mime || 'application/pdf' })
}

async function callArchiveApi(body: Record<string, unknown>): Promise<{
  ok: boolean
  message?: string
  contentBase64?: string
  contentType?: string
  exists?: boolean
  unsupported?: boolean
}> {
  const res = await fetch('/api/docs-archive', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const data = (await res.json().catch(() => ({}))) as {
    ok?: boolean
    message?: string
    error?: string
    contentBase64?: string
    contentType?: string
    exists?: boolean
    unsupported?: boolean
  }
  if (!res.ok || !data.ok) {
    return {
      ok: false,
      message: data.message || data.error || `Archive HTTP ${res.status}`,
      unsupported: data.unsupported,
    }
  }
  return {
    ok: true,
    message: data.message,
    contentBase64: data.contentBase64,
    contentType: data.contentType,
    exists: data.exists,
    unsupported: data.unsupported,
  }
}

export type PutDocumentResult = {
  ok: boolean
  message: string
  queued?: boolean
  nasOk?: boolean
  cloudOk?: boolean
  confirmed?: boolean
}

export async function putToCoffreDest(opts: {
  dest: CoffreDestId
  operateur?: OperateurDocsStockage | null
  relPath: string
  blob: Blob
}): Promise<{ ok: boolean; message: string }> {
  const { base, token } = coffreDestConfig(opts.operateur, opts.dest)
  if (!base) {
    return {
      ok: false,
      message:
        opts.dest === 'cloud'
          ? 'Cloud miroir non configuré (URL WebDAV Drive / OneDrive / rclone).'
          : 'Serveur NAS / WebDAV non configuré.',
    }
  }
  const relPath = assertSafeRelPath(opts.relPath)
  const contentBase64 = await blobToBase64(opts.blob)
  const res = await callArchiveApi({
    action: 'put',
    baseUrl: base,
    token: token || '',
    relPath,
    contentBase64,
    contentType: opts.blob.type || 'application/pdf',
  })
  const label = opts.dest === 'cloud' ? 'Cloud' : 'NAS'
  return {
    ok: res.ok,
    message: res.message || (res.ok ? `${label} : ${relPath}` : `${label} : archive impossible.`),
  }
}

export async function existsOnCoffreDest(opts: {
  dest: CoffreDestId
  operateur?: OperateurDocsStockage | null
  relPath: string
}): Promise<{ ok: boolean; unsupported?: boolean }> {
  const { base, token } = coffreDestConfig(opts.operateur, opts.dest)
  if (!base) return { ok: false }
  const relPath = assertSafeRelPath(opts.relPath)
  const res = await callArchiveApi({
    action: 'exists',
    baseUrl: base,
    token: token || '',
    relPath,
  })
  if (res.unsupported) return { ok: false, unsupported: true }
  return { ok: Boolean(res.ok && res.exists !== false) }
}

export async function putAndConfirmCoffreDest(opts: {
  dest: CoffreDestId
  operateur?: OperateurDocsStockage | null
  relPath: string
  blob: Blob
}): Promise<{ ok: boolean; confirmed: boolean; message: string }> {
  const put = await putToCoffreDest(opts)
  if (!put.ok) return { ok: false, confirmed: false, message: put.message }
  try {
    const exists = await existsOnCoffreDest(opts)
    if (exists.ok) return { ok: true, confirmed: true, message: put.message }
    if (exists.unsupported) return { ok: true, confirmed: true, message: put.message }
  } catch {
    /* PUT a réussi — on confirme quand même */
  }
  return { ok: true, confirmed: true, message: put.message }
}

export async function putDocumentExterne(opts: {
  operateur?: OperateurDocsStockage | null
  relPath: string
  blob: Blob
}): Promise<PutDocumentResult> {
  const dests = coffreDestinationsVoulues(opts.operateur)
  const relPath = assertSafeRelPath(opts.relPath)
  if (dests.length === 0) {
    await enqueueFailedDests({
      operateur: opts.operateur,
      relPath,
      blob: opts.blob,
      failed: ['nas', 'cloud'],
    })
    return {
      ok: true,
      queued: true,
      message: 'Coffre hors ligne — document en file d’attente (queue_backup), nouvel essai auto.',
    }
  }

  const results = await Promise.all(
    dests.map(async (dest) => {
      const r = await putAndConfirmCoffreDest({
        dest,
        operateur: opts.operateur,
        relPath,
        blob: opts.blob,
      })
      return { dest, ...r }
    }),
  )

  const nasOk = results.some((r) => r.dest === 'nas' && r.ok)
  const cloudOk = results.some((r) => r.dest === 'cloud' && r.ok)
  const failed = results.filter((r) => !r.ok).map((r) => r.dest)
  const confirmed = results.some((r) => r.confirmed)

  if (failed.length > 0) {
    await enqueueFailedDests({
      operateur: opts.operateur,
      relPath,
      blob: opts.blob,
      failed,
      okDests: results.filter((r) => r.ok).map((r) => r.dest),
    })
  }

  const queued = failed.length > 0
  const anyOk = nasOk || cloudOk
  const parts = results.map((r) => r.message)
  if (queued) parts.push('File d’attente queue_backup — nouvel essai toutes les 15 min.')

  return {
    ok: anyOk || queued,
    queued,
    nasOk,
    cloudOk,
    confirmed,
    message: parts.join(' '),
  }
}

async function enqueueFailedDests(opts: {
  operateur?: OperateurDocsStockage | null
  relPath: string
  blob: Blob
  failed: CoffreDestId[]
  okDests?: CoffreDestId[]
}) {
  try {
    const { enqueueDocument } = await import('./documentQueue')
    await enqueueDocument({
      relPath: opts.relPath,
      blob: opts.blob,
      failed: opts.failed,
      okDests: opts.okDests,
    })
  } catch (err) {
    console.warn('ClimaZEN: file d’attente coffre', err)
  }
}

export async function getFromCoffreDest(opts: {
  dest: CoffreDestId
  operateur?: OperateurDocsStockage | null
  relPath: string
}): Promise<{ ok: true; blob: Blob } | { ok: false; message: string }> {
  const { base, token } = coffreDestConfig(opts.operateur, opts.dest)
  if (!base) return { ok: false, message: 'Destination non configurée.' }
  const relPath = assertSafeRelPath(opts.relPath)
  const res = await callArchiveApi({
    action: 'get',
    baseUrl: base,
    token: token || '',
    relPath,
  })
  if (!res.ok || !res.contentBase64) {
    return { ok: false, message: res.message || 'Document introuvable.' }
  }
  return {
    ok: true,
    blob: base64ToBlob(res.contentBase64, res.contentType || 'application/pdf'),
  }
}

export async function getDocumentExterne(opts: {
  operateur?: OperateurDocsStockage | null
  relPath: string
}): Promise<{ ok: true; blob: Blob } | { ok: false; message: string }> {
  const relPath = assertSafeRelPath(opts.relPath)
  const dests = coffreDestinationsVoulues(opts.operateur)
  const order: CoffreDestId[] = dests.length ? dests : ['nas', 'cloud']
  for (const dest of order) {
    const got = await getFromCoffreDest({ dest, operateur: opts.operateur, relPath })
    if (got.ok) return got
  }
  try {
    const { getQueuedDocument } = await import('./documentQueue')
    const queued = await getQueuedDocument(relPath)
    if (queued) return { ok: true, blob: queued }
  } catch {
    /* ignore */
  }
  return { ok: false, message: 'Document introuvable dans l’archive.' }
}
