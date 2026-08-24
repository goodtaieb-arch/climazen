/** Sentry — crashs terrain (CERFA, fiches, PWA). Actif seulement si VITE_SENTRY_DSN est défini. */

import { useEffect } from 'react'
import * as Sentry from '@sentry/react'
import {
  Routes,
  createRoutesFromChildren,
  matchRoutes,
  useLocation,
  useNavigationType,
} from 'react-router-dom'
import { APP_BUILD, APP_VERSION } from './buildStamp'

const dsn = String(import.meta.env.VITE_SENTRY_DSN || '').trim()
const enableInDev = import.meta.env.VITE_SENTRY_ENABLE_DEV === '1'
const isDev = import.meta.env.DEV

export const sentryRelease = `climazen@${APP_VERSION}`

export function isSentryEnabled() {
  return Boolean(dsn) && (!isDev || enableInDev)
}

function scrubValue(value: unknown): unknown {
  if (typeof value !== 'string') return value
  if (value.startsWith('data:image')) return '[image]'
  if (value.length > 4000) return `${value.slice(0, 400)}…[tronqué]`
  return value
}

export function initSentry() {
  if (!isSentryEnabled()) return

  Sentry.init({
    dsn,
    environment:
      String(import.meta.env.VITE_SENTRY_ENV || '').trim() ||
      (isDev ? 'development' : 'production'),
    release: sentryRelease,
    dist: APP_BUILD,
    sendDefaultPii: false,
    tracesSampleRate: isDev ? 0 : 0.12,
    integrations: [
      Sentry.reactRouterBrowserTracingIntegration({
        useEffect,
        useLocation,
        useNavigationType,
        createRoutesFromChildren,
        matchRoutes,
      }),
    ],
    ignoreErrors: [
      /ResizeObserver loop/i,
      /Failed to fetch/i,
      /Load failed/i,
      /NetworkError/i,
      /AbortError/i,
      /The user aborted a request/i,
      /ChunkLoadError/i,
    ],
    denyUrls: [/extensions\//i, /^chrome:\/\//i, /^moz-extension:\/\//i],
    beforeSend(event) {
      if (event.extra) {
        for (const key of Object.keys(event.extra)) {
          event.extra[key] = scrubValue(event.extra[key])
        }
      }
      if (event.contexts?.user) {
        delete (event.contexts.user as { email?: string }).email
      }
      return event
    },
  })
}

export function setSentryUser(
  user: { id: string; email?: string; fullName?: string; organizationId?: string } | null,
) {
  if (!isSentryEnabled()) return
  if (!user) {
    Sentry.setUser(null)
    Sentry.setTag('organizationId', '')
    return
  }
  Sentry.setUser({
    id: user.id,
    username: user.fullName || user.email,
  })
  if (user.organizationId) Sentry.setTag('organizationId', user.organizationId)
}

export function captureException(error: unknown, extra?: Record<string, unknown>) {
  if (!isSentryEnabled()) return
  Sentry.captureException(error, extra ? { extra } : undefined)
}

/** Routes instrumentées (navigation Sentry). Sans DSN = Routes normales. */
export const SentryRoutes = isSentryEnabled()
  ? Sentry.wrapReactRouterRouting(Routes)
  : Routes
