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
  lines.push(`    Secours/`)
  lines.push(`      climazen-donnees.xlsx`)
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

export type SaveGeneratedDocResult = {
  mode: DocsStockageMode
  relPath: string
  supabaseOk: boolean
  priveOk?: boolean
  message: string
  openedCloud?: boolean
}

/**
 * Enregistre un PDF généré : uniquement hors site (NAS / serveur privé).
 * Pas d’IndexedDB, pas de bucket ClimaZEN — le bureau récupère le fichier via l’app.
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
  alsoDownload?: boolean
  devisId?: string
  commandeId?: string
  onArchived?: (meta: import('./documentArchive').DocumentArchive) => void
}): Promise<SaveGeneratedDocResult> {
  const relPath = cheminRelatifDocument({
    kind: opts.kind,
    fileName: opts.fileName,
    year: opts.year,
    clientNom: opts.clientNom,
  })

  const { putDocumentExterne } = await import('./documentArchive')
  const put = await putDocumentExterne({
    operateur: opts.operateur,
    relPath,
    blob: opts.blob,
  })

  if (put.ok && opts.onArchived) {
    opts.onArchived({
      id: crypto.randomUUID(),
      kind: opts.kind,
      fileName: opts.fileName,
      relPath,
      devisId: opts.devisId,
      commandeId: opts.commandeId,
      createdAt: new Date().toISOString(),
      archivedAt: new Date().toISOString(),
    })
  }

  if (opts.alsoDownload || !put.ok) {
    downloadBlob(opts.blob, opts.fileName)
  }

  return {
    mode: 'prive',
    relPath,
    supabaseOk: false,
    priveOk: put.ok,
    message: put.ok
      ? `Document archivé hors site (${relPath}). Ouvert depuis l’app, pas depuis le NAS.`
      : put.message,
  }
}

export function createPdfPreviewUrl(blob: Blob): string {
  return URL.createObjectURL(blob)
}
