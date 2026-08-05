/** Stockage des PDF CERFA dans IndexedDB — reste dans l’app, pas dans Téléchargements. */

const DB_NAME = 'climazen_cerfa'
const STORE = 'pdfs'
const DB_VERSION = 1

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

export async function saveCerfaPdf(interventionId: string, blob: Blob, fileName: string): Promise<void> {
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

export async function loadCerfaPdf(
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

export async function deleteCerfaPdf(interventionId: string): Promise<void> {
  const db = await openDb()
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite')
    tx.objectStore(STORE).delete(interventionId)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
  db.close()
}

export async function hasCerfaPdf(interventionId: string): Promise<boolean> {
  const pdf = await loadCerfaPdf(interventionId)
  return !!pdf
}
