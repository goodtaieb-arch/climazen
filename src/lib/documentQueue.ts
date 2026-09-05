/**
 * File d’attente locale queue_backup — si le NAS / cloud est down, le PDF
 * reste ici (IndexedDB, temporaire) et on réessaie toutes les 15 minutes
 * jusqu’à confirmation. L’utilisateur n’est pas bloqué.
 */

import type { CoffreDestId } from './docStockage'
import { storageServicePut } from './storageService'

export const QUEUE_RETRY_MS = 15 * 60 * 1000
export const QUEUE_DB_NAME = 'climazen_queue_backup'
export const QUEUE_STORE = 'queue_backup'

export type QueueDestStatus = 'pending' | 'ok' | 'skip'

export type QueueBackupItem = {
  id: string
  relPath: string
  fileName: string
  mime: string
  data: ArrayBuffer
  dests: Record<CoffreDestId, QueueDestStatus>
  createdAt: string
  lastTryAt?: string
  tries: number
  lastError?: string
}

export function isDueForRetry(item: Pick<QueueBackupItem, 'lastTryAt' | 'createdAt'>, now = Date.now()): boolean {
  const last = Date.parse(item.lastTryAt || item.createdAt || '') || 0
  if (!last) return true
  return now - last >= QUEUE_RETRY_MS
}

export function mergeQueueDests(opts: {
  failed: CoffreDestId[]
  okDests?: CoffreDestId[]
}): Record<CoffreDestId, QueueDestStatus> {
  return {
    nas: opts.okDests?.includes('nas')
      ? 'ok'
      : opts.failed.includes('nas')
        ? 'pending'
        : 'skip',
    cloud: opts.okDests?.includes('cloud')
      ? 'ok'
      : opts.failed.includes('cloud')
        ? 'pending'
        : 'skip',
  }
}

export function queueItemStillPending(dests: Record<CoffreDestId, QueueDestStatus>): boolean {
  return dests.nas === 'pending' || dests.cloud === 'pending'
}

function openQueueDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(QUEUE_DB_NAME, 1)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(QUEUE_STORE)) {
        db.createObjectStore(QUEUE_STORE, { keyPath: 'id' })
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

async function withStore<T>(
  mode: IDBTransactionMode,
  fn: (store: IDBObjectStore) => IDBRequest<T> | void,
): Promise<T | undefined> {
  const db = await openQueueDb()
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(QUEUE_STORE, mode)
      const store = tx.objectStore(QUEUE_STORE)
      const req = fn(store)
      if (!req) {
        tx.oncomplete = () => resolve(undefined)
        tx.onerror = () => reject(tx.error)
        return
      }
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => reject(req.error)
    })
  } finally {
    db.close()
  }
}

export async function enqueueDocument(opts: {
  relPath: string
  blob: Blob
  failed: CoffreDestId[]
  okDests?: CoffreDestId[]
}): Promise<void> {
  if (typeof indexedDB === 'undefined') return
  const dests = mergeQueueDests(opts)
  if (!queueItemStillPending(dests)) return
  const data = await opts.blob.arrayBuffer()
  const fileName = opts.relPath.split('/').pop() || 'document.pdf'
  const existing = await listQueueBackup()
  const same = existing.find((x) => x.relPath === opts.relPath)
  const item: QueueBackupItem = {
    id: same?.id || crypto.randomUUID(),
    relPath: opts.relPath,
    fileName,
    mime: opts.blob.type || 'application/pdf',
    data,
    dests: same
      ? {
          nas:
            dests.nas === 'ok' || same.dests.nas === 'ok'
              ? 'ok'
              : dests.nas === 'pending' || same.dests.nas === 'pending'
                ? 'pending'
                : 'skip',
          cloud:
            dests.cloud === 'ok' || same.dests.cloud === 'ok'
              ? 'ok'
              : dests.cloud === 'pending' || same.dests.cloud === 'pending'
                ? 'pending'
                : 'skip',
        }
      : dests,
    createdAt: same?.createdAt || new Date().toISOString(),
    lastTryAt: new Date().toISOString(),
    tries: (same?.tries || 0) + 1,
    lastError: undefined,
  }
  await withStore('readwrite', (store) => store.put(item))
}

export async function listQueueBackup(): Promise<QueueBackupItem[]> {
  if (typeof indexedDB === 'undefined') return []
  const db = await openQueueDb()
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(QUEUE_STORE, 'readonly')
      const req = tx.objectStore(QUEUE_STORE).getAll()
      req.onsuccess = () => resolve((req.result || []) as QueueBackupItem[])
      req.onerror = () => reject(req.error)
    })
  } catch {
    return []
  } finally {
    db.close()
  }
}

export async function countQueueBackup(): Promise<number> {
  const list = await listQueueBackup()
  return list.filter((x) => queueItemStillPending(x.dests)).length
}

export async function getQueuedDocument(relPath: string): Promise<Blob | null> {
  const list = await listQueueBackup()
  const hit = list.find((x) => x.relPath === relPath)
  if (!hit) return null
  return new Blob([hit.data], { type: hit.mime || 'application/pdf' })
}

export async function flushQueueBackup(
  _operateur?: unknown,
  opts?: { force?: boolean },
): Promise<{
  flushed: number
  remaining: number
}> {
  const force = Boolean(
    opts?.force || (typeof _operateur === 'object' && _operateur && 'force' in _operateur
      ? (_operateur as { force?: boolean }).force
      : false),
  )
  if (typeof indexedDB === 'undefined') return { flushed: 0, remaining: 0 }
  const list = await listQueueBackup()
  let flushed = 0
  const now = Date.now()
  for (const item of list) {
    if (!queueItemStillPending(item.dests)) {
      await withStore('readwrite', (store) => store.delete(item.id))
      continue
    }
    if (!force && !isDueForRetry(item, now)) continue
    const blob = new Blob([item.data], { type: item.mime || 'application/pdf' })
    const pending = (['nas', 'cloud'] as CoffreDestId[]).filter((d) => item.dests[d] === 'pending')
    const r = await storageServicePut({
      relPath: item.relPath,
      blob,
      dests: pending.length ? pending : undefined,
    })
    const next = { ...item.dests }
    if (r.nasOk && next.nas === 'pending') next.nas = 'ok'
    if (r.cloudOk && next.cloud === 'pending') next.cloud = 'ok'
    if (r.ok && !r.queued) {
      for (const d of pending) next[d] = 'ok'
    }
    const lastError = queueItemStillPending(next) ? r.message : undefined
    if (!queueItemStillPending(next)) {
      await withStore('readwrite', (store) => store.delete(item.id))
      flushed += 1
    } else {
      const updated: QueueBackupItem = {
        ...item,
        dests: next,
        lastTryAt: new Date().toISOString(),
        tries: item.tries + 1,
        lastError,
      }
      await withStore('readwrite', (store) => store.put(updated))
    }
  }
  const remaining = await countQueueBackup()
  return { flushed, remaining }
}
