import type { CerfaDraft } from './types'
import type { FicheMaintenanceClim } from './ficheMaintenanceClim'

/** Extrait le max séquentiel INT-YYYY-NNNN déjà utilisé. */
function maxSeq(year: number, values: (string | undefined)[]): number {
  const re = new RegExp(`^INT-${year}-(\\d+)$`, 'i')
  let max = 0
  for (const raw of values) {
    const m = re.exec((raw || '').trim())
    if (m) max = Math.max(max, Number(m[1]) || 0)
  }
  return max
}

/**
 * Prochain n° d’intervention unique (CERFA ou rapport sans CERFA).
 * Format : INT-2026-0001
 * @param offset — pour allouer plusieurs n° d’affilée avant persistance (0, 1, 2…)
 */
export function nextNumeroIntervention(
  data: {
    interventions?: Pick<CerfaDraft, 'numeroIntervention'>[]
    fichesMaintenanceClim?: Pick<FicheMaintenanceClim, 'numero'>[]
  },
  offset = 0,
): string {
  const year = new Date().getFullYear()
  const fromCerfa = (data.interventions || []).map((i) => i.numeroIntervention)
  const fromFiches = (data.fichesMaintenanceClim || []).map((f) => f.numero)
  const next = maxSeq(year, [...fromCerfa, ...fromFiches]) + 1 + Math.max(0, offset)
  return `INT-${year}-${String(next).padStart(4, '0')}`
}
