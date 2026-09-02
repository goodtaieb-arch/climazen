import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useStore } from '../lib/store'
import {
  APP_EDITION_LABELS,
  lightRouteRedirect,
  routeAllowedInEdition,
} from '../lib/appEdition'

/** Redirige si la route est réservée à Pro ou remplacée en Light. */
export function RequireEdition({ children }: { children: ReactNode }) {
  const { appEdition } = useStore()
  const { pathname } = useLocation()

  const lightRedirect = lightRouteRedirect(pathname, appEdition)
  if (lightRedirect) return <Navigate to={lightRedirect} replace />

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
