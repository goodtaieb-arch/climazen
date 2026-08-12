/** Ordre de travail (OT) — n° unique OTYYYYNNNN pour chaque action terrain. */

export type TypeOt =
  | 'controle_etancheite'
  | 'maintenance'
  | 'depanage'
  | 'demantelement'
  | 'entretien'

export const TYPE_OT_LABELS: Record<TypeOt, string> = {
  controle_etancheite: 'Contrôle d’étanchéité',
  maintenance: 'Maintenance',
  depanage: 'Dépannage',
  demantelement: 'Démantèlement',
  entretien: 'Entretien',
}

export type StatutOt = 'brouillon' | 'en_cours' | 'termine' | 'signe'

export const STATUT_OT_LABELS: Record<StatutOt, string> = {
  brouillon: 'Brouillon',
  en_cours: 'En cours',
  termine: 'Terminé',
  signe: 'Signé',
}

export interface OrdreTravail {
  id: string
  /** Format OTYYYYNNNN — ex. OT20260001 */
  numero: string
  date: string
  typeOt: TypeOt
  /** Description de l’action / mission */
  action: string
  /** Rapport d’action (ce qui a été fait) */
  rapportAction: string
  observations: string
  clientId?: string
  chantierId?: string
  equipementId?: string
  technicien: string
  /** Lien CERFA si généré avec fluide */
  interventionId?: string
  /** Lien fiche maintenance / rapport sans CERFA */
  ficheMaintenanceId?: string
  signatureTechnicienImage?: string
  signatureClientImage?: string
  statut: StatutOt
  createdByUserId?: string
  createdByName?: string
  createdAt: string
  updatedAt: string
}

export function blankOrdreTravail(): Omit<OrdreTravail, 'id' | 'createdAt' | 'updatedAt'> {
  return {
    numero: '',
    date: new Date().toISOString().slice(0, 10),
    typeOt: 'entretien',
    action: '',
    rapportAction: '',
    observations: '',
    technicien: '',
    statut: 'brouillon',
  }
}

/** Extrait le max séquentiel OTYYYYNNNN (ou ancien INT-YYYY-NNNN). */
function maxSeqOt(year: number, values: (string | undefined)[]): number {
  const reOt = new RegExp(`^OT${year}(\\d{4})$`, 'i')
  const reInt = new RegExp(`^INT-${year}-(\\d+)$`, 'i')
  let max = 0
  for (const raw of values) {
    const v = (raw || '').trim()
    const mOt = reOt.exec(v)
    if (mOt) {
      max = Math.max(max, Number(mOt[1]) || 0)
      continue
    }
    const mInt = reInt.exec(v)
    if (mInt) max = Math.max(max, Number(mInt[1]) || 0)
  }
  return max
}

/**
 * Prochain n° OT unique.
 * Format : OT20260001
 */
export function nextNumeroOt(
  data: {
    ordresTravail?: Pick<OrdreTravail, 'numero'>[]
    interventions?: { numeroIntervention?: string }[]
    fichesMaintenanceClim?: { numero?: string }[]
  },
  offset = 0,
): string {
  const year = new Date().getFullYear()
  const values = [
    ...(data.ordresTravail || []).map((o) => o.numero),
    ...(data.interventions || []).map((i) => i.numeroIntervention),
    ...(data.fichesMaintenanceClim || []).map((f) => f.numero),
  ]
  const next = maxSeqOt(year, values) + 1 + Math.max(0, offset)
  return `OT${year}${String(next).padStart(4, '0')}`
}
