import type { StockItem } from './types'

export type TypeHuile = NonNullable<StockItem['typeHuile']>

export const TYPE_HUILE_LABELS: Record<TypeHuile, string> = {
  POE: 'POE (synthèse)',
  PAG: 'PAG',
  MO: 'MO (minérale)',
  AB: 'AB (alkylbenzène)',
  autre: 'Autre',
  inconnu: 'Inconnu / non renseigné',
}

export function isBouteilleReepreuveExpiree(
  item: Pick<StockItem, 'dateReepreuvage'>,
  refDate = new Date(),
): boolean {
  const d = item.dateReepreuvage?.trim()
  if (!d) return false
  const end = new Date(d)
  if (Number.isNaN(end.getTime())) return false
  const ref = new Date(refDate)
  ref.setHours(0, 0, 0, 0)
  end.setHours(0, 0, 0, 0)
  return ref > end
}

export function isBouteilleReepreuveBientot(
  item: Pick<StockItem, 'dateReepreuvage'>,
  jours = 90,
  refDate = new Date(),
): boolean {
  const d = item.dateReepreuvage?.trim()
  if (!d || isBouteilleReepreuveExpiree(item, refDate)) return false
  const end = new Date(d)
  if (Number.isNaN(end.getTime())) return false
  const limit = new Date(refDate)
  limit.setDate(limit.getDate() + jours)
  return end <= limit
}

export function joursEnPossession(
  item: Pick<StockItem, 'dateEntreePossession' | 'retourneAt'>,
  refDate = new Date(),
): number | null {
  const start = item.dateEntreePossession?.trim()
  if (!start) return null
  const from = new Date(start)
  if (Number.isNaN(from.getTime())) return null
  const to = item.retourneAt ? new Date(item.retourneAt) : new Date(refDate)
  if (Number.isNaN(to.getTime())) return null
  from.setHours(0, 0, 0, 0)
  to.setHours(0, 0, 0, 0)
  return Math.max(0, Math.round((to.getTime() - from.getTime()) / 86_400_000))
}

export function alerteConsigneJours(
  item: Pick<StockItem, 'dateEntreePossession' | 'seuilAlerteConsigneJours' | 'retourneAt'>,
): { jours: number; seuil: number; alerte: boolean } | null {
  if (item.retourneAt) return null
  const jours = joursEnPossession(item)
  if (jours == null) return null
  const seuil = Number(item.seuilAlerteConsigneJours) > 0 ? Number(item.seuilAlerteConsigneJours) : 30
  return { jours, seuil, alerte: jours >= seuil }
}

/** Quantité fluide = poids brut balance − tare. */
export function quantiteDepuisPesee(poidsBrutKg: number, tareKg: number): number {
  const q = Math.round(((Number(poidsBrutKg) || 0) - (Number(tareKg) || 0)) * 1000) / 1000
  return Math.max(0, q)
}

export function conflitHuile(
  huileBouteille: TypeHuile | undefined,
  huileNouvelle: TypeHuile | undefined,
): boolean {
  if (!huileBouteille || !huileNouvelle) return false
  if (huileBouteille === 'inconnu' || huileNouvelle === 'inconnu') return false
  return huileBouteille !== huileNouvelle
}
