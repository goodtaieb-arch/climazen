/**
 * Qui fait quoi sur le parcours OT (appel → intervention).
 *
 * - Tech qui crée (auto-entrepreneur, astreinte) : affecté à lui, il remplit l’intervention.
 * - Bureau qui prépare pour un autre tech :
 *   - dépannage → pas l’étape 5 (le tech l’ouvre sur place)
 *   - maintenance → étape 5 pour cocher les fiches que le tech doit remplir
 * - CERFA toujours accessible ; obligatoire si le tech touche au gaz / fluide.
 */

import {
  type OrdreTravail,
  type ParcoursAppelStepId,
  type TypeOt,
} from './ordreTravail'
import { isBureauUi, type UiAccess } from './uiMode'

export type DocOtRequis = 'cerfa' | 'fiche_clim' | 'fiche_chaufferie' | 'fiche_cta_vmc'

export const DOCS_OT_REQUIS: readonly DocOtRequis[] = [
  'cerfa',
  'fiche_clim',
  'fiche_chaufferie',
  'fiche_cta_vmc',
] as const

export const DOC_OT_LABELS: Record<DocOtRequis, string> = {
  cerfa: 'CERFA (fluide / gaz)',
  fiche_clim: 'Fiche checklist clim',
  fiche_chaufferie: 'Fiche chaufferie P2/P3',
  fiche_cta_vmc: 'Fiche CTA / VMC',
}

export function parseDocsOtRequis(raw: unknown): DocOtRequis[] {
  if (!Array.isArray(raw)) return []
  const seen = new Set<DocOtRequis>()
  for (const x of raw) {
    const id = String(x || '').trim() as DocOtRequis
    if ((DOCS_OT_REQUIS as readonly string[]).includes(id)) seen.add(id)
  }
  return DOCS_OT_REQUIS.filter((d) => seen.has(d))
}

export function toggleDocOtRequis(list: DocOtRequis[] | undefined, id: DocOtRequis): DocOtRequis[] {
  const cur = parseDocsOtRequis(list)
  return cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]
}

/** Maintenance / entretien / contrôle d’étanchéité : le bureau prépare les fiches. */
export function otEstMaintenancePreparee(typeOt: TypeOt | string | undefined): boolean {
  return (
    typeOt === 'maintenance' || typeOt === 'entretien' || typeOt === 'controle_etancheite'
  )
}

export function estTechIntervenant(
  ot: Pick<OrdreTravail, 'technicienUserId'>,
  userId?: string | null,
): boolean {
  const uid = String(userId || '').trim()
  const tech = String(ot.technicienUserId || '').trim()
  if (!uid || !tech) return false
  return uid === tech
}

/**
 * Gérant / secrétariat qui prépare l’OT pour un autre.
 * Si le bureau s’affecte lui-même (auto-entrepreneur, gérant qui sort), ce n’est pas ce cas.
 */
export function estBureauQuiPreparePourUnTech(
  access: UiAccess,
  ot: Pick<OrdreTravail, 'technicienUserId'>,
  userId?: string | null,
): boolean {
  if (!isBureauUi(access)) return false
  return !estTechIntervenant(ot, userId)
}

export type RoleParcoursOt = 'intervenant' | 'bureau_depanage' | 'bureau_maintenance'

export function roleParcoursOt(
  access: UiAccess,
  ot: Pick<OrdreTravail, 'technicienUserId' | 'typeOt'>,
  userId?: string | null,
): RoleParcoursOt {
  if (!estBureauQuiPreparePourUnTech(access, ot, userId)) return 'intervenant'
  return otEstMaintenancePreparee(ot.typeOt) ? 'bureau_maintenance' : 'bureau_depanage'
}

export function peutAccederEtapeIntervention(
  access: UiAccess,
  ot: Pick<OrdreTravail, 'technicienUserId' | 'typeOt'>,
  userId?: string | null,
): boolean {
  return roleParcoursOt(access, ot, userId) !== 'bureau_depanage'
}

/** CERFA obligatoire : le tech a touché au gaz, ou équipement fluide (sauf s’il dit non). */
export function techDoitRemplirCerfa(opts: {
  hasFluide: boolean
  toucheGaz?: boolean
}): boolean {
  if (opts.toucheGaz === false) return false
  if (opts.toucheGaz === true) return true
  return Boolean(opts.hasFluide)
}

export function docsEffectifsRequis(opts: {
  docsRequis?: unknown
  hasFluide: boolean
  toucheGaz?: boolean
}): DocOtRequis[] {
  const set = new Set(parseDocsOtRequis(opts.docsRequis))
  if (techDoitRemplirCerfa(opts)) set.add('cerfa')
  return DOCS_OT_REQUIS.filter((d) => set.has(d))
}

export type DocsOtRemplis = Partial<Record<DocOtRequis, boolean>>

export function docsManquantsPourCloture(opts: {
  docsRequis?: unknown
  hasFluide: boolean
  toucheGaz?: boolean
  remplis: DocsOtRemplis
}): DocOtRequis[] {
  return docsEffectifsRequis(opts).filter((d) => !opts.remplis[d])
}

export function inferParcoursStepPourRole(
  ot: OrdreTravail,
  role: RoleParcoursOt,
): ParcoursAppelStepId {
  if (role === 'bureau_depanage') {
    if (!ot.action?.trim()) return 'ot'
    if (!ot.clientId) return 'client'
    if (!ot.chantierId) return 'site'
    return 'equipement'
  }
  if (ot.parcoursStep === 'docs') return 'docs'
  if (!ot.action?.trim()) return 'ot'
  if (!ot.clientId) return 'client'
  if (!ot.chantierId) return 'site'
  if (!ot.equipementId && !(ot.equipementIds && ot.equipementIds.length > 0)) return 'equipement'
  return 'docs'
}
