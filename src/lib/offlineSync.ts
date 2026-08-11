/** Suivi des saisies hors ligne à synchroniser au retour du réseau. */

const pendingKey = (organizationId: string) => `climazen_pending_sync_${organizationId}`
const lastSyncKey = (organizationId: string) => `climazen_last_sync_${organizationId}`
const sessionCacheKey = 'climazen_offline_session'

export type OfflineSessionCache = {
  user: unknown
  organization: unknown
  cachedAt: string
}

export function isBrowserOnline(): boolean {
  return typeof navigator === 'undefined' ? true : navigator.onLine
}

export function getPendingSync(organizationId: string | null | undefined): boolean {
  if (!organizationId) return false
  try {
    return localStorage.getItem(pendingKey(organizationId)) === '1'
  } catch {
    return false
  }
}

export function setPendingSync(organizationId: string | null | undefined, pending: boolean) {
  if (!organizationId) return
  try {
    if (pending) localStorage.setItem(pendingKey(organizationId), '1')
    else localStorage.removeItem(pendingKey(organizationId))
  } catch {
    /* ignore */
  }
}

export function markSynced(organizationId: string | null | undefined) {
  if (!organizationId) return
  try {
    setPendingSync(organizationId, false)
    localStorage.setItem(lastSyncKey(organizationId), new Date().toISOString())
  } catch {
    /* ignore */
  }
}

export function getLastSyncAt(organizationId: string | null | undefined): string | null {
  if (!organizationId) return null
  try {
    return localStorage.getItem(lastSyncKey(organizationId))
  } catch {
    return null
  }
}

export function saveOfflineSession(cache: OfflineSessionCache) {
  try {
    localStorage.setItem(sessionCacheKey, JSON.stringify(cache))
  } catch {
    /* ignore */
  }
}

export function loadOfflineSession(): OfflineSessionCache | null {
  try {
    const raw = localStorage.getItem(sessionCacheKey)
    if (!raw) return null
    return JSON.parse(raw) as OfflineSessionCache
  } catch {
    return null
  }
}

export function clearOfflineSession() {
  try {
    localStorage.removeItem(sessionCacheKey)
  } catch {
    /* ignore */
  }
}
