/** CERFA / PDF : archive hors site (NAS). ClimaZEN ne conserve plus les fichiers. */

import {
  cheminRelatifDocument,
  type DocKind,
  type OperateurDocsStockage,
} from './docStockage'
import {
  findArchive,
  getDocumentExterne,
  putDocumentExterne,
  type DocumentArchive,
} from './documentArchive'

export type PdfStoreCtx = {
  operateur?: OperateurDocsStockage | null
  archives?: DocumentArchive[]
  clientNom?: string
  kind?: DocKind
  fileName?: string
  year?: number
}

type PdfDataSlice = {
  operateur?: OperateurDocsStockage | null
  documentsArchives?: DocumentArchive[]
  clients?: { id: string; raisonSociale?: string }[]
}

type PdfInterventionSlice = {
  clientId?: string
  cerfaPdfFileName?: string
  dateIntervention?: string
}

export function pdfCtxFromData(
  data: PdfDataSlice,
  extra?: {
    clientNom?: string
    kind?: DocKind
    fileName?: string
    year?: number
    clientId?: string
  },
): PdfStoreCtx {
  const fromClientId = extra?.clientId
    ? data.clients?.find((c) => c.id === extra.clientId)?.raisonSociale
    : undefined
  return {
    operateur: data.operateur,
    archives: data.documentsArchives,
    clientNom: extra?.clientNom || fromClientId,
    kind: extra?.kind,
    fileName: extra?.fileName,
    year: extra?.year,
  }
}

/** Contexte d’ouverture depuis une fiche (liste, pack, formulaire). */
export function pdfCtxForIntervention(
  data: PdfDataSlice,
  intervention: PdfInterventionSlice,
  extra?: { kind?: DocKind },
): PdfStoreCtx {
  const y = Number(String(intervention.dateIntervention || '').slice(0, 4))
  return pdfCtxFromData(data, {
    kind: extra?.kind || 'cerfa',
    clientId: intervention.clientId,
    fileName: intervention.cerfaPdfFileName,
    year: y >= 2000 && y <= 2100 ? y : undefined,
  })
}

/** Chemins possibles du PDF (avec / sans dossier client, année de l’intervention). */
export function cerfaRelPathCandidates(opts: {
  kind?: DocKind
  fileName?: string
  clientNom?: string
  year?: number
  archiveRelPath?: string
}): string[] {
  const kind = opts.kind || 'cerfa'
  const out: string[] = []
  const add = (p?: string) => {
    const v = String(p || '').trim()
    if (v && !out.includes(v)) out.push(v)
  }
  add(opts.archiveRelPath)
  const fileName = String(opts.fileName || '').replace(/^\/+/, '').trim()
  if (!fileName) return out
  if (opts.clientNom?.trim()) {
    add(
      cheminRelatifDocument({
        kind,
        fileName,
        clientNom: opts.clientNom,
        year: opts.year,
      }),
    )
  }
  add(cheminRelatifDocument({ kind, fileName, year: opts.year }))
  return out
}

export async function saveCerfaPdf(
  interventionId: string,
  blob: Blob,
  fileName: string,
  _organizationId?: string | null,
  opts?: PdfStoreCtx & { onArchived?: (meta: DocumentArchive) => void },
): Promise<{ ok: boolean; message: string; relPath?: string }> {
  const kind = opts?.kind || 'cerfa'
  const relPath = cheminRelatifDocument({
    kind,
    fileName,
    clientNom: opts?.clientNom,
    year: opts?.year,
  })
  if (opts?.onArchived) {
    opts.onArchived({
      id: crypto.randomUUID(),
      kind,
      fileName,
      relPath,
      interventionId,
      createdAt: new Date().toISOString(),
      archivedAt: new Date().toISOString(),
    })
  }
  const put = await putDocumentExterne({
    operateur: opts?.operateur,
    relPath,
    blob,
  })
  return { ...put, relPath }
}

export async function loadCerfaPdf(
  interventionId: string,
  _organizationId?: string | null,
  opts?: PdfStoreCtx,
): Promise<{ blob: Blob; fileName: string; savedAt: string } | null> {
  const kind = opts?.kind
  const hit = findArchive({
    archives: opts?.archives,
    interventionId,
    kind,
  })
  const fileName = hit?.fileName || opts?.fileName || ''
  const relPaths = cerfaRelPathCandidates({
    kind: kind || 'cerfa',
    fileName,
    clientNom: opts?.clientNom,
    year: opts?.year,
    archiveRelPath: hit?.relPath,
  })
  const savedAt = hit?.archivedAt || hit?.createdAt || new Date().toISOString()

  try {
    const { findQueuedDocument } = await import('./documentQueue')
    const queued = await findQueuedDocument({
      relPaths,
      fileName,
      needle: interventionId,
    })
    if (queued) {
      return {
        blob: queued.blob,
        fileName: queued.fileName || fileName || `${interventionId}.pdf`,
        savedAt,
      }
    }
  } catch {
    /* IndexedDB indisponible */
  }

  let archiveIdTried = false
  for (const relPath of relPaths) {
    const got = await getDocumentExterne({
      operateur: opts?.operateur,
      relPath,
      archiveId: !archiveIdTried ? hit?.id : undefined,
    })
    archiveIdTried = true
    if (got.ok) {
      return {
        blob: got.blob,
        fileName: fileName || `${interventionId}.pdf`,
        savedAt,
      }
    }
  }

  if (!relPaths.length && hit?.id) {
    const got = await getDocumentExterne({
      operateur: opts?.operateur,
      relPath: hit.relPath,
      archiveId: hit.id,
    })
    if (got.ok) {
      return {
        blob: got.blob,
        fileName: fileName || `${interventionId}.pdf`,
        savedAt,
      }
    }
  }

  return null
}

export async function deleteCerfaPdf(
  _interventionId: string,
  _organizationId?: string | null,
): Promise<void> {
  /* Les PDF ne sont plus sur ClimaZEN — rien à effacer ici. */
}

export async function hasCerfaPdf(
  interventionId: string,
  organizationId?: string | null,
  opts?: PdfStoreCtx,
): Promise<boolean> {
  const pdf = await loadCerfaPdf(interventionId, organizationId, opts)
  return !!pdf
}
