/** Ordre de travail (OT) — n° unique OTYYYYNNNN pour chaque action terrain. */

export type TypeOt =
  | 'controle_etancheite'
  | 'maintenance'
  | 'depanage'
  | 'demantelement'
  | 'entretien'
  | 'installation'

export const TYPE_OT_LABELS: Record<TypeOt, string> = {
  controle_etancheite: 'Contrôle d’étanchéité',
  maintenance: 'Maintenance',
  depanage: 'Dépannage',
  demantelement: 'Démantèlement',
  entretien: 'Entretien',
  installation: 'Installation',
}

export type StatutOt = 'brouillon' | 'en_cours' | 'termine' | 'signe'

export const STATUT_OT_LABELS: Record<StatutOt, string> = {
  brouillon: 'Brouillon',
  en_cours: 'En cours',
  termine: 'Terminé',
  signe: 'Clôturé',
}

export function isOtCloture(statut: StatutOt | string | undefined): boolean {
  return statut === 'signe' || statut === 'termine'
}

/** Étapes du parcours appel client → intervention. */
export const PARCOURS_APPEL_STEPS = [
  { id: 'ot', label: 'Appel / OT', hint: 'Décrire la demande' },
  { id: 'client', label: 'Client', hint: 'Qui appelle' },
  { id: 'site', label: 'Site', hint: 'Où intervenir' },
  { id: 'equipement', label: 'Équipement', hint: 'Sur place' },
  { id: 'docs', label: 'Intervention', hint: 'CERFA / fiche' },
] as const

export type ParcoursAppelStepId = (typeof PARCOURS_APPEL_STEPS)[number]['id']

export interface OrdreTravail {
  id: string
  /** Format OTYYYYNNNN — ex. OT20260001 */
  numero: string
  date: string
  typeOt: TypeOt
  /** Description de l’action / mission (panne, installation…) */
  action: string
  /** Rapport d’action (ce qui a été fait) */
  rapportAction: string
  observations: string
  clientId?: string
  chantierId?: string
  /** Équipement principal (compat) */
  equipementId?: string
  /** Plusieurs équipements traités sur le même OT */
  equipementIds?: string[]
  technicien: string
  /** Lien CERFA si généré avec fluide */
  interventionId?: string
  /** Lien fiche maintenance / rapport sans CERFA */
  ficheMaintenanceId?: string
  signatureTechnicienImage?: string
  signatureClientImage?: string
  statut: StatutOt
  /** Étape parcours guidé (reprise) */
  parcoursStep?: ParcoursAppelStepId
  createdByUserId?: string
  createdByName?: string
  createdAt: string
  updatedAt: string
}

export function blankOrdreTravail(): Omit<OrdreTravail, 'id' | 'createdAt' | 'updatedAt'> {
  return {
    numero: '',
    date: new Date().toISOString().slice(0, 10),
    typeOt: 'depanage',
    action: '',
    rapportAction: '',
    observations: '',
    technicien: '',
    statut: 'brouillon',
    parcoursStep: 'ot',
  }
}

/** Natures CERFA suggérées selon le type d’OT. */
export function naturesCerfaPourTypeOt(typeOt: TypeOt): string[] {
  if (typeOt === 'demantelement') return ['demantelement']
  if (typeOt === 'controle_etancheite') return ['controle_etancheite_periodique']
  if (typeOt === 'maintenance') return ['entretien_reparation', 'controle_etancheite_periodique']
  return ['entretien_reparation']
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

/** Déduit l’étape à reprendre selon ce qui est déjà renseigné. */
export function inferParcoursStep(ot: OrdreTravail): ParcoursAppelStepId {
  if (ot.parcoursStep === 'docs') return 'docs'
  if (!ot.action?.trim()) return 'ot'
  if (!ot.clientId) return 'client'
  if (!ot.chantierId) return 'site'
  if (!ot.equipementId && !(ot.equipementIds && ot.equipementIds.length > 0)) return 'equipement'
  return 'docs'
}
