import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import './index.css'
import App from './App.tsx'
import { APP_BUILD } from './lib/buildStamp'

// Visible dans la console / DevTools pour confirmer la version chargée
console.info(`[ClimaZEN] build ${APP_BUILD}`)

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
