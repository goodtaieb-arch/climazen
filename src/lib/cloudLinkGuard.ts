/**
 * Garde-fous liens cloud RH : dossier EXACT de l’opérateur, jamais un lien public.
 * Heuristique locale + contrôle serveur (/api/check-cloud-link) sans cookies.
 */

import { normalizeLienCloudRh } from './rhDocuments'

export type CloudLinkVerdict =
  | 'invalid'
  | 'public'
  | 'needs_probe'
  | 'restricted_hint'

export type CloudKind = 'drive' | 'onedrive' | 'sharepoint' | 'unknown'

export function hostnameOf(url: string): string {
  try {
    return new URL(url).hostname.toLowerCase()
  } catch {
    return ''
  }
}

export function cloudKindFromHost(host: string): CloudKind {
  const h = (host || '').toLowerCase()
  if (h === 'drive.google.com' || h === 'docs.google.com') return 'drive'
  if (h === 'onedrive.live.com' || h === '1drv.ms') return 'onedrive'
  if (h.endsWith('.sharepoint.com') || h === 'sharepoint.com') return 'sharepoint'
  return 'unknown'
}

export function cloudKindFromUrl(raw?: string): CloudKind {
  const href = normalizeLienCloudRh(raw)
  if (!href) return 'unknown'
  return cloudKindFromHost(hostnameOf(href))
}

export function cloudLabel(kind: CloudKind): string {
  if (kind === 'drive') return 'Google Drive'
  if (kind === 'onedrive') return 'OneDrive'
  if (kind === 'sharepoint') return 'SharePoint'
  return 'cloud'
}

/** Consigne affichée sous le champ, selon le cloud collé. */
export function cloudPasteHint(raw?: string): string {
  const kind = cloudKindFromUrl(raw)
  if (kind === 'drive') {
    return 'Google Drive détecté. Partager → Restreint (pas « Toute personne disposant du lien ») → uniquement les e-mails autorisés. Drive demandera le compte Google.'
  }
  if (kind === 'onedrive') {
    return 'OneDrive détecté. Partager → Personnes spécifiques (pas « Quiconque dispose du lien ») → compte Microsoft.'
  }
  if (kind === 'sharepoint') {
    return 'SharePoint détecté. Partager → Personnes de l’organisation / personnes précises (pas « Tout le monde ») → compte Microsoft 365.'
  }
  const s = (raw || '').trim()
  if (!s) {
    return 'Collez le lien exact : Google Drive, OneDrive ou SharePoint. Le partage doit être privé (compte + mot de passe).'
  }
  return 'Cloud non reconnu. Uniquement Google Drive, OneDrive ou SharePoint, en partage privé.'
}

export function cloudAlertMessage(
  kind: CloudKind,
  error: 'public' | 'unverifiable' | 'invalid' | 'ok' | 'missing',
): string {
  const name = cloudLabel(kind)
  if (error === 'missing') {
    return 'Pas de lien exact pour cet opérateur. Collez son dossier Google Drive, OneDrive ou SharePoint (Équipe → sous son nom).'
  }
  if (error === 'invalid') {
    if (kind === 'unknown') {
      return 'Lien invalide. Collez le lien https exact du dossier de CET opérateur (Google Drive, OneDrive ou SharePoint).'
    }
    return `${name} : lien invalide. Collez le lien https exact du dossier de CET opérateur.`
  }
  if (error === 'public') {
    if (kind === 'drive') {
      return 'Google Drive : ce dossier est public (« Toute personne disposant du lien »). Action arrêtée.\n\nDans Drive : Partager → Restreint → ajoutez seulement les e-mails autorisés. Ensuite Drive demandera le compte Google (identifiant + mot de passe).'
    }
    if (kind === 'onedrive') {
      return 'OneDrive : ce dossier est public (« Quiconque dispose du lien » ou raccourci 1drv.ms). Action arrêtée.\n\nDans OneDrive : Partager → Personnes spécifiques (pas Quiconque) → compte Microsoft.'
    }
    if (kind === 'sharepoint') {
      return 'SharePoint : ce lien est ouvert aux invités / tout le monde. Action arrêtée.\n\nDans SharePoint : Partager → Personnes de l’organisation ou personnes précises, pas « Tout le monde ». Compte Microsoft 365 obligatoire.'
    }
    return 'Ce dossier est public (« toute personne avec le lien »). Action arrêtée. Passez le partage en privé (compte + mot de passe).'
  }
  if (error === 'unverifiable') {
    if (kind === 'drive') {
      return 'Google Drive : impossible de vérifier que le dossier n’est pas public. Action arrêtée.\n\nRefaites un lien Restreint (Partager → Restreint), pas « Toute personne disposant du lien ».'
    }
    if (kind === 'onedrive') {
      return 'OneDrive : impossible de vérifier que le dossier n’est pas public. Action arrêtée.\n\nRefaites un lien Personnes spécifiques, pas « Quiconque dispose du lien ».'
    }
    if (kind === 'sharepoint') {
      return 'SharePoint : impossible de vérifier que le dossier n’est pas public. Action arrêtée.\n\nRefaites un lien pour personnes précises / organisation, pas « Tout le monde ».'
    }
    return 'Impossible de vérifier que le dossier n’est pas public. Action arrêtée.'
  }
  if (kind === 'drive') return 'Google Drive privé — le compte Google sera demandé.'
  if (kind === 'onedrive') return 'OneDrive privé — le compte Microsoft sera demandé.'
  if (kind === 'sharepoint') return 'SharePoint privé — le compte Microsoft 365 sera demandé.'
  return 'Dossier privé — le cloud demandera le compte.'
}

