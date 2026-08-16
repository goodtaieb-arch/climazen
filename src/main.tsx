import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import './index.css'
import App from './App.tsx'
import { APP_BUILD, APP_VERSION } from './lib/buildStamp'

// Visible dans la console / DevTools pour confirmer la version chargée
console.info(`[ClimaZEN] ${APP_VERSION} (${APP_BUILD})`)
document.documentElement.dataset.climazenVersion = APP_VERSION

registerSW({
  immediate: true,
  onNeedRefresh() {
    // Nouvelle version dispo → rechargement forcé (évite l’ancien cache PWA)
    window.location.reload()
  },
  onRegisteredSW(swUrl, registration) {
    if (!registration) return

    // Poll périodique + au retour réseau
    const check = () => {
      void registration.update()
    }
    window.addEventListener('online', check)
    window.addEventListener('focus', check)
    setInterval(check, 60_000)

    // Si un SW waiting existe déjà (onglet ouvert depuis longtemps), active-le
    if (registration.waiting) {
      registration.waiting.postMessage({ type: 'SKIP_WAITING' })
      window.location.reload()
    }

    // Debug : URL du SW courant
    console.info(`[ClimaZEN] SW ${swUrl}`)
  },
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
