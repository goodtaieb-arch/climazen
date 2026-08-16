import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import './index.css'
import App from './App.tsx'
import { APP_BUILD, APP_VERSION } from './lib/buildStamp'
import { forceLatestAppVersion } from './components/AppVersion'

// Visible dans la console / DevTools pour confirmer la version chargée
console.info(`[ClimaZEN] ${APP_VERSION} (${APP_BUILD})`)
document.documentElement.dataset.climazenVersion = APP_VERSION
try {
  localStorage.setItem('climazen_boot_v', APP_VERSION)
} catch {
  /* ignore */
}

/** Si le serveur a une version plus récente que ce JS, purge + reload. */
async function ensureServerVersion() {
  try {
    const res = await fetch(`/version.json?t=${Date.now()}`, { cache: 'no-store' })
    if (!res.ok) return
    const data = (await res.json()) as { version?: string }
    const server = data.version?.trim()
    if (server && server !== APP_VERSION) {
      console.warn(`[ClimaZEN] serveur=${server} local=${APP_VERSION} → MAJ forcée`)
      await forceLatestAppVersion()
    }
  } catch {
    /* hors ligne : on garde la version locale */
  }
}

void ensureServerVersion()
window.addEventListener('online', () => void ensureServerVersion())
window.addEventListener('focus', () => void ensureServerVersion())

registerSW({
  immediate: true,
  onNeedRefresh() {
    window.location.reload()
  },
  onRegisteredSW(swUrl, registration) {
    if (!registration) return

    // Empêche le navigateur de garder un vieux sw.js en cache HTTP
    void navigator.serviceWorker.register(swUrl, {
      scope: '/',
      updateViaCache: 'none',
    })

    const check = () => {
      void registration.update()
      void ensureServerVersion()
    }
    window.addEventListener('online', check)
    window.addEventListener('focus', check)
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') check()
    })
    setInterval(check, 12_000)

    if (registration.waiting) {
      registration.waiting.postMessage({ type: 'SKIP_WAITING' })
      window.location.reload()
    }

    console.info(`[ClimaZEN] SW ${swUrl}`)
  },
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
