/**
 * Deux affichages :
 * - Bureau / gérant : tout (piloter à distance).
 * - Terrain (opérateur sans accès RH secrétariat) : boutons de boulot seulement.
 *
 * Édition Light : masque équipe, agenda, pointeuse (solo / AE).
 * Les pages Pro restent bloquées par route si accès direct par URL.
 */

import {
  editionHasFeature,
  type AppEdition,
  type EditionFeature,
} from './appEdition'

export type UiAccess = {
  isOwner: boolean
  peutVoirIdentitesRh: boolean
  appEdition?: AppEdition
}

/** Gérant, ou employé bureau (accès RH / secrétariat). */
export function isBureauUi(access: UiAccess): boolean {
  return Boolean(access.isOwner || access.peutVoirIdentitesRh)
}

/** Technicien terrain : UI allégée. */
export function isTerrainUi(access: UiAccess): boolean {
  return !isBureauUi(access)
}

export type ShortcutAccessFlags = {
  ownerOnly?: boolean
  rhTeamOnly?: boolean
  bureauOnly?: boolean
  lightHidden?: boolean
  /** Réservé à l’édition Pro (équipe, agenda, pointeuse…). */
  proOnly?: boolean
  proFeature?: EditionFeature
}

export function shortcutVisibleForAccess(def: ShortcutAccessFlags, access: UiAccess): boolean {
  if (def.ownerOnly && !access.isOwner) return false
  if (def.rhTeamOnly && !access.isOwner && !access.peutVoirIdentitesRh) return false
  if (def.bureauOnly && isTerrainUi(access)) return false
  const edition = access.appEdition ?? 'pro'
  if (edition === 'light' && def.lightHidden) return false
  if (def.proOnly && !editionHasFeature(edition, def.proFeature ?? 'equipe')) return false
  if (def.proFeature && !editionHasFeature(edition, def.proFeature)) return false
  return true
}
