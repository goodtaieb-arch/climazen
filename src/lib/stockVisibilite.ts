/**
 * Visibilité stock fluides (bouteilles) : tech = sa voiture ; bureau = atelier + tous les vans + agences.
 */

import type { StockItem } from './types'
import { isBouteilleRetournee } from './types'
import { parseAgenceCode, matchAgenceFilter, labelAgence } from './agences'
import { dossierForUser, type PersonnelDossier } from './rhDocuments'

export type StockFluideParEmplacement = {
  atelier: StockItem[]
  /** Bouteilles en véhicule, regroupées par technicien. */
  vehiculesParTech: Array<{ techLabel: string; techId?: string; bouteilles: StockItem[] }>
}

export function emplacementStock(s: Pick<StockItem, 'emplacement'>): 'atelier' | 'vehicule' {
  return s.emplacement === 'vehicule' ? 'vehicule' : 'atelier'
}

/** Agence d’une bouteille : champ direct, sinon agence du tech assigné. */
export function agenceOfBouteille(
  item: Pick<StockItem, 'agenceCode' | 'assigneeUserId' | 'emplacement'>,
  dossiers?: PersonnelDossier[] | null,
): string | undefined {
  const direct = parseAgenceCode(item.agenceCode)
  if (direct) return direct
  if (emplacementStock(item) === 'vehicule' && item.assigneeUserId) {
    const d = dossierForUser(dossiers ?? undefined, item.assigneeUserId)
    return parseAgenceCode(d?.agenceCode)
  }
  return undefined
}

export function stockFluidesParEmplacement(
  items: StockItem[] | undefined,
): StockFluideParEmplacement {
  const atelier: StockItem[] = []
  const vehMap = new Map<string, { techLabel: string; techId?: string; bouteilles: StockItem[] }>()

  for (const s of items || []) {
    if (isBouteilleRetournee(s)) continue
    if (emplacementStock(s) === 'vehicule') {
      const techLabel = (s.assigneeName || s.assigneeUserId || 'Technicien non assigné').trim()
      const key = s.assigneeUserId || `name:${techLabel}`
      const cur = vehMap.get(key) || { techLabel, techId: s.assigneeUserId, bouteilles: [] }
      cur.bouteilles.push(s)
      vehMap.set(key, cur)
    } else {
      atelier.push(s)
    }
  }

  const vehiculesParTech = [...vehMap.values()].sort((a, b) =>
    a.techLabel.localeCompare(b.techLabel, 'fr'),
  )
  return { atelier, vehiculesParTech }
}

export function kgStockFluides(items: StockItem[]): number {
  return Math.round(items.reduce((sum, b) => sum + (Number(b.quantiteKg) || 0), 0) * 1000) / 1000
}

/**
 * Scope lecture :
 * - terrain : uniquement son véhicule (pas l’atelier des autres ni les autres vans)
 * - bureau : tout, filtrable agence / tech
 */
export function filtreStockFluidesPourViewer(opts: {
  stock: StockItem[] | undefined
  mode: 'terrain' | 'bureau'
  userId?: string | null
  /** Bureau : filtre tech (véhicule de ce tech uniquement ; atelier exclu si tech choisi). */
  techId?: string | null
  /** Bureau : codes agence sélectionnés (vide = toutes). */
  agenceCodes?: string[]
  dossiers?: PersonnelDossier[] | null
  /** Inclure bouteilles retournées (défaut false). */
  includeRetournees?: boolean
}): StockItem[] {
  const list = (opts.stock || []).filter((s) =>
    opts.includeRetournees ? true : !isBouteilleRetournee(s),
  )

  if (opts.mode === 'terrain') {
    const uid = opts.userId || ''
    if (!uid) return []
    return list.filter(
      (s) => emplacementStock(s) === 'vehicule' && s.assigneeUserId === uid,
    )
  }

  let out = list
  if (opts.techId) {
    out = out.filter(
      (s) => emplacementStock(s) === 'vehicule' && s.assigneeUserId === opts.techId,
    )
  }
  if (opts.agenceCodes && opts.agenceCodes.length > 0) {
    out = out.filter((s) =>
      matchAgenceFilter(agenceOfBouteille(s, opts.dossiers), opts.agenceCodes),
    )
  }
  return out
}

export type ResumeStockFluides = {
  atelierKg: number
  vehiculesKg: number
  totalKg: number
  atelierCount: number
  vehiculesCount: number
  parAgence: Array<{
    agenceCode: string
    label: string
    atelierKg: number
    vehiculesKg: number
    totalKg: number
  }>
}

export function resumeStockFluides(
  items: StockItem[],
  dossiers?: PersonnelDossier[] | null,
): ResumeStockFluides {
  const actifs = items.filter((s) => !isBouteilleRetournee(s))
  const { atelier, vehiculesParTech } = stockFluidesParEmplacement(actifs)
  const vans = vehiculesParTech.flatMap((v) => v.bouteilles)
  const atelierKg = kgStockFluides(atelier)
  const vehiculesKg = kgStockFluides(vans)

  const byAg = new Map<
    string,
    { atelierKg: number; vehiculesKg: number }
  >()
  const bump = (code: string | undefined, kind: 'atelier' | 'vehicule', kg: number) => {
    const key = code || 'sans'
    const cur = byAg.get(key) || { atelierKg: 0, vehiculesKg: 0 }
    if (kind === 'atelier') cur.atelierKg += kg
    else cur.vehiculesKg += kg
    byAg.set(key, cur)
  }
  for (const s of atelier) {
    bump(agenceOfBouteille(s, dossiers), 'atelier', Number(s.quantiteKg) || 0)
  }
  for (const s of vans) {
    bump(agenceOfBouteille(s, dossiers), 'vehicule', Number(s.quantiteKg) || 0)
  }

  const parAgence = [...byAg.entries()]
    .map(([agenceCode, v]) => ({
      agenceCode,
      label:
        agenceCode === 'sans'
          ? 'Sans agence'
          : labelAgence(agenceCode) || agenceCode,
      atelierKg: Math.round(v.atelierKg * 1000) / 1000,
      vehiculesKg: Math.round(v.vehiculesKg * 1000) / 1000,
      totalKg: Math.round((v.atelierKg + v.vehiculesKg) * 1000) / 1000,
    }))
    .sort((a, b) => a.label.localeCompare(b.label, 'fr'))

  return {
    atelierKg,
    vehiculesKg,
    totalKg: Math.round((atelierKg + vehiculesKg) * 1000) / 1000,
    atelierCount: atelier.length,
    vehiculesCount: vans.length,
    parAgence,
  }
}
