/**
 * Étalonnage outillage — date du dernier contrôle + 1 an, alerte 45 j avant.
 */
import type { Outillage } from './types'
import { isDetecteurControleExpire } from './types'
import {
  OUTILLAGE_CATALOG,
  outillageNeedsControleDate,
  outillageTypeLabel,
  type OutillageTypeId,
} from './outillageCatalog'
import { daysUntilIso } from './rhDocuments'

/** Même seuil que les documents RH (accueil). */
export const ALERTE_ETALONNAGE_JOURS = 45

export type StatutEtalonnage = 'ok' | 'bientot' | 'expire' | 'sans_date'

export type AlerteEtalonnage = {
  outillageId: string
  type: OutillageTypeId | string
  label: string
  identification: string
  assigneeUserId?: string
  assigneeName?: string
  controleDate?: string
  dateFin?: string
  statut: Exclude<StatutEtalonnage, 'ok'>
  daysUntil?: number | null
}

/** Date de fin = dernier étalonnage + 1 an (AAAA-MM-JJ). */
export function dateFinEtalonnage(controleDate?: string): string | undefined {
  const raw = (controleDate || '').trim().slice(0, 10)
  if (!raw) return undefined
  const d = new Date(`${raw}T12:00:00`)
  if (Number.isNaN(d.getTime())) return undefined
  d.setFullYear(d.getFullYear() + 1)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function statutEtalonnage(controleDate?: string, now = new Date()): StatutEtalonnage {
  if (!(controleDate || '').trim()) return 'sans_date'
  if (isDetecteurControleExpire(controleDate, now)) return 'expire'
  const fin = dateFinEtalonnage(controleDate)
  const days = fin ? daysUntilIso(fin, now) : null
  if (days != null && days <= ALERTE_ETALONNAGE_JOURS) return 'bientot'
  return 'ok'
}

export function labelStatutEtalonnage(statut: StatutEtalonnage): string {
  if (statut === 'expire') return 'Étalonnage expiré'
  if (statut === 'bientot') return 'Étalonnage bientôt'
  if (statut === 'sans_date') return 'Date d’étalonnage manquante'
  return 'Étalonnage à jour'
}

export function alertesEtalonnage(
  outillages: Outillage[] | undefined,
  opts?: { userId?: string | null; now?: Date },
): AlerteEtalonnage[] {
  const now = opts?.now || new Date()
  const list = outillages || []
  const scoped = opts?.userId ? list.filter((o) => o.assigneeUserId === opts.userId) : list
  const alerts: AlerteEtalonnage[] = []

  for (const o of scoped) {
    if (!outillageNeedsControleDate(o.type)) continue
    const statut = statutEtalonnage(o.controleDate, now)
    if (statut === 'ok') continue
    const fin = dateFinEtalonnage(o.controleDate)
    alerts.push({
      outillageId: o.id,
      type: o.type,
      label: outillageTypeLabel(o.type),
      identification: o.identification,
      assigneeUserId: o.assigneeUserId,
      assigneeName: o.assigneeName,
      controleDate: o.controleDate,
      dateFin: fin,
      statut,
      daysUntil: fin ? daysUntilIso(fin, now) : null,
    })
  }

  const order: Record<Exclude<StatutEtalonnage, 'ok'>, number> = {
    expire: 0,
    sans_date: 1,
    bientot: 2,
  }
  return alerts.sort((a, b) => order[a.statut] - order[b.statut])
}

export function countOutillageEtalonnage(): number {
  return (Object.keys(OUTILLAGE_CATALOG) as OutillageTypeId[]).filter((id) =>
    Boolean(OUTILLAGE_CATALOG[id].needsControleDate),
  ).length
}
