import {
  equipAvecFluideFrigorigene,
  MODE_GESTION_LABELS,
  type CerfaDraft,
  type ModeGestion,
  type Site,
  type TypeTravaux,
} from './types'
import { allEquipements } from './cerfaBatch'

const PONCTUEL_TYPES: TypeTravaux[] = [
  'installation',
  'depanage',
  'mise_en_service',
  'recuperation',
  'demantelement',
]

/** Infère le mode si non renseigné (sites existants). */
export function resolveModeGestion(site: Pick<Site, 'modeGestion' | 'typeTravaux'>): ModeGestion {
  if (site.modeGestion === 'contrat' || site.modeGestion === 'ponctuel') return site.modeGestion
  if (site.typeTravaux && PONCTUEL_TYPES.includes(site.typeTravaux)) return 'ponctuel'
  return 'contrat'
}

export function modeGestionLabel(site: Pick<Site, 'modeGestion' | 'typeTravaux'>): string {
  return MODE_GESTION_LABELS[resolveModeGestion(site)]
}

/** Charge totale fluide du parc (kg). */
export function siteChargeTotaleKg(site: Site): number {
  const eqs = allEquipements(site)
  const withFluide = eqs.filter((e) => equipAvecFluideFrigorigene(e))
  if (withFluide.length === 0) return 0
  return Math.round(withFluide.reduce((s, e) => s + (Number(e.chargeNominaleKg) || 0), 0) * 1000) / 1000
}

/** Fluides présents sur le site (ex. R-32, R-410A). */
export function siteFluidesSummary(site: Site): string {
  const eqs = allEquipements(site).filter((e) => equipAvecFluideFrigorigene(e))
  const set = new Set(eqs.map((e) => (e.fluideType || '').trim()).filter(Boolean))
  return [...set].join(', ')
}

export function addMonthsIso(isoDate: string, months: number): string | undefined {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(isoDate)
  if (!m) return undefined
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])))
  if (Number.isNaN(d.getTime())) return undefined
  d.setUTCMonth(d.getUTCMonth() + months)
  return d.toISOString().slice(0, 10)
}

export function resolveProchaineControle(site: Site): string | undefined {
  if (site.prochaineControleEtancheite) return site.prochaineControleEtancheite
  if (site.derniereMaintenanceDate) return addMonthsIso(site.derniereMaintenanceDate, 12)
  return undefined
}

export function formatMoisAnnee(iso?: string): string {
  if (!iso) return ''
  const m = /^(\d{4})-(\d{2})/.exec(iso)
  if (!m) return iso
  const months = [
    'janvier',
    'février',
    'mars',
    'avril',
    'mai',
    'juin',
    'juillet',
    'août',
    'septembre',
    'octobre',
    'novembre',
    'décembre',
  ]
  const mi = Number(m[2]) - 1
  return `${months[mi] || m[2]} ${m[1]}`
}

/** Contrôle dans les 60 prochains jours (ou déjà dépassé). */
export function controleEtancheiteSoon(site: Site, withinDays = 60): boolean {
  const next = resolveProchaineControle(site)
  if (!next) return false
  const t = Date.parse(`${next}T12:00:00`)
  if (Number.isNaN(t)) return false
  const now = Date.now()
  const limit = now + withinDays * 24 * 60 * 60 * 1000
  return t <= limit
}

export type SiteParcChip =
  | { kind: 'contrat'; label: string; cls: string }
  | { kind: 'travaux'; label: string; cls: string }
  | { kind: 'controle'; label: string; cls: string }
  | { kind: 'termine'; label: string; cls: string }
  | { kind: 'archive'; label: string; cls: string }

/** Badge d’état parc pour les cartes. */
export function siteParcChip(site: Site): SiteParcChip {
  if (site.statut === 'termine') {
    return { kind: 'termine', label: 'Terminé', cls: 'bg-sky-100 text-sky-800' }
  }
  if (site.statut === 'archive') {
    return { kind: 'archive', label: 'Archivé', cls: 'bg-slate-100 text-slate-600' }
  }
  if (resolveModeGestion(site) === 'ponctuel') {
    return { kind: 'travaux', label: 'Travaux / dépannage', cls: 'bg-amber-100 text-amber-900' }
  }
  if (controleEtancheiteSoon(site)) {
    return { kind: 'controle', label: 'Contrôle à venir', cls: 'bg-sky-100 text-sky-800' }
  }
  return { kind: 'contrat', label: 'Sous contrat', cls: 'bg-emerald-100 text-emerald-800' }
}

export function siteHasCerfaASigner(siteId: string, interventions: CerfaDraft[]): boolean {
  return interventions.some(
    (i) =>
      i.chantierId === siteId &&
      (i.status === 'brouillon' || !i.signatureDetenteurImage || !i.signatureOperateurImage),
  )
}
