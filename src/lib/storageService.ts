/**
 * Facade client StorageService — JWT uniquement, jamais d’URL NAS ni de jeton.
 */

import { getSupabase, isSupabaseConfigured } from './supabase'
import type { CoffreDestId } from './docStockage'

async function authHeaders(): Promise<Record<string, string>> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (!isSupabaseConfigured()) return headers
  try {
    const sb = getSupabase()
    const { data } = await sb.auth.getSession()
    const token = data.session?.access_token
    if (token) headers.Authorization = `Bearer ${token}`
  } catch {
    /* hors ligne */
  }
  return headers
}

export async function hasCoffreSession(): Promise<boolean> {
  const h = await authHeaders()
  return Boolean(h.Authorization)
}

export type StoragePutResult = {
  ok: boolean
  queued?: boolean
  nasOk?: boolean
  cloudOk?: boolean
  confirmed?: boolean
  failedDests?: CoffreDestId[]
  okDests?: CoffreDestId[]
  message: string
}

async function parseJson(res: Response): Promise<Record<string, unknown>> {
  return (await res.json().catch(() => ({}))) as Record<string, unknown>
}

export async function storageServicePut(opts: {
  relPath: string
  blob: Blob
  dests?: CoffreDestId[]
}): Promise<StoragePutResult> {
  const headers = await authHeaders()
  if (!headers.Authorization) {
    return {
      ok: false,
      queued: true,
      message: 'Hors ligne — document en file d’attente locale.',
      failedDests: opts.dests || ['nas', 'cloud'],
    }
  }
  const contentBase64 = await blobToBase64(opts.blob)
  const res = await fetch('/api/documents', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      action: 'put',
      relPath: opts.relPath,
      contentBase64,
      contentType: opts.blob.type || 'application/pdf',
      dests: opts.dests,
    }),
  })
  const data = await parseJson(res)
  const failedDests = Array.isArray(data.failedDests)
    ? (data.failedDests as CoffreDestId[])
    : undefined
  const okDests = Array.isArray(data.okDests) ? (data.okDests as CoffreDestId[]) : undefined
  const message = String(data.message || data.error || (res.ok ? 'Archivé.' : `Archive HTTP ${res.status}`))
  return {
    ok: Boolean(data.ok),
    queued: Boolean(data.queued) || !data.ok,
    nasOk: Boolean(data.nasOk),
    cloudOk: Boolean(data.cloudOk),
    confirmed: Boolean(data.confirmed),
    failedDests,
    okDests,
    message,
  }
}

export async function storageServiceGet(relPath: string): Promise<
  { ok: true; blob: Blob } | { ok: false; message: string }
> {
  const headers = await authHeaders()
  if (!headers.Authorization) {
    return { ok: false, message: 'Session requise pour ouvrir le document.' }
  }
  const res = await fetch('/api/documents', {
    method: 'POST',
    headers,
    body: JSON.stringify({ action: 'get', relPath }),
  })
  const data = await parseJson(res)
  const b64 = typeof data.contentBase64 === 'string' ? data.contentBase64 : ''
  if (!res.ok || !data.ok || !b64) {
    return { ok: false, message: String(data.message || data.error || 'Document introuvable.') }
  }
  return {
    ok: true,
    blob: base64ToBlob(b64, String(data.contentType || 'application/pdf')),
  }
}

export async function storageServiceDownloadById(
  archiveId: string,
): Promise<{ ok: true; blob: Blob; fileName?: string } | { ok: false; message: string }> {
  const headers = await authHeaders()
  if (!headers.Authorization) {
    return { ok: false, message: 'Session requise pour ouvrir le document.' }
  }
  const res = await fetch(`/api/documents/download/${encodeURIComponent(archiveId)}`, {
    headers: { Authorization: headers.Authorization },
  })
  if (!res.ok) {
    const data = await parseJson(res)
    return { ok: false, message: String(data.message || data.error || `HTTP ${res.status}`) }
  }
  const blob = await res.blob()
  const cd = res.headers.get('content-disposition') || ''
  const m = /filename="([^"]+)"/.exec(cd)
  return { ok: true, blob, fileName: m?.[1] }
}

