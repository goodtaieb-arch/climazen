import { useEffect, useState } from 'react'
import { APP_BUILD, APP_VERSION } from '../lib/buildStamp'

const BOOT_KEY = 'climazen_boot_v'
const RELOAD_KEY = 'climazen_reloading'

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T | null> {
  return new Promise((resolve) => {
    let done = false
    const t = window.setTimeout(() => {
      if (!done) {
        done = true
        resolve(null)
      }
    }, ms)
    promise
      .then((v) => {
        if (!done) {
          done = true
          window.clearTimeout(t)
          resolve(v)
        }
      })
      .catch(() => {
        if (!done) {
          done = true
          window.clearTimeout(t)
          resolve(null)
        }
      })
  })
}

/** Lit la version publiée sur le serveur (version.json), pas le JS en cache. */
export async function fetchServerVersion(): Promise<string | null> {
  try {
    const res = await fetch(`/version.json?t=${Date.now()}`, { cache: 'no-store' })
    if (!res.ok) return null
    const data = (await res.json()) as { version?: string }
    const v = (data.version || '').trim()
    return v || null
  } catch {
    return null
  }
}

/** Cache partagé — bandeau + bouton MAJ restent synchronisés. */
let cachedServerVersion: string | null = null
const serverVersionListeners = new Set<(v: string | null) => void>()

function publishServerVersion(v: string | null) {
  cachedServerVersion = v
  for (const l of serverVersionListeners) l(v)
}

async function refreshServerVersion(): Promise<string | null> {
  const v = await fetchServerVersion()
  publishServerVersion(v)
  return v
}

/** Version serveur + flag « mise à jour dispo » (partagé entre UI). */
export function useServerAppVersion() {
  const [server, setServer] = useState<string | null>(cachedServerVersion)

  useEffect(() => {
    const onUpdate = (v: string | null) => setServer(v)
    serverVersionListeners.add(onUpdate)
    void refreshServerVersion()
    const onFocus = () => void refreshServerVersion()
    window.addEventListener('focus', onFocus)
    window.addEventListener('online', onFocus)
    const t = window.setInterval(() => void refreshServerVersion(), 10_000)
    return () => {
      serverVersionListeners.delete(onUpdate)
      window.removeEventListener('focus', onFocus)
      window.removeEventListener('online', onFocus)
      window.clearInterval(t)
    }
  }, [])

  const needsUpdate = Boolean(server && server !== APP_VERSION)
  return { server, needsUpdate, local: APP_VERSION }
}

/** Purge SW + caches — ne doit jamais bloquer indéfiniment (mobile / iOS). */
async function purgeCachesAndServiceWorkers() {
  try {
    if ('serviceWorker' in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations()
      await Promise.all(
        regs.map(async (r) => {
          try {
            if (r.waiting) r.waiting.postMessage({ type: 'SKIP_WAITING' })
            if (r.active) r.active.postMessage({ type: 'SKIP_WAITING' })
          } catch {
            /* ignore */
          }
          try {
            await r.unregister()
          } catch {
            /* ignore */
          }
        }),
      )
    }
  } catch {
    /* ignore */
  }

  try {
    if ('caches' in window) {
      const keys = await caches.keys()
      await Promise.all(keys.map((k) => caches.delete(k)))
    }
  } catch {
    /* ignore */
  }
}

/**
 * Purge cache PWA + SW puis recharge vers la version **serveur**.
 * Important : ne jamais attendre la purge indéfiniment — sinon le bouton MAJ
 * reste sur « MAJ… » et rien ne se passe (vu sur mobile).
 */
