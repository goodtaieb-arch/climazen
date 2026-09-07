/** Désinstalle tous les service workers du domaine et vide les caches PWA. */
export async function uninstallAllServiceWorkers(): Promise<boolean> {
  let hadWorkers = false

  try {
    if ('serviceWorker' in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations()
      hadWorkers = regs.length > 0
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

  return hadWorkers
}