export async function storageServiceBackupExcel(): Promise<{ ok: boolean; message: string }> {
  const headers = await authHeaders()
  if (!headers.Authorization) {
    return { ok: false, message: 'Session requise pour la copie Excel.' }
  }
  const res = await fetch('/api/documents', {
    method: 'POST',
    headers,
    body: JSON.stringify({ action: 'backup-excel' }),
  })
  const data = await parseJson(res)
  return {
    ok: Boolean(data.ok),
    message: String(data.message || data.error || (res.ok ? 'Copie Excel envoyée.' : 'Copie Excel impossible.')),
  }
}

export async function fetchCoffreConfig(): Promise<{
  ok: boolean
  owner?: boolean
  config?: Record<string, unknown>
  public?: { coffreActif?: boolean; docsDestNas?: boolean; docsDestCloud?: boolean; cloudProvider?: string }
  error?: string
}> {
  const headers = await authHeaders()
  if (!headers.Authorization) return { ok: false, error: 'Session requise.' }
  const res = await fetch('/api/documents', {
    method: 'POST',
    headers,
    body: JSON.stringify({ action: 'config' }),
  })
  const data = await parseJson(res)
  if (!res.ok || !data.ok) {
    return { ok: false, error: String(data.error || data.message || 'Config coffre impossible.') }
  }
  return {
    ok: true,
    owner: Boolean(data.owner),
    config: (data.config as Record<string, unknown>) || undefined,
    public: data.public as {
      coffreActif?: boolean
      docsDestNas?: boolean
      docsDestCloud?: boolean
      cloudProvider?: string
    },
  }
}

export async function fetchCloudOAuthStatus(): Promise<{
  ok: boolean
  gdrive?: { ready?: boolean; platform?: boolean; connected?: boolean; email?: string | null }
  onedrive?: { ready?: boolean; platform?: boolean; connected?: boolean; email?: string | null }
  error?: string
}> {
  const headers = await authHeaders()
  if (!headers.Authorization) return { ok: false, error: 'Session requise.' }
  const res = await fetch('/api/oauth/cloud', { headers: { Authorization: headers.Authorization } })
  const data = await parseJson(res)
  if (!res.ok || !data.ok) {
    return { ok: false, error: String(data.error || data.message || 'Statut OAuth impossible.') }
  }
  return {
    ok: true,
    gdrive: data.gdrive as {
      ready?: boolean
      platform?: boolean
      connected?: boolean
      email?: string | null
    },
    onedrive: data.onedrive as {
      ready?: boolean
      platform?: boolean
      connected?: boolean
      email?: string | null
    },
  }
}

export async function startCloudOAuth(
  provider: 'gdrive' | 'onedrive',
): Promise<{ ok: boolean; url?: string; error?: string }> {
  const headers = await authHeaders()
  if (!headers.Authorization) return { ok: false, error: 'Session requise.' }
  const res = await fetch('/api/oauth/cloud', {
    method: 'POST',
    headers,
    body: JSON.stringify({ provider }),
  })
  const data = await parseJson(res)
  if (!res.ok || !data.ok || typeof data.url !== 'string') {
    return { ok: false, error: String(data.error || data.message || 'Autorisation cloud impossible.') }
  }
  return { ok: true, url: data.url }
}

export async function saveCoffreConfig(config: Record<string, unknown>): Promise<{
  ok: boolean
  coffreActif?: boolean
  error?: string
  warning?: string
}> {
  const headers = await authHeaders()
  if (!headers.Authorization) return { ok: false, error: 'Session requise.' }
  const res = await fetch('/api/documents', {
    method: 'POST',
    headers,
    body: JSON.stringify({ action: 'save-config', config }),
  })
  const data = await parseJson(res)
  if (!res.ok || !data.ok) {
    return { ok: false, error: String(data.error || data.message || 'Enregistrement coffre impossible.') }
  }
  return {
    ok: true,
    coffreActif: Boolean(data.coffreActif),
    warning: typeof data.warning === 'string' ? data.warning : undefined,
  }
}

async function blobToBase64(blob: Blob): Promise<string> {
  const buf = await blob.arrayBuffer()
  const bytes = new Uint8Array(buf)
  let bin = ''
  const chunk = 0x8000
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode(...bytes.subarray(i, i + chunk))
  }
  return btoa(bin)
}

function base64ToBlob(b64: string, mime: string): Blob {
  const bin = atob(b64)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return new Blob([bytes], { type: mime || 'application/pdf' })
}