export async function forceLatestAppVersion(knownTarget?: string) {
  let target = (knownTarget || '').trim()
  if (!target) {
    target =
      (await withTimeout(fetchServerVersion(), 2500)) || APP_VERSION
  }

  try {
    localStorage.setItem(BOOT_KEY, target)
    // Nouveau clic MAJ = nouvelle tentative (débloque le garde-fou index.html)
    sessionStorage.removeItem(RELOAD_KEY)
  } catch {
    /* ignore */
  }

  // Max ~700 ms de purge, puis navigation obligatoire
  await withTimeout(purgeCachesAndServiceWorkers(), 700)

  try {
    sessionStorage.setItem(RELOAD_KEY, '1')
  } catch {
    /* ignore */
  }

  const url = new URL(window.location.href)
  url.searchParams.set('v', target)
  url.searchParams.set('maj', '1')
  url.searchParams.set('_', String(Date.now()))

  // href (pas replace) : plus fiable sur certains navigateurs / PWA iOS
  window.location.href = url.toString()
}

/** Pastille version locale (ce qui tourne vraiment sur l’appareil). */
export function VersionBadge({ className = '' }: { className?: string }) {
  return (
    <span
      className={`inline-flex items-center rounded-full bg-ink px-2.5 py-1 text-[11px] font-extrabold tracking-wide text-white ${className}`}
      title={`Build : ${APP_BUILD}`}
    >
      {APP_VERSION}
    </span>
  )
}

/**
 * Bouton MAJ — affiche la version serveur manquante (ex. « MAJ v76 »).
 */
export function MajButton({ className = '' }: { className?: string }) {
  const { server, needsUpdate } = useServerAppVersion()
  const [busy, setBusy] = useState(false)

  const label = busy ? 'MAJ…' : needsUpdate ? `MAJ ${server}` : 'MAJ'

  return (
    <button
      type="button"
      disabled={busy}
      onClick={() => {
        setBusy(true)
        void forceLatestAppVersion(server || undefined).finally(() => {
          // Si la navigation n’a pas eu lieu (cas rare), on débloque le bouton
          window.setTimeout(() => setBusy(false), 1500)
        })
      }}
      className={
        className ||
        [
          'touch-target inline-flex items-center justify-center rounded-full border px-2.5 text-[11px] font-extrabold uppercase tracking-wide sm:px-3',
          needsUpdate
            ? 'animate-pulse border-amber-500 bg-amber-300 text-amber-950'
            : 'border-amber-400 bg-amber-100 text-amber-950 hover:bg-amber-200',
        ].join(' ')
      }
      aria-label={
        needsUpdate
          ? `Mettre à jour vers ${server} (vous êtes en ${APP_VERSION})`
          : 'Charger la dernière version'
      }
      title={
        needsUpdate
          ? `Nouvelle version disponible : ${server} (actuel ${APP_VERSION})`
          : 'Efface le cache et recharge la dernière version'
      }
    >
      {label}
    </button>
  )
}

/**
 * Bandeau version — visible **uniquement** s’il y a une mise à jour serveur.
 * Sinon rien (le badge + bouton MAJ du header restent disponibles).
 */
export function VersionUpdateBar({ dark = false }: { dark?: boolean }) {
  const { server, needsUpdate, local } = useServerAppVersion()

  if (!needsUpdate || !server) return null

  return (
    <div
      className={
        dark
          ? 'flex flex-wrap items-center justify-between gap-2 border-t border-white/15 bg-[#0f766e] px-3 py-2 text-sm text-white sm:px-6'
          : 'flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[#0f766e]/30 bg-[#0f766e]/10 px-3 py-2 text-sm text-ink'
      }
    >
      <p className="font-semibold">
        Version <span className="font-extrabold">{local}</span>
        <span className={dark ? 'text-amber-100' : 'text-amber-950'}>
          {' '}
          — mise à jour <span className="font-extrabold">{server}</span> disponible
        </span>
      </p>
      <MajButton
        className={
          dark
            ? 'rounded-lg bg-amber-300 px-3 py-1.5 text-xs font-extrabold uppercase text-amber-950 animate-pulse'
            : undefined
        }
      />
    </div>
  )
}
