/**
 * Deux éditions ClimaZEN :
 * - Light : auto-entrepreneur / solo — même métier (OT, agenda, contrats, CERFA…) mais un seul utilisateur.
 * - Pro : PME / TPE — équipe, multi-techniciens, pointeuse, RH, chaîne commerciale…
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

/** Tarification affichée (landing, inscription, Mon entreprise). */
export const APP_EDITION_PRICING: Record<
  AppEdition,
  { price: string; priceSuffix?: string; detail: string }
> = {
  light: {
    price: '0 €',
    priceSuffix: '/ mois',
    detail: 'Gratuit pour toujours — édition solo / auto-entrepreneur.',
  },
  pro: {
    price: '0 €',
    priceSuffix: '/ mois (bêta)',
    detail: 'Offre payante à la sortie de la bêta — gratuite pendant la finalisation.',
  },
}

export const APP_EDITION_PRICING_AFTER_BETA =
  'L’édition Pro deviendra payante à la fin de la version bêta. L’édition Light reste gratuite.'

/** Réexport tarification IA Light (chatbot post-bêta, Agent payant). */
export { AI_LIGHT_BETA_HINT, AI_LIGHT_PRICING, AI_TIER_LABELS } from './aiAccess'
export type { AiPlan, AiTier } from './aiAccess'

export const APP_EDITION_DESCRIPTIONS: Record<AppEdition, string> = {
  light:
    'OT, agenda, contrats maintenance, stock fluides, CERFA et société — tout le métier, un seul compte utilisateur.',
  pro:
    'Comme Light + équipe multi-techniciens, pointeuse, RH, agences, devis/commandes et pilotage.',
}

/** Différence clé affichée aux utilisateurs. */
export const APP_EDITION_SOLO_HINT =
  'Édition Light : un seul utilisateur. Passez à Pro pour embaucher et gérer plusieurs techniciens.'

/** Parcours solo AE — une intervention = client → site → équipement → papiers. */
export const LIGHT_SOLO_FLOW_HINT =
  'Client → site (depuis la fiche client), stock fluides, OT, agenda, contrats et CERFA — solo.'

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
  /** Liste OT / demandes */
  | 'ot_list'
  /** Stock pièces détachées GMAO */
  | 'stock_pieces'

const PRO_ONLY: ReadonlySet<EditionFeature> = new Set([
  'equipe',
  'pointage',
  'rh',
  'chaine_commerciale',
  'multi_tech_ot',
  'agences',
  'team_kpi',
  'create_operator',
  'stock_pieces',
])

/** Routes Pro ou masquées du menu Light (sous /app). */
export const PRO_ROUTE_PREFIXES = [
  '/app/equipe',
  '/app/pointage',
  '/app/stock-pieces',
  '/app/devis',
  '/app/commandes',
] as const

/** Routes Light accessibles via menu « Plus » seulement. */
export const LIGHT_MORE_ROUTE_PREFIXES = [
  '/app/scan-equip',
] as const

export function routeInLightMoreMenu(pathname: string): boolean {
  return LIGHT_MORE_ROUTE_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  )
}

/** Redirections Light → parcours solo (aucune pour OT / agenda : accessibles en Light). */
export function lightRouteRedirect(_pathname: string, _edition: AppEdition): string | null {
  return null
}

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

/** Dossier opérateur solo (signature CERFA) — autorisé en Light pour son propre compte. */
export function isLightOwnDossierRoute(pathname: string, ownUserId?: string | null): boolean {
  if (!ownUserId?.trim()) return false
  return pathname === `/app/equipe/${ownUserId.trim()}`
}

export function routeAllowedInEdition(
  pathname: string,
  edition: AppEdition,
  opts?: { ownUserId?: string | null },
): boolean {
  if (edition === 'pro') return true
  if (isLightOwnDossierRoute(pathname, opts?.ownUserId)) return true
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
