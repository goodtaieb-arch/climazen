/**
 * Installations de destination CERFA [13] — distributeurs habituels + liste société.
 */

export const DESTINATIONS_INSTALLATION_DEFAUT = [
  'Climalife',
  'Gazechim',
  'Westfalen',
  'Dépôt atelier',
  'Destruction / BSFF Trackdéchets',
] as const

const AUTRE_VALUE = '__autre__'

export { AUTRE_VALUE as DESTINATION_AUTRE_VALUE }

/** Fusionne défauts + préférences société + historiques CERFA (sans doublons). */
export function mergeDestinationsInstallation(
  operateurList?: string[] | null,
  fromInterventions?: string[] | null,
): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const raw of [
    ...DESTINATIONS_INSTALLATION_DEFAUT,
    ...(operateurList || []),
    ...(fromInterventions || []),
  ]) {
    const v = (raw || '').trim()
    if (!v) continue
    const key = v.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    out.push(v)
  }
  return out
}

/** Place une destination en tête de la liste société (max 20). */
export function rememberDestination(current: string[] | undefined, value: string, max = 20): string[] {
  const v = value.trim()
  if (!v) return current || []
  const rest = (current || []).filter((x) => x.trim().toLowerCase() !== v.toLowerCase())
  return [v, ...rest].slice(0, max)
}

/** true si la valeur n’est pas dans la liste proposée → mode texte libre. */
export function isDestinationLibre(value: string, options: string[]): boolean {
  const v = value.trim()
  if (!v) return false
  return !options.some((o) => o.trim().toLowerCase() === v.toLowerCase())
}