export function isAllowedCloudHost(host: string): boolean {
  return cloudKindFromHost(host) !== 'unknown'
}

/** Lien Google Drive / OneDrive / SharePoint « n’importe qui avec le lien ». */
export function classifyCloudLink(raw?: string): CloudLinkVerdict {
  const href = normalizeLienCloudRh(raw)
  if (!href) return 'invalid'
  let u: URL
  try {
    u = new URL(href)
  } catch {
    return 'invalid'
  }
  const host = u.hostname.toLowerCase()
  if (!isAllowedCloudHost(host)) return 'invalid'

  const path = u.pathname
  const q = u.search.toLowerCase()
  const full = href.toLowerCase()

  // Raccourcis OneDrive = presque toujours un lien anonyme
  if (host === '1drv.ms') return 'public'
  if (/guestaccesstoken|nauth=1|anonymous=true/.test(q)) return 'public'
  if (full.includes('uc?export=download') || full.includes('/uc?id=')) return 'public'

  // SharePoint / OneDrive : :g: = invité / « anyone »
  if (/\/:[a-z]:\/g\//i.test(path)) return 'public'
  if (host.endsWith('.sharepoint.com') && (u.searchParams.has('e') || u.searchParams.has('share'))) {
    if (/\/:[a-z]:\/g\//i.test(path) || /\/:[a-z]:\/s\//i.test(path)) return 'public'
  }

  // SharePoint authentifié (org) : :r: ou bibliothèque /sites/
  if (host.endsWith('.sharepoint.com') && (/\/:[a-z]:\/r\//i.test(path) || path.includes('/sites/'))) {
    return 'restricted_hint'
  }

  return 'needs_probe'
}

export function extractGoogleDriveId(href: string): string | undefined {
  try {
    const u = new URL(href)
    const fromQuery = u.searchParams.get('id')
    if (fromQuery && /^[\w-]{10,}$/.test(fromQuery)) return fromQuery
    const folder = u.pathname.match(/\/folders\/([\w-]{10,})/)
    if (folder?.[1]) return folder[1]
    const file = u.pathname.match(/\/file\/d\/([\w-]{10,})/)
    if (file?.[1]) return file[1]
    const open = u.pathname.match(/\/open\/([\w-]{10,})/)
    if (open?.[1]) return open[1]
  } catch {
    return undefined
  }
  return undefined
}

export type CloudLinkCheckResult = {
  ok: boolean
  /** true = dossier privé, Drive demandera le compte */
  restricted?: boolean
  error?: 'invalid' | 'public' | 'unverifiable'
  message: string
}

export function localCloudLinkCheck(raw?: string): CloudLinkCheckResult | null {
  const kind = cloudKindFromUrl(raw)
  const verdict = classifyCloudLink(raw)
  if (verdict === 'invalid') {
    return {
      ok: false,
      error: 'invalid',
      message: cloudAlertMessage(kind, 'invalid'),
    }
  }
  if (verdict === 'public') {
    return { ok: false, error: 'public', message: cloudAlertMessage(kind, 'public') }
  }
  return null
}

/** Contrôle serveur : ouvre seulement si le stockage n’est pas public. */
export async function verifyCloudLinkRestricted(raw?: string): Promise<CloudLinkCheckResult> {
  const kind = cloudKindFromUrl(raw)
  const local = localCloudLinkCheck(raw)
  if (local) return local
  const href = normalizeLienCloudRh(raw)
  if (!href) {
    return { ok: false, error: 'invalid', message: cloudAlertMessage('unknown', 'missing') }
  }
  try {
    const res = await fetch('/api/check-cloud-link', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: href }),
    })
    if (!res.ok) {
      return { ok: false, error: 'unverifiable', message: cloudAlertMessage(kind, 'unverifiable') }
    }
    const data = (await res.json()) as {
      ok?: boolean
      restricted?: boolean
      error?: CloudLinkCheckResult['error']
      message?: string
      cloud?: CloudKind
    }
    const usedKind = data.cloud || kind
    if (data.ok && data.restricted) {
      return { ok: true, restricted: true, message: cloudAlertMessage(usedKind, 'ok') }
    }
    if (data.error === 'public') {
      return { ok: false, error: 'public', message: cloudAlertMessage(usedKind, 'public') }
    }
    if (data.error === 'invalid') {
      return {
        ok: false,
        error: 'invalid',
        message: cloudAlertMessage(usedKind, 'invalid'),
      }
    }
    return { ok: false, error: 'unverifiable', message: cloudAlertMessage(usedKind, 'unverifiable') }
  } catch {
    return { ok: false, error: 'unverifiable', message: cloudAlertMessage(kind, 'unverifiable') }
  }
}

/** Envoie vers le lien exact, ou stoppe si public / non vérifiable. */
export async function openExactOperatorCloudLink(raw?: string): Promise<CloudLinkCheckResult> {
  const href = normalizeLienCloudRh(raw)
  if (!href) {
    return {
      ok: false,
      error: 'invalid',
      message: cloudAlertMessage('unknown', 'missing'),
    }
  }
  const check = await verifyCloudLinkRestricted(href)
  if (!check.ok) return check
  window.open(href, '_blank', 'noopener,noreferrer')
  return check
}
