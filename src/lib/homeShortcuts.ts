import { ICON3D } from './icons3d'
import { isTerrainUi, shortcutVisibleForAccess, type UiAccess } from './uiMode'
import type { EditionFeature } from './appEdition'

/** Identifiants des raccourcis Accueil mobile (grille de cercles). */
export type HomeShortcutId =
  | 'sites'
  | 'scan_qr'
  | 'agenda'
  | 'cerfa'
  | 'stock'
  | 'clients'
  | 'carnet'
  | 'ot'
  | 'appel'
  | 'profil'
  | 'contrats'
  | 'equipe'
  | 'operateur'
  | 'pointage'

export type HomeShortcutDef = {
  id: HomeShortcutId
  title: string
  img: string
  /** Route React Router (si pas d’action spéciale). */
  to?: string
  /** Action gérée par Dashboard (ex. goTravaux). */
  action?: 'goTravaux'
  ownerOnly?: boolean
  /** Visible si gérant ou accès RH équipe. */
  rhTeamOnly?: boolean
  /** Clients / contrats : bureau & gérant seulement (pas le tech terrain). */
  bureauOnly?: boolean
  /** Masqué de l’accueil Light (reste accessible via menu Plus ou parcours). */
  lightHidden?: boolean
  proOnly?: boolean
  proFeature?: EditionFeature
}

export const HOME_SHORTCUT_CATALOG: Record<HomeShortcutId, HomeShortcutDef> = {
  sites: {
    id: 'sites',
    title: 'Sites & Parc',
    img: ICON3D.sites,
    action: 'goTravaux',
    lightHidden: true,
  },
  scan_qr: {
    id: 'scan_qr',
    title: 'Scanner QR',
    img: ICON3D.search,
    to: '/app/scan-equip?camera=1',
  },
  agenda: {
    id: 'agenda',
    title: 'Agenda',
    img: ICON3D.search,
    to: '/app/agenda',
  },
  cerfa: {
    id: 'cerfa',
    title: 'CERFA',
    img: ICON3D.cerfa,
    to: '/app/interventions',
  },
  stock: {
    id: 'stock',
    title: 'Stock fluides',
    img: ICON3D.bottle,
    to: '/app/stock',
  },
  clients: {
    id: 'clients',
    title: 'Clients',
    img: ICON3D.clients,
    to: '/app/clients',
    bureauOnly: true,
  },
  carnet: {
    id: 'carnet',
    title: 'Carnet',
    img: ICON3D.clients,
    to: '/app/carnet',
  },
  ot: {
    id: 'ot',
    title: 'OT / Demandes',
    img: ICON3D.maintenance,
    to: '/app/ot',
  },
  appel: {
    id: 'appel',
    title: 'Intervenir',
    img: ICON3D.accueil,
    to: '/app/appel',
  },
  profil: {
    id: 'profil',
    title: 'Mon profil',
    img: ICON3D.signaturePad,
    to: '/app/profil',
  },
  contrats: {
    id: 'contrats',
    title: 'Contrats',
    img: ICON3D.maintenance,
    to: '/app/contrats',
    bureauOnly: true,
  },
  equipe: {
    id: 'equipe',
    title: 'Équipe',
    img: ICON3D.equipe,
    to: '/app/equipe',
    rhTeamOnly: true,
    proOnly: true,
    proFeature: 'equipe',
  },
  operateur: {
    id: 'operateur',
    title: 'Mon entreprise',
    img: ICON3D.entreprise,
    to: '/app/operateur',
    ownerOnly: true,
  },
  pointage: {
    id: 'pointage',
    title: 'Pointeuse',
    img: ICON3D.signaturePad,
    to: '/app/pointage',
    proOnly: true,
    proFeature: 'pointage',
  },
}

/** Disposition par défaut bureau / gérant Pro. */
export const DEFAULT_HOME_SHORTCUT_IDS: HomeShortcutId[] = [
  'sites',
  'scan_qr',
  'agenda',
  'cerfa',
  'stock',
  'clients',
  'carnet',
  'ot',
  'appel',
  'pointage',
  'profil',
]

