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
  lines.push(`      climazen-donnees.xlsx.enc`)
  lines.push(`    queue_backup/`)
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

export type CloudProviderId = 'webdav' | 'gdrive' | 'onedrive' | 's3'

export type OperateurDocsStockage = {
  docsStockageMode?: DocsStockageMode
  lienCloudDocsRacine?: string
  lienCloudRhRacine?: string
  serveurPriveDocsUrl?: string
  serveurPriveDocsToken?: string
  /** Envoi auto vers le NAS (défaut : oui si URL renseignée). */
  docsDestNas?: boolean
  /** Envoi auto vers le cloud (Drive / OneDrive / S3 / WebDAV). */
  docsDestCloud?: boolean
  cloudProvider?: CloudProviderId
  serveurCloudDocsUrl?: string
  serveurCloudDocsToken?: string
  coffreExcelMotDePasse?: string
  coffreActif?: boolean
  s3Bucket?: string
  s3Region?: string
  s3Prefix?: string
  s3Endpoint?: string
  s3AccessKey?: string
  s3SecretKey?: string
  gdriveClientId?: string
  gdriveClientSecret?: string
  gdriveRefreshToken?: string
  gdriveFolderId?: string
  graphTenantId?: string
  graphClientId?: string
  graphClientSecret?: string
  graphRefreshToken?: string
  graphDriveId?: string
  graphFolderPath?: string
}

export type CoffreDestId = 'nas' | 'cloud'

export function resolveHttpBase(raw?: string | null): string | undefined {
  const s = (raw || '').trim()
  if (!s) return undefined
  try {
    const u = new URL(s)
    if (u.protocol !== 'https:' && u.protocol !== 'http:') return undefined
    return s.replace(/\/+$/, '')
  } catch {
    return undefined
  }
}

export function resolveServeurPriveBase(op?: OperateurDocsStockage | null): string | undefined {
  return resolveHttpBase(op?.serveurPriveDocsUrl)
}

export function resolveServeurCloudBase(op?: OperateurDocsStockage | null): string | undefined {
  return resolveHttpBase(op?.serveurCloudDocsUrl)
}

export function coffreDestNasVoulue(op?: OperateurDocsStockage | null): boolean {
  return op?.docsDestNas !== false
}

export function coffreDestCloudVoulue(op?: OperateurDocsStockage | null): boolean {
  return op?.docsDestCloud === true
}

export function coffreDestinationsVoulues(op?: OperateurDocsStockage | null): CoffreDestId[] {
  const out: CoffreDestId[] = []
  if (coffreDestNasVoulue(op)) out.push('nas')
  if (coffreDestCloudVoulue(op)) out.push('cloud')
  if (out.length === 0 && resolveServeurPriveBase(op)) out.push('nas')
  return out
}

export function coffreDestConfig(op: OperateurDocsStockage | null | undefined, dest: CoffreDestId): {
  base?: string
  token?: string
} {
  if (dest === 'cloud') {
    return { base: resolveServeurCloudBase(op), token: op?.serveurCloudDocsToken }
  }
  return { base: resolveServeurPriveBase(op), token: op?.serveurPriveDocsToken }
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

export type SaveGeneratedDocResult = {
  mode: DocsStockageMode
  relPath: string
  supabaseOk: boolean
  priveOk?: boolean
  cloudOk?: boolean
  queued?: boolean
  message: string
  openedCloud?: boolean
}

/**
 * Enregistre un PDF hors site (NAS et/ou cloud miroir).
 * Si le coffre est down : file queue_backup, retry 15 min, l’utilisateur n’est pas bloqué.
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

  if (opts.alsoDownload) {
    downloadBlob(opts.blob, opts.fileName)
  }

  return {
    mode: 'prive',
    relPath,
    supabaseOk: false,
    priveOk: put.nasOk,
    cloudOk: put.cloudOk,
    queued: put.queued,
    message: put.message,
  }
}

export function createPdfPreviewUrl(blob: Blob): string {
  return URL.createObjectURL(blob)
}
