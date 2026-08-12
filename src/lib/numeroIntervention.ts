import type { CerfaDraft } from './types'
import type { FicheMaintenanceClim } from './ficheMaintenanceClim'
import { nextNumeroOt, type OrdreTravail } from './ordreTravail'

/**
 * Prochain n° d’intervention / OT unique.
 * Format unifié : OT20260001
 * (conserve la compat lecture des anciens INT-YYYY-NNNN)
 */
export function nextNumeroIntervention(
  data: {
    interventions?: Pick<CerfaDraft, 'numeroIntervention'>[]
    fichesMaintenanceClim?: Pick<FicheMaintenanceClim, 'numero'>[]
    ordresTravail?: Pick<OrdreTravail, 'numero'>[]
  },
  offset = 0,
): string {
  return nextNumeroOt(data, offset)
}
