/**
 * Enregistrement des documents générés : cloud (Drive/OneDrive/SharePoint),
 * serveur privé société, ou téléchargement local.
 * Arborescence type : ClimaZEN / Documents / {année} / {type} / {client?} / fichier.pdf
 */

import { downloadBlob } from './cerfaPdf'
import { normalizeLienCloudRh } from './rhDocuments'

export type DocsStockageMode = 'cloud' | 'prive' | 'telechargement'

export type DocKind =
  | 'devis'
  | 'commande'
  | 'cerfa'
  | 'fiche'
  | 'rapport'
  | 'bon'
  | 'autre'

export const CLOUD_DOCS_ROOT = 'ClimaZEN'
export const CLOUD_DOCS_FOLDER = 'Documents'

export const DOC_KIND_FOLDER: Record<DocKind, string> = {
  devis: 'Devis',
  commande: 'Commandes',
  cerfa: 'CERFA',
  fiche: 'Fiches',
  rapport: 'Rapports',
  bon: 'Bons',
  autre: 'Autres',
}

/** Dossiers à créer une fois dans le cloud / sur le serveur privé. */
export function arborescenceDocumentsEntreprise(year = new Date().getFullYear()): string[] {
  const kinds = Object.values(DOC_KIND_FOLDER)
  const lines = [
    `${CLOUD_DOCS_ROOT}/`,
    `  ${CLOUD_DOCS_FOLDER}/`,
    `    ${year}/`,
  ]
  for (const k of kinds) {
    lines.push(`      ${k}/`)
  }
  lines.push(`    Clients/`)
  lines.push(`      {Nom client}/`)
  for (const k of kinds) {
    lines.push(`        ${k}/`)
  }
  return lines
}

export function slugSegment(raw?: string): string {
  const s = (raw || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 48)
  return s || 'Sans-nom'
}

export function cheminRelatifDocument(opts: {
  kind: DocKind
  fileName: string
  year?: number
  clientNom?: string
}): string {
  const year = opts.year ?? new Date().getFullYear()
  const folder = DOC_KIND_FOLDER[opts.kind] || DOC_KIND_FOLDER.autre
  const file = opts.fileName.replace(/^\/+/, '')
  if (opts.clientNom?.trim()) {
    return [
      CLOUD_DOCS_ROOT,
      CLOUD_DOCS_FOLDER,
      'Clients',
      slugSegment(opts.clientNom),
      folder,
      file,
    ].join('/')
  }
  return [CLOUD_DOCS_ROOT, CLOUD_DOCS_FOLDER, String(year), folder, file].join('/')
}

export type OperateurDocsStockage = {
  docsStockageMode?: DocsStockageMode
  lienCloudDocsRacine?: string
  /** Repli : dossier cloud RH si docs non renseigné */
  lienCloudRhRacine?: string
  serveurPriveDocsUrl?: string
  /** Jeton optionnel (Bearer) pour PUT WebDAV / API NAS */
  serveurPriveDocsToken?: string
}

export function resolveDocsStockageMode(op?: OperateurDocsStockage | null): DocsStockageMode {
  const m = op?.docsStockageMode
  if (m === 'cloud' || m === 'prive' || m === 'telechargement') return m
  if ((op?.serveurPriveDocsUrl || '').trim()) return 'prive'
  if ((op?.lienCloudDocsRacine || op?.lienCloudRhRacine || '').trim()) return 'cloud'
  return 'telechargement'
}

export function resolveLienCloudDocs(op?: OperateurDocsStockage | null): string | undefined {
  return (
    normalizeLienCloudRh(op?.lienCloudDocsRacine) ||
    normalizeLienCloudRh(op?.lienCloudRhRacine) ||
    undefined
  )
}

export function resolveServeurPriveBase(op?: OperateurDocsStockage | null): string | undefined {
  const raw = (op?.serveurPriveDocsUrl || '').trim()
  if (!raw) return undefined
  try {
    const u = new URL(raw)
    if (u.protocol !== 'https:' && u.protocol !== 'http:') return undefined
    return raw.replace(/\/+$/, '')
  } catch {
    return undefined
  }
}

const IDB_NAME = 'climazen_docs'
const IDB_STORE = 'pdfs'

function openDocsDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, 1)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(IDB_STORE)) {
        db.createObjectStore(IDB_STORE, { keyPath: 'id' })
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

async function saveDocLocal(id: string, blob: Blob, fileName: string, relPath: string) {
  const db = await openDocsDb()
  const buf = await blob.arrayBuffer()
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, 'readwrite')
    tx.objectStore(IDB_STORE).put({
      id,
      fileName,
      relPath,
      mime: 'application/pdf',
      data: buf,
      savedAt: new Date().toISOString(),
    })
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
  db.close()
}

