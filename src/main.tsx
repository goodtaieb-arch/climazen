import './lib/sentryInit'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import './index.css'
import App from './App.tsx'
import { APP_BUILD, APP_VERSION } from './lib/buildStamp'
import { fetchServerVersion, forceLatestAppVersion } from './components/AppVersion'

// Visible dans la console / DevTools pour confirmer la version chargée
console.info(`[ClimaZEN] ${APP_VERSION} (${APP_BUILD})`)
document.documentElement.dataset.climazenVersion = APP_VERSION

/** Si le serveur a une version plus récente que ce JS, purge + reload. */
async function ensureServerVersion() {
  try {
    // Après un clic MAJ / tentative auto : ne pas relancer en boucle
    if (sessionStorage.getItem('climazen_reloading') === '1') return
    const server = await fetchServerVersion()
    if (!server) return
    if (server !== APP_VERSION) {
      console.warn(`[ClimaZEN] serveur=${server} local=${APP_VERSION} → MAJ forcée`)
      await forceLatestAppVersion(server)
      return
    }
    // Seulement quand on est vraiment à jour : mémoriser la version boot
    try {
      localStorage.setItem('climazen_boot_v', server)
      sessionStorage.removeItem('climazen_reloading')
    } catch {
      /* ignore */
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
