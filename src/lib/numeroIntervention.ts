import type { CerfaDraft } from './types'
import type { FicheMaintenanceClim } from './ficheMaintenanceClim'
import type { FicheMaintenanceChaufferie } from './ficheMaintenanceChaufferie'
import { nextNumeroOt, type OrdreTravail } from './ordreTravail'

/**
 * Prochain n° d’intervention / OT unique.
 * Format unifié : aammjjxx (ex. 26081501) — un seul n° par intervention.
 */
export function nextNumeroIntervention(
  data: {
    interventions?: Pick<CerfaDraft, 'numeroIntervention'>[]
    fichesMaintenanceClim?: Pick<FicheMaintenanceClim, 'numero'>[]
    fichesMaintenanceChaufferie?: Pick<FicheMaintenanceChaufferie, 'numero'>[]
    ordresTravail?: Pick<OrdreTravail, 'numero'>[]
  },
  offset = 0,
): string {
  return nextNumeroOt(data, offset)
}
