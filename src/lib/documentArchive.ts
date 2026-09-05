/**
 * Archive documents : les PDF ne sont PAS stockés sur ClimaZEN.
 * Source de vérité = serveur privé (NAS / Nextcloud / WebDAV).
 * Le site ne garde que le chemin + métadonnées. Le bureau télécharge via l’app.
 */

import type { CoffreDestId, DocKind, OperateurDocsStockage } from './docStockage'
import {
  cheminRelatifDocument,
  coffreDestinationsVoulues,
  resolveServeurCloudBase,
  resolveServeurPriveBase,
} from './docStockage'
import { storageServiceDownloadById, storageServiceGet } from './storageService'

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
  if (op && 'coffreActif' in op && (op as { coffreActif?: boolean }).coffreActif) return true
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

export type PutDocumentResult = {
  ok: boolean
  message: string
  queued?: boolean
  nasOk?: boolean
  cloudOk?: boolean
  confirmed?: boolean
}

async function enqueueFailedDests(opts: {
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

/**
 * Enfile d’abord (UI non bloquée), puis tente le proxy /api/documents en fond.
 * Confirmation NAS/cloud → suppression du temporaire (queue_backup).
 */
export async function putDocumentExterne(opts: {
  operateur?: OperateurDocsStockage | null
  relPath: string
  blob: Blob
}): Promise<PutDocumentResult> {
  const dests = coffreDestinationsVoulues(opts.operateur)
  const relPath = assertSafeRelPath(opts.relPath)
  const pending = dests.length ? dests : (['nas', 'cloud'] as CoffreDestId[])
  await enqueueFailedDests({
    relPath,
    blob: opts.blob,
    failed: pending,
  })
  /* Laisser le PDF lisible depuis la file locale quelques secondes, puis envoyer. */
  const kickFlush = () => {
    void import('./documentQueue')
      .then(({ flushQueueBackup }) => flushQueueBackup({ force: true }))
      .catch((err) => {
        console.warn('ClimaZEN: flush coffre', err)
      })
  }
  if (typeof window !== 'undefined') {
    window.setTimeout(kickFlush, 2500)
  } else {
    kickFlush()
  }
  return {
    ok: true,
    queued: true,
    message: 'Envoi coffre en file d’attente — nouvel essai auto toutes les 15 min.',
  }
}

export async function getDocumentExterne(opts: {
  operateur?: OperateurDocsStockage | null
  relPath: string
  archiveId?: string
}): Promise<{ ok: true; blob: Blob } | { ok: false; message: string }> {
  const relPath = assertSafeRelPath(opts.relPath)
  try {
    const { getQueuedDocument } = await import('./documentQueue')
    const queued = await getQueuedDocument(relPath)
    if (queued) return { ok: true, blob: queued }
  } catch {
    /* ignore */
  }
  if (opts.archiveId) {
    const byId = await storageServiceDownloadById(opts.archiveId)
    if (byId.ok) return { ok: true, blob: byId.blob }
  }
  const got = await storageServiceGet(relPath)
  if (got.ok) return got
  return { ok: false, message: got.message || 'Document introuvable dans l’archive.' }
}