async function uploadSupabaseDoc(
  organizationId: string,
  relPath: string,
  blob: Blob,
): Promise<boolean> {
  try {
    const { getSupabase, isSupabaseConfigured } = await import('./supabase')
    if (!isSupabaseConfigured()) return false
    const sb = getSupabase()
    const path = `${organizationId}/documents/${relPath}`
    const { error } = await sb.storage.from('cerfa').upload(path, blob, {
      contentType: 'application/pdf',
      upsert: true,
    })
    if (error) {
      console.error('ClimaZEN: upload doc supabase', error.message)
      return false
    }
    return true
  } catch (err) {
    console.error('ClimaZEN: upload doc supabase', err)
    return false
  }
}

/** PUT vers serveur privé (WebDAV / Nextcloud / partage HTTP). */
export async function uploadServeurPrive(opts: {
  baseUrl: string
  relPath: string
  blob: Blob
  token?: string
}): Promise<{ ok: boolean; message: string }> {
  const url = `${opts.baseUrl.replace(/\/+$/, '')}/${opts.relPath.split('/').map(encodeURIComponent).join('/')}`
  const headers: Record<string, string> = {
    'Content-Type': 'application/pdf',
  }
  const token = (opts.token || '').trim()
  if (token) headers.Authorization = token.startsWith('Bearer ') ? token : `Bearer ${token}`
  try {
    const res = await fetch(url, { method: 'PUT', headers, body: opts.blob })
    if (res.ok || res.status === 201 || res.status === 204) {
      return { ok: true, message: `Enregistré sur le serveur privé (${opts.relPath}).` }
    }
    return {
      ok: false,
      message: `Serveur privé HTTP ${res.status} — vérifiez l’URL, le CORS et le jeton. Chemin : ${opts.relPath}`,
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'erreur réseau'
    return {
      ok: false,
      message: `Serveur privé injoignable (${msg}). Téléchargement local proposé. Chemin : ${opts.relPath}`,
    }
  }
}

export type SaveGeneratedDocResult = {
  mode: DocsStockageMode
  relPath: string
  supabaseOk: boolean
  priveOk?: boolean
  message: string
  openedCloud?: boolean
}

/**
 * Enregistre un PDF généré selon la config société.
 * Toujours : IndexedDB + Supabase (si org) + action mode (cloud / privé / téléchargement).
 */
export async function saveGeneratedDocument(opts: {
  blob: Blob
  fileName: string
  kind: DocKind
  clientNom?: string
  year?: number
  docId: string
  organizationId?: string | null
  operateur?: OperateurDocsStockage | null
  /** Forcer un téléchargement même en mode cloud/privé (secours). */
  alsoDownload?: boolean
}): Promise<SaveGeneratedDocResult> {
  const mode = resolveDocsStockageMode(opts.operateur)
  const relPath = cheminRelatifDocument({
    kind: opts.kind,
    fileName: opts.fileName,
    year: opts.year,
    clientNom: opts.clientNom,
  })

  await saveDocLocal(opts.docId, opts.blob, opts.fileName, relPath)

  let supabaseOk = false
  if (opts.organizationId) {
    supabaseOk = await uploadSupabaseDoc(opts.organizationId, relPath, opts.blob)
  }

  if (mode === 'prive') {
    const base = resolveServeurPriveBase(opts.operateur)
    if (!base) {
      downloadBlob(opts.blob, opts.fileName)
      return {
        mode,
        relPath,
        supabaseOk,
        priveOk: false,
        message: `URL serveur privé manquante (Mon entreprise). PDF téléchargé. Placez-le dans : ${relPath}`,
      }
    }
    const up = await uploadServeurPrive({
      baseUrl: base,
      relPath,
      blob: opts.blob,
      token: opts.operateur?.serveurPriveDocsToken,
    })
    if (!up.ok || opts.alsoDownload) downloadBlob(opts.blob, opts.fileName)
    return {
      mode,
      relPath,
      supabaseOk,
      priveOk: up.ok,
      message: up.ok
        ? `${up.message}${supabaseOk ? ' · Copie cloud ClimaZEN OK.' : ''}`
        : up.message,
    }
  }

  if (mode === 'cloud') {
    const href = resolveLienCloudDocs(opts.operateur)
    let openedCloud = false
    if (href) {
      try {
        window.open(href, '_blank', 'noopener,noreferrer')
        openedCloud = true
      } catch {
        // ignore
      }
    }
    downloadBlob(opts.blob, opts.fileName)
    return {
      mode,
      relPath,
      supabaseOk,
      openedCloud,
      message: href
        ? `PDF téléchargé — rangez-le dans le cloud : ${relPath}${openedCloud ? ' (dossier ouvert).' : '.'}`
        : `PDF téléchargé. Configurez le lien cloud documents (Mon entreprise). Chemin : ${relPath}`,
    }
  }

  downloadBlob(opts.blob, opts.fileName)
  return {
    mode,
    relPath,
    supabaseOk,
    message: `PDF téléchargé${supabaseOk ? ' · copie serveur ClimaZEN OK' : ''}.`,
  }
}

export function createPdfPreviewUrl(blob: Blob): string {
  return URL.createObjectURL(blob)
}
