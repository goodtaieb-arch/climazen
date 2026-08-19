import { useEffect, useState } from 'react'
import { APP_BUILD, APP_VERSION } from '../lib/buildStamp'

const BOOT_KEY = 'climazen_boot_v'
const RELOAD_KEY = 'climazen_reloading'

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

/**
 * Purge cache PWA + SW puis recharge vers la version **serveur**.
 * Important : ne pas utiliser seulement APP_VERSION (souvent l’ancien bundle).
 */
export async function forceLatestAppVersion(knownTarget?: string) {
  let target = (knownTarget || '').trim()
  if (!target) {
    target = (await fetchServerVersion()) || APP_VERSION
  }

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
          await r.unregister()
        }),
      )
    }
    if ('caches' in window) {
      const keys = await caches.keys()
      await Promise.all(keys.map((k) => caches.delete(k)))
    }
  } catch {
    /* ignore */
  }

  try {
    localStorage.setItem(BOOT_KEY, target)
    sessionStorage.setItem(RELOAD_KEY, '1')
  } catch {
    /* ignore */
  }

  // Recharge « dure » : même page avec bust de version serveur
  const url = new URL(window.location.href)
  url.searchParams.set('v', target)
  url.searchParams.set('_', String(Date.now()))
  // Petit délai pour laisser le unregister SW se propager
  await new Promise((r) => setTimeout(r, 120))
  window.location.replace(url.toString())
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
 * Bouton MAJ — affiche la version serveur manquante (ex. « MAJ v75 »).
 */
export function MajButton({ className = '' }: { className?: string }) {
  const [server, setServer] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let cancelled = false
    const check = async () => {
      const v = await fetchServerVersion()
      if (!cancelled) setServer(v)
    }
    void check()
    const onFocus = () => void check()
    window.addEventListener('focus', onFocus)
    window.addEventListener('online', check)
    const t = window.setInterval(() => void check(), 12_000)
    return () => {
      cancelled = true
      window.removeEventListener('focus', onFocus)
      window.removeEventListener('online', check)
      window.clearInterval(t)
    }
  }, [])

  const needsUpdate = Boolean(server && server !== APP_VERSION)
  const label = busy
    ? 'MAJ…'
    : needsUpdate
      ? `MAJ ${server}`
      : 'MAJ'

  return (
    <button
      type="button"
      disabled={busy}
      onClick={() => {
        setBusy(true)
        void forceLatestAppVersion(server || undefined).finally(() => setBusy(false))
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

/** Bandeau forcé sur login / pages publiques si besoin de MAJ. */
export function VersionUpdateBar({ dark = false }: { dark?: boolean }) {
  const [server, setServer] = useState<string | null>(null)

  useEffect(() => {
    void fetchServerVersion().then(setServer)
  }, [])

  const needsUpdate = Boolean(server && server !== APP_VERSION)

  return (
    <div
      className={
        dark
          ? 'flex flex-wrap items-center justify-between gap-2 rounded-xl border border-white/20 bg-white/10 px-3 py-2 text-sm text-white'
          : 'flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[#0f766e]/30 bg-[#0f766e]/10 px-3 py-2 text-sm text-ink'
      }
    >
      <p className="font-semibold">
        Version <span className="font-extrabold">{APP_VERSION}</span>
        {needsUpdate ? (
          <span className={dark ? 'opacity-90' : 'text-amber-900'}>
            {' '}
            — nouvelle version <span className="font-extrabold">{server}</span> disponible
          </span>
        ) : (
          <span className={dark ? 'opacity-80' : 'text-muted'}>
            {' '}
            — à jour
            {server ? ` (${server})` : ''}
          </span>
        )}
      </p>
      <MajButton
        className={
          dark
            ? needsUpdate
              ? 'rounded-lg bg-amber-300 px-3 py-1.5 text-xs font-extrabold uppercase text-amber-950 animate-pulse'
              : 'rounded-lg bg-amber-400 px-3 py-1.5 text-xs font-extrabold uppercase text-amber-950'
            : undefined
        }
      />
    </div>
  )
}
