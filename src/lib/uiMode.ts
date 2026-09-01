/**
 * Deux affichages :
 * - Bureau / gérant : tout (piloter à distance).
 * - Terrain (opérateur sans accès RH secrétariat) : boutons de boulot seulement.
 *
 * Les pages restent accessibles par URL (OT peut toujours créer un client).
 */

export type UiAccess = {
  isOwner: boolean
  peutVoirIdentitesRh: boolean
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
}

export function shortcutVisibleForAccess(def: ShortcutAccessFlags, access: UiAccess): boolean {
  if (def.ownerOnly && !access.isOwner) return false
  if (def.rhTeamOnly && !access.isOwner && !access.peutVoirIdentitesRh) return false
  if (def.bureauOnly && isTerrainUi(access)) return false
  return true
}
