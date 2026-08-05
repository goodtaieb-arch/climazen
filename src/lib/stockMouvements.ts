import { v4 as uuid } from 'uuid'
import type { AppData, CerfaDraft, ContenantType, StockItem, StockMouvement, StockMouvementSens } from './types'
import { cerfaLabelFor, sensMouvementPourContenant } from './types'

function roundKg(n: number) {
  return Math.round(n * 1000) / 1000
}

function resolveSens(
  type: ContenantType,
  explicit?: StockMouvementSens,
): StockMouvementSens {
  return explicit || sensMouvementPourContenant(type)
}

/**
 * Applique (ou réapplique) les mouvements stock d’une fiche CERFA.
 * Bouteille neuve → sorties partielles ; bouteille récup → entrées et/ou sorties.
 * Chaque ligne est liée au n° CERFA. Réenregistrement = annulation puis recalcul.
 */
export function applyStockFromIntervention(
  data: AppData,
  intervention: CerfaDraft,
  opts?: { createdByName?: string },
): AppData {
  const manip = (intervention.manipulations || []).filter(
    (m) => m.stockItemId && m.quantiteKg > 0,
  )
  const hadPrevious = (data.stockMouvements || []).some((m) => m.interventionId === intervention.id)
  if (manip.length === 0 && !hadPrevious) return data

  let stock = data.stock.map((s) => ({ ...s }))

  // 1) Annuler les mouvements déjà liés à cette intervention
  const previous = (data.stockMouvements || []).filter((m) => m.interventionId === intervention.id)
  for (const m of previous) {
    const idx = stock.findIndex((s) => s.id === m.stockItemId)
    if (idx < 0) continue
    const delta = m.sens === 'sortie' ? m.quantiteKg : -m.quantiteKg
    stock[idx] = {
      ...stock[idx],
      quantiteKg: roundKg(Math.max(0, stock[idx].quantiteKg + delta)),
      updatedAt: new Date().toISOString(),
    }
  }

  let mouvements = (data.stockMouvements || []).filter((m) => m.interventionId !== intervention.id)
  const label = cerfaLabelFor(intervention)
  const now = new Date().toISOString()
  const date = intervention.dateIntervention || now.slice(0, 10)

  // 2) Appliquer les nouveaux mouvements
  for (const m of manip) {
    const idx = stock.findIndex((s) => s.id === m.stockItemId)
    if (idx < 0) throw new Error('Bouteille introuvable dans le stock.')
    const item = stock[idx]
    const sens = resolveSens(m.type || item.contenantType, m.sens)
    const qty = roundKg(m.quantiteKg)
    const avant = item.quantiteKg

    if (sens === 'sortie') {
      if (qty > avant + 1e-9) {
        throw new Error(
          `Stock insuffisant sur ${item.numeroContenant} : reste ${avant} kg, demandé ${qty} kg.`,
        )
      }
      const apres = roundKg(avant - qty)
      stock[idx] = { ...item, quantiteKg: apres, updatedAt: now }
      mouvements.push(
        makeMouvement({
          item,
          sens: 'sortie',
          quantiteKg: qty,
          quantiteAvantKg: avant,
          quantiteApresKg: apres,
          interventionId: intervention.id,
          cerfaLabel: label,
          createdByName: opts?.createdByName,
          date,
        }),
      )
    } else {
      const apres = roundKg(avant + qty)
      stock[idx] = { ...item, quantiteKg: apres, updatedAt: now }
      mouvements.push(
        makeMouvement({
          item,
          sens: 'entree',
          quantiteKg: qty,
          quantiteAvantKg: avant,
          quantiteApresKg: apres,
          interventionId: intervention.id,
          cerfaLabel: label,
          createdByName: opts?.createdByName,
          date,
        }),
      )
    }
  }

  return { ...data, stock, stockMouvements: mouvements }
}

function makeMouvement(opts: {
  item: StockItem
  sens: StockMouvementSens
  quantiteKg: number
  quantiteAvantKg: number
  quantiteApresKg: number
  interventionId: string
  cerfaLabel: string
  createdByName?: string
  date: string
}): StockMouvement {
  return {
    id: uuid(),
    stockItemId: opts.item.id,
    numeroContenant: opts.item.numeroContenant,
    fluide: opts.item.fluide,
    sens: opts.sens,
    quantiteKg: opts.quantiteKg,
    quantiteAvantKg: opts.quantiteAvantKg,
    quantiteApresKg: opts.quantiteApresKg,
    date: opts.date,
    interventionId: opts.interventionId,
    cerfaLabel: opts.cerfaLabel,
    createdByName: opts.createdByName,
  }
}

/** Restaure le stock si on supprime une fiche CERFA. */
export function revertStockForIntervention(data: AppData, interventionId: string): AppData {
  const previous = (data.stockMouvements || []).filter((m) => m.interventionId === interventionId)
  if (previous.length === 0) return data

  let stock = data.stock.map((s) => ({ ...s }))
  for (const m of previous) {
    const idx = stock.findIndex((s) => s.id === m.stockItemId)
    if (idx < 0) continue
    const delta = m.sens === 'sortie' ? m.quantiteKg : -m.quantiteKg
    stock[idx] = {
      ...stock[idx],
      quantiteKg: roundKg(Math.max(0, stock[idx].quantiteKg + delta)),
      updatedAt: new Date().toISOString(),
    }
  }
  return {
    ...data,
    stock,
    stockMouvements: (data.stockMouvements || []).filter((m) => m.interventionId !== interventionId),
  }
}

export function mouvementsForBottle(data: AppData, stockItemId: string): StockMouvement[] {
  return (data.stockMouvements || [])
    .filter((m) => m.stockItemId === stockItemId)
    .sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id))
}
