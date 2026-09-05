/**
 * Étanchéité coffre : URLs NAS/cloud + jetons hors du payload bureau.
 * Le gérant les voit via GET /api/documents (session owner).
 */

export const COFFRE_SECRET_KEYS = [
  'serveurPriveDocsUrl',
  'serveurPriveDocsToken',
  'serveurCloudDocsUrl',
  'serveurCloudDocsToken',
  'lienCloudDocsRacine',
  'coffreExcelMotDePasse',
  's3Bucket',
  's3Region',
  's3Prefix',
  's3Endpoint',
  's3AccessKey',
  's3SecretKey',
  'gdriveClientId',
  'gdriveClientSecret',
  'gdriveRefreshToken',
  'gdriveFolderId',
  'graphTenantId',
  'graphClientId',
  'graphClientSecret',
  'graphRefreshToken',
  'graphDriveId',
  'graphFolderPath',
] as const

export type CoffreSecretKey = (typeof COFFRE_SECRET_KEYS)[number]

export type CoffrePublicFlags = {
  docsDestNas?: boolean
  docsDestCloud?: boolean
  cloudProvider?: 'webdav' | 'gdrive' | 'onedrive' | 's3'
  coffreActif?: boolean
}

export function isCoffreSecretKey(key: string): key is CoffreSecretKey {
  return (COFFRE_SECRET_KEYS as readonly string[]).includes(key)
}

export function extractCoffreSecrets<T extends object>(op: T | null | undefined): Partial<T> {
  const out: Record<string, unknown> = {}
  if (!op) return out as Partial<T>
  const rec = op as Record<string, unknown>
  for (const k of COFFRE_SECRET_KEYS) {
    const v = rec[k]
    if (v == null || v === '') continue
    out[k] = v
  }
  return out as Partial<T>
}

export function stripCoffreSecrets<T extends object>(
  op: T | null | undefined,
  opts?: { coffreActif?: boolean },
): T {
  if (!op) return op as unknown as T
  const computed = computeCoffreActifFromPartial(op)
  const next = { ...op } as T & CoffrePublicFlags
  const rec = next as Record<string, unknown>
  for (const k of COFFRE_SECRET_KEYS) {
    delete rec[k]
  }
  const actif = opts?.coffreActif ?? (computed || Boolean((op as CoffrePublicFlags).coffreActif))
  next.coffreActif = Boolean(actif)
  return next
}

export function preserveCoffreSecrets<T extends object>(opts: {
  previous?: T | null
  incoming: T
}): T {
  const next = { ...opts.incoming } as T
  const prev = opts.previous as Record<string, unknown> | null | undefined
  if (!prev) return next
  const rec = next as Record<string, unknown>
  for (const k of COFFRE_SECRET_KEYS) {
    const incomingVal = rec[k]
    const empty =
      incomingVal == null || incomingVal === '' || (typeof incomingVal === 'string' && !incomingVal.trim())
    if (empty && prev[k] != null && prev[k] !== '') {
      rec[k] = prev[k]
    }
  }
  return next
}

export function computeCoffreActifFromPartial(op: object | null | undefined): boolean {
  if (!op) return false
  const rec = op as Record<string, unknown>
  const nas = rec.docsDestNas !== false && Boolean(String(rec.serveurPriveDocsUrl || '').trim())
  const provider = String(rec.cloudProvider || 'webdav')
  let cloud = false
  if (rec.docsDestCloud === true) {
    if (provider === 's3') {
      cloud = Boolean(rec.s3Bucket && rec.s3AccessKey && rec.s3SecretKey)
    } else if (provider === 'gdrive') {
      cloud = Boolean(rec.gdriveRefreshToken && rec.gdriveClientId && rec.gdriveClientSecret)
    } else if (provider === 'onedrive') {
      cloud = Boolean(rec.graphClientId && rec.graphClientSecret && (rec.graphRefreshToken || rec.graphDriveId))
    } else {
      cloud = Boolean(String(rec.serveurCloudDocsUrl || '').trim())
    }
  }
  return Boolean(nas || cloud || rec.coffreActif)
}
