import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useStore } from '../lib/store'
import { APP_EDITION_LABELS, routeAllowedInEdition } from '../lib/appEdition'

/** Redirige vers l’accueil si la route est réservée à l’édition Pro. */
export function RequireEdition({ children }: { children: ReactNode }) {
  const { appEdition } = useStore()
  const { pathname } = useLocation()

  if (routeAllowedInEdition(pathname, appEdition)) return <>{children}</>

  return (
    <Navigate
      to="/app"
      replace
      state={{
        editionBlocked: true,
        edition: appEdition,
        from: pathname,
        message: `Fonction réservée à ClimaZEN ${APP_EDITION_LABELS.pro}. Passez à Pro dans Mon entreprise.`,
      }}
    />
  )
}
