import { useEffect } from 'react'
import { QUEUE_RETRY_MS, flushQueueBackup } from '../lib/documentQueue'

/** Réessaie l’envoi NAS / cloud toutes les 15 min. Invisible. */
export function CoffreQueueWorker() {
  useEffect(() => {
    const run = (force: boolean) => {
      void flushQueueBackup({ force }).catch((err) => {
        console.warn('ClimaZEN: file coffre', err)
      })
    }
    run(true)
    const timer = window.setInterval(() => run(false), QUEUE_RETRY_MS)
    const onOnline = () => run(true)
    window.addEventListener('online', onOnline)
    const onVis = () => {
      if (document.visibilityState === 'visible') run(false)
    }
    document.addEventListener('visibilitychange', onVis)
    return () => {
      window.clearInterval(timer)
      window.removeEventListener('online', onOnline)
      document.removeEventListener('visibilitychange', onVis)
    }
  }, [])

  return null
}