/** Light (solo / AE) : métier complet, un seul utilisateur. */
export const DEFAULT_HOME_SHORTCUT_IDS_LIGHT: HomeShortcutId[] = [
  'appel',
  'ot',
  'agenda',
  'stock',
  'carnet',
  'cerfa',
  'contrats',
  'operateur',
  'profil',
]

/** Terrain : uniquement les boutons d’intervention. */
export const DEFAULT_HOME_SHORTCUT_IDS_TERRAIN: HomeShortcutId[] = [
  'appel',
  'pointage',
  'scan_qr',
  'sites',
  'ot',
  'cerfa',
  'stock',
  'carnet',
  'agenda',
  'profil',
]

export const MIN_HOME_SHORTCUTS = 1
export const MAX_HOME_SHORTCUTS = 12

const STORAGE_PREFIX = 'climazen_home_icons_'

export function homeShortcutsStorageKey(userId: string) {
  return `${STORAGE_PREFIX}${userId}`
}

function isHomeShortcutId(v: unknown): v is HomeShortcutId {
  return typeof v === 'string' && v in HOME_SHORTCUT_CATALOG
}

export type HomeShortcutAccess = UiAccess & {
  equipePath?: string
}

function defaultShortcutIds(access: HomeShortcutAccess): HomeShortcutId[] {
  if (isTerrainUi(access)) return DEFAULT_HOME_SHORTCUT_IDS_TERRAIN
  const edition = access.appEdition ?? 'pro'
  return edition === 'light' ? DEFAULT_HOME_SHORTCUT_IDS_LIGHT : DEFAULT_HOME_SHORTCUT_IDS
}

/** Filtre le catalogue selon le rôle / droits. */
export function availableHomeShortcutIds(access: HomeShortcutAccess): HomeShortcutId[] {
  return (Object.keys(HOME_SHORTCUT_CATALOG) as HomeShortcutId[]).filter((id) =>
    shortcutVisibleForAccess(HOME_SHORTCUT_CATALOG[id], access),
  )
}

/** Charge les préférences utilisateur (localStorage, par appareil). */
export function loadHomeShortcutIds(userId: string): HomeShortcutId[] | null {
  try {
    const raw = localStorage.getItem(homeShortcutsStorageKey(userId))
    if (!raw) return null
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return null
    const ids = parsed.filter(isHomeShortcutId)
    if (ids.length < MIN_HOME_SHORTCUTS) return null
    return ids.slice(0, MAX_HOME_SHORTCUTS)
  } catch {
    return null
  }
}

export function saveHomeShortcutIds(userId: string, ids: HomeShortcutId[]) {
  localStorage.setItem(homeShortcutsStorageKey(userId), JSON.stringify(ids))
}

export function resetHomeShortcutIds(userId: string) {
  localStorage.removeItem(homeShortcutsStorageKey(userId))
}

/**
 * Résout la liste affichée : prefs utilisateur filtrées + défaut si absent.
 * Retire les raccourcis devenus inaccessibles (changement de rôle).
 */
export function resolveHomeShortcutIds(
  userId: string | undefined,
  access: HomeShortcutAccess,
): HomeShortcutId[] {
  const allowed = new Set(availableHomeShortcutIds(access))
  const saved = userId ? loadHomeShortcutIds(userId) : null
  const defaults = defaultShortcutIds(access)
  const base = saved ?? defaults
  const filtered = base.filter((id) => allowed.has(id))
  if (filtered.length >= MIN_HOME_SHORTCUTS) return filtered.slice(0, MAX_HOME_SHORTCUTS)
  const fallback = defaults.filter((id) => allowed.has(id))
  return fallback.length ? fallback : [...allowed].slice(0, MAX_HOME_SHORTCUTS)
}

/** Raccourcis du catalogue non affichés (pour « Ajouter »). */
export function hiddenHomeShortcutIds(
  visible: HomeShortcutId[],
  access: HomeShortcutAccess,
): HomeShortcutId[] {
  const visibleSet = new Set(visible)
  return availableHomeShortcutIds(access).filter((id) => !visibleSet.has(id))
}
