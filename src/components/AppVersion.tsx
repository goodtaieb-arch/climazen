import { APP_BUILD, APP_VERSION } from '../lib/buildStamp'

/** Purge cache PWA + recharge (pour sortir d’une ancienne version). */
export async function forceLatestAppVersion() {
  try {
    if ('caches' in window) {
      const keys = await caches.keys()
      await Promise.all(keys.map((k) => caches.delete(k)))
    }
    const regs = (await navigator.serviceWorker?.getRegistrations?.()) || []
    await Promise.all(regs.map((r) => r.unregister()))
  } catch {
    /* ignore */
  }
  const url = new URL(window.location.href)
  url.searchParams.set('v', APP_VERSION)
  url.searchParams.set('_', String(Date.now()))
  window.location.replace(url.toString())
}

/** Pastille version — visible même hors connexion app. */
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

/** Bandeau forcé sur login / pages publiques si besoin de MAJ. */
export function VersionUpdateBar({ dark = false }: { dark?: boolean }) {
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
        <span className={dark ? 'opacity-80' : 'text-muted'}>
          {' '}
          — si ce n’est pas {APP_VERSION}, cliquez MAJ
        </span>
      </p>
      <button
        type="button"
        onClick={() => void forceLatestAppVersion()}
        className={
          dark
            ? 'rounded-lg bg-amber-400 px-3 py-1.5 text-xs font-extrabold uppercase text-amber-950'
            : 'rounded-lg bg-amber-400 px-3 py-1.5 text-xs font-extrabold uppercase text-amber-950 hover:bg-amber-300'
        }
      >
        MAJ
      </button>
    </div>
  )
}
