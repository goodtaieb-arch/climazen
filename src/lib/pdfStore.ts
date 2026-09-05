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
}

export function pdfCtxFromData(
  data: { operateur?: OperateurDocsStockage | null; documentsArchives?: DocumentArchive[] },
  extra?: { clientNom?: string; kind?: DocKind },
): PdfStoreCtx {
  return {
    operateur: data.operateur,
    archives: data.documentsArchives,
    clientNom: extra?.clientNom,
    kind: extra?.kind,
  }
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
  })
  const put = await putDocumentExterne({
    operateur: opts?.operateur,
    relPath,
    blob,
  })
  if (put.ok && opts?.onArchived) {
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
  const relPath =
    hit?.relPath ||
    (opts?.clientNom
      ? cheminRelatifDocument({
          kind: kind || 'cerfa',
          fileName: `${interventionId}.pdf`,
          clientNom: opts.clientNom,
        })
      : '')
  if (relPath) {
    const got = await getDocumentExterne({
      operateur: opts?.operateur,
      relPath,
    })
    if (got.ok) {
      return {
        blob: got.blob,
        fileName: hit?.fileName || `${interventionId}.pdf`,
        savedAt: hit?.archivedAt || hit?.createdAt || new Date().toISOString(),
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

