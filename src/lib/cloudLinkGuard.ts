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

const DRIVE_HOSTS = new Set(['drive.google.com', 'docs.google.com'])

export function hostnameOf(url: string): string {
  try {
    return new URL(url).hostname.toLowerCase()
  } catch {
    return ''
  }
}

export function isAllowedCloudHost(host: string): boolean {
  if (DRIVE_HOSTS.has(host)) return true
  if (host === 'onedrive.live.com' || host === '1drv.ms') return true
  if (host.endsWith('.sharepoint.com') || host === 'sharepoint.com') return true
  return false
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

const PUBLIC_MSG =
  'Ce dossier est public (« toute personne avec le lien »). Action arrêtée. Dans Drive / OneDrive : Partager → Restreint, puis uniquement les e-mails autorisés.'

const UNVERIFIABLE_MSG =
  'Impossible de vérifier que le dossier n’est pas public. Action arrêtée — collez un lien Restreint (identifiant + mot de passe Drive).'

export function localCloudLinkCheck(raw?: string): CloudLinkCheckResult | null {
  const verdict = classifyCloudLink(raw)
  if (verdict === 'invalid') {
    return {
      ok: false,
      error: 'invalid',
      message: 'Lien invalide. Collez le lien https exact du dossier de CET opérateur (Drive, OneDrive, SharePoint).',
    }
  }
  if (verdict === 'public') {
    return { ok: false, error: 'public', message: PUBLIC_MSG }
  }
  return null
}

/** Contrôle serveur : ouvre seulement si le stockage n’est pas public. */
export async function verifyCloudLinkRestricted(raw?: string): Promise<CloudLinkCheckResult> {
  const local = localCloudLinkCheck(raw)
  if (local) return local
  const href = normalizeLienCloudRh(raw)
  if (!href) {
    return { ok: false, error: 'invalid', message: 'Lien manquant.' }
  }
  try {
    const res = await fetch('/api/check-cloud-link', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: href }),
    })
    if (!res.ok) {
      return { ok: false, error: 'unverifiable', message: UNVERIFIABLE_MSG }
    }
    const data = (await res.json()) as {
      ok?: boolean
      restricted?: boolean
      error?: CloudLinkCheckResult['error']
      message?: string
    }
    if (data.ok && data.restricted) {
      return { ok: true, restricted: true, message: 'Dossier privé — Drive demandera le compte.' }
    }
    if (data.error === 'public') {
      return { ok: false, error: 'public', message: data.message || PUBLIC_MSG }
    }
    if (data.error === 'invalid') {
      return {
        ok: false,
        error: 'invalid',
        message: data.message || 'Lien invalide.',
      }
    }
    return { ok: false, error: 'unverifiable', message: data.message || UNVERIFIABLE_MSG }
  } catch {
    return { ok: false, error: 'unverifiable', message: UNVERIFIABLE_MSG }
  }
}

/** Envoie vers le lien exact, ou stoppe si public / non vérifiable. */
export async function openExactOperatorCloudLink(raw?: string): Promise<CloudLinkCheckResult> {
  const href = normalizeLienCloudRh(raw)
  if (!href) {
    return {
      ok: false,
      error: 'invalid',
      message:
        'Pas de lien exact pour cet opérateur. Collez le dossier Drive / OneDrive de CE technicien (Équipe → sous son nom).',
    }
  }
  const check = await verifyCloudLinkRestricted(href)
  if (!check.ok) return check
  window.open(href, '_blank', 'noopener,noreferrer')
  return check
}
