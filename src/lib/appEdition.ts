/**
 * Deux éditions ClimaZEN :
 * - Light : auto-entrepreneur / solo — l’essentiel métier sans équipe ni admin lourd.
 * - Pro : PME / TPE — planning, équipe, pointeuse, RH, chaîne commerciale…
 */

export type AppEdition = 'light' | 'pro'

export const APP_EDITION_LABELS: Record<AppEdition, string> = {
  light: 'Light',
  pro: 'Pro',
}

export const APP_EDITION_TAGLINES: Record<AppEdition, string> = {
  light: 'Solo · auto-entrepreneur · micro',
  pro: 'PME · TPE · équipes',
}

export const APP_EDITION_DESCRIPTIONS: Record<AppEdition, string> = {
  light:
    'Clients, sites, OT, contrats de maintenance, CERFA et détecteur — sans équipe, agenda ni pointeuse.',
  pro:
    'Tout ClimaZEN : équipe, agenda, pointeuse légale, RH, multi-techniciens, agences et pilotage.',
}

/** Fonctionnalités réservées à l’édition Pro. */
export type EditionFeature =
  | 'equipe'
  | 'pointage'
  | 'agenda'
  | 'rh'
  | 'chaine_commerciale'
  | 'multi_tech_ot'
  | 'agences'
  | 'team_kpi'
  | 'create_operator'

const PRO_ONLY: ReadonlySet<EditionFeature> = new Set([
  'equipe',
  'pointage',
  'agenda',
  'rh',
  'chaine_commerciale',
  'multi_tech_ot',
  'agences',
  'team_kpi',
  'create_operator',
])

/** Préfixes de routes réservées à Pro (sous /app). */
export const PRO_ROUTE_PREFIXES = ['/app/equipe', '/app/agenda', '/app/pointage'] as const

const PENDING_EDITION_KEY = 'climazen_pending_edition'
let pendingEditionMemory: AppEdition | null = null

function readPendingEditionStorage(): string | null {
  try {
    const v = localStorage.getItem(PENDING_EDITION_KEY)
    if (v) return v
  } catch {
    /* privé / indisponible */
  }
  return pendingEditionMemory
}

function writePendingEditionStorage(edition: AppEdition) {
  pendingEditionMemory = edition
  try {
    localStorage.setItem(PENDING_EDITION_KEY, edition)
  } catch {
    /* quota / privé */
  }
}

function clearPendingEditionStorage() {
  pendingEditionMemory = null
  try {
    localStorage.removeItem(PENDING_EDITION_KEY)
  } catch {
    /* privé */
  }
}

export function parseAppEdition(raw: unknown): AppEdition | undefined {
  const v = String(raw || '').trim()
  return v === 'light' || v === 'pro' ? v : undefined
}

/** Comptes existants sans champ → Pro (rétrocompat). */
export function resolveAppEdition(raw: unknown): AppEdition {
  return parseAppEdition(raw) ?? 'pro'
}

export function isProEdition(edition: AppEdition): boolean {
  return edition === 'pro'
}

export function isLightEdition(edition: AppEdition): boolean {
  return edition === 'light'
}

export function editionHasFeature(edition: AppEdition, feature: EditionFeature): boolean {
  if (edition === 'pro') return true
  return !PRO_ONLY.has(feature)
}

export function routeAllowedInEdition(pathname: string, edition: AppEdition): boolean {
  if (edition === 'pro') return true
  return !PRO_ROUTE_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  )
}

export function filterLinksByEdition<T extends { to: string }>(links: T[], edition: AppEdition): T[] {
  return links.filter((l) => routeAllowedInEdition(l.to, edition))
}

export function stashPendingEdition(edition: AppEdition) {
  writePendingEditionStorage(edition)
}

export function consumePendingEdition(): AppEdition | null {
  const v = readPendingEditionStorage()
  clearPendingEditionStorage()
  return parseAppEdition(v) ?? null
}

export function applyPendingEditionIfNeeded(data: { appEdition?: AppEdition }): {
  appEdition: AppEdition
  changed: boolean
} {
  if (parseAppEdition(data.appEdition)) {
    return { appEdition: resolveAppEdition(data.appEdition), changed: false }
  }
  const pending = consumePendingEdition()
  if (pending) return { appEdition: pending, changed: true }
  return { appEdition: 'pro', changed: false }
}
