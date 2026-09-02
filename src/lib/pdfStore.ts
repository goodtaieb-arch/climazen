/** CERFA PDF : Supabase Storage + fallback IndexedDB + destination société (cloud / privé). */

import { getSupabase, isSupabaseConfigured } from './supabase'
import {
  cheminRelatifDocument,
  resolveDocsStockageMode,
  resolveLienCloudDocs,
  resolveServeurPriveBase,
  uploadServeurPrive,
  type OperateurDocsStockage,
} from './docStockage'

const DB_NAME = 'climazen_cerfa'
const STORE = 'pdfs'
const DB_VERSION = 1
const BUCKET = 'cerfa'

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'id' })
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

function storagePath(organizationId: string, interventionId: string) {
  return `${organizationId}/${interventionId}.pdf`
}

async function saveLocal(interventionId: string, blob: Blob, fileName: string): Promise<void> {
  const db = await openDb()
  const buf = await blob.arrayBuffer()
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite')
    tx.objectStore(STORE).put({
      id: interventionId,
      fileName,
      mime: 'application/pdf',
      data: buf,
      savedAt: new Date().toISOString(),
    })
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
  db.close()
}

async function loadLocal(
  interventionId: string,
): Promise<{ blob: Blob; fileName: string; savedAt: string } | null> {
  const db = await openDb()
  const row = await new Promise<{
    id: string
    fileName: string
    mime: string
    data: ArrayBuffer
    savedAt: string
  } | undefined>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly')
    const req = tx.objectStore(STORE).get(interventionId)
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
  db.close()
  if (!row?.data) return null
  return {
    blob: new Blob([row.data], { type: row.mime || 'application/pdf' }),
    fileName: row.fileName,
    savedAt: row.savedAt,
  }
}

async function deleteLocal(interventionId: string): Promise<void> {
  const db = await openDb()
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite')
    tx.objectStore(STORE).delete(interventionId)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
  db.close()
}

export async function saveCerfaPdf(
  interventionId: string,
  blob: Blob,
  fileName: string,
  organizationId?: string | null,
  opts?: {
    operateur?: OperateurDocsStockage | null
    clientNom?: string
  },
): Promise<void> {
  await saveLocal(interventionId, blob, fileName)
  if (organizationId && isSupabaseConfigured()) {
    try {
      const sb = getSupabase()
      const path = storagePath(organizationId, interventionId)
      const { error } = await sb.storage.from(BUCKET).upload(path, blob, {
        contentType: 'application/pdf',
        upsert: true,
      })
      if (error) console.error('ClimaZEN: upload CERFA', error.message)
      // Copie arborescence Documents (même bucket, sous-dossier documents/)
      const rel = cheminRelatifDocument({
        kind: 'cerfa',
        fileName,
        clientNom: opts?.clientNom,
      })
      const { error: err2 } = await sb.storage
        .from(BUCKET)
        .upload(`${organizationId}/documents/${rel}`, blob, {
          contentType: 'application/pdf',
          upsert: true,
        })
      if (err2) console.error('ClimaZEN: upload CERFA documents/', err2.message)
    } catch (err) {
      console.error('ClimaZEN: upload CERFA', err)
    }
  }

  const op = opts?.operateur
  if (!op) return
  const mode = resolveDocsStockageMode(op)
  const relPath = cheminRelatifDocument({
    kind: 'cerfa',
    fileName,
    clientNom: opts?.clientNom,
  })
  if (mode === 'prive') {
    const base = resolveServeurPriveBase(op)
    if (base) {
      const up = await uploadServeurPrive({
        baseUrl: base,
        relPath,
        blob,
        token: op.serveurPriveDocsToken,
      })
      if (!up.ok) console.warn('ClimaZEN: CERFA serveur privé', up.message)
    }
  } else if (mode === 'cloud') {
    const href = resolveLienCloudDocs(op)
    if (href) {
      try {
        window.open(href, '_blank', 'noopener,noreferrer')
      } catch {
        // ignore
      }
    }
  }
}

export async function loadCerfaPdf(
  interventionId: string,
  organizationId?: string | null,
): Promise<{ blob: Blob; fileName: string; savedAt: string } | null> {
  if (organizationId && isSupabaseConfigured()) {
    try {
      const sb = getSupabase()
      const path = storagePath(organizationId, interventionId)
      const { data, error } = await sb.storage.from(BUCKET).download(path)
      if (!error && data) {
        return {
          blob: data,
          fileName: `${interventionId}.pdf`,
          savedAt: new Date().toISOString(),
        }
      }
    } catch {
      // fallback local
    }
  }
  return loadLocal(interventionId)
}

export async function deleteCerfaPdf(
  interventionId: string,
  organizationId?: string | null,
): Promise<void> {
  await deleteLocal(interventionId)
  if (!organizationId || !isSupabaseConfigured()) return
  try {
    const sb = getSupabase()
    await sb.storage.from(BUCKET).remove([storagePath(organizationId, interventionId)])
  } catch {
    // ignore
  }
}

export async function hasCerfaPdf(
  interventionId: string,
  organizationId?: string | null,
): Promise<boolean> {
  const pdf = await loadCerfaPdf(interventionId, organizationId)
  return !!pdf
}
