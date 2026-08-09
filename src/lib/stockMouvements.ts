import { v4 as uuid } from 'uuid'
import type { AppData, CerfaDraft, ContenantType, StockItem, StockMouvement, StockMouvementSens } from './types'
import { cerfaLabelFor, sensMouvementPourContenant } from './types'
import { sameFluideCode } from './fluides'

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
  const denomination = (intervention.fluideType || '').trim()
  for (const m of manip) {
    const idx = stock.findIndex((s) => s.id === m.stockItemId)
    if (idx < 0) throw new Error('Bouteille introuvable dans le stock.')
    const item = stock[idx]
    if (denomination && !sameFluideCode(item.fluide, denomination)) {
      throw new Error(
        `Bouteille ${item.numeroContenant} (${item.fluide}) ≠ dénomination fluide ${denomination}. Même gaz obligatoire.`,
      )
    }
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
          kind: 'cerfa',
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
          kind: 'cerfa',
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
  interventionId?: string
  cerfaLabel: string
  createdByName?: string
  date: string
  kind?: StockMouvement['kind']
  note?: string
  bonRetourReference?: string
  tiersNom?: string
  documentReference?: string
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
    kind: opts.kind ?? (opts.interventionId ? 'cerfa' : undefined),
    note: opts.note,
    bonRetourReference: opts.bonRetourReference,
    tiersNom: opts.tiersNom,
    documentReference: opts.documentReference,
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

/**
 * Enregistre le bon de retour de consigne d’une bouteille neuve vide.
 * Conserve la preuve pour crédit fournisseur + contrôle attestation de capacité.
 */
export function enregistrerRetourConsigne(
  data: AppData,
  opts: {
    stockItemId: string
    bonRetourConsigne: string
    bonRetourDate: string
    bonRetourFournisseur?: string
    bonRetourNotes?: string
    createdByName?: string
  },
): AppData {
  const ref = opts.bonRetourConsigne.trim()
  if (!ref) throw new Error('N° du bon de retour de consigne obligatoire.')
  const idx = data.stock.findIndex((s) => s.id === opts.stockItemId)
  if (idx < 0) throw new Error('Bouteille introuvable.')
  const item = data.stock[idx]
  if (item.contenantType !== 'vierge') {
    throw new Error('Le bon de retour de consigne concerne les bouteilles neuves (vierges).')
  }
  if ((Number(item.quantiteKg) || 0) > 1e-9) {
    throw new Error('La bouteille n’est pas vide — terminez d’abord le fluide avant le retour.')
  }
  if (item.bonRetourConsigne?.trim()) {
    throw new Error(`Retour déjà enregistré : ${item.bonRetourConsigne}.`)
  }

  const now = new Date().toISOString()
  const date = opts.bonRetourDate || now.slice(0, 10)
  const nextItem: StockItem = {
    ...item,
    quantiteKg: 0,
    bonRetourConsigne: ref,
    bonRetourDate: date,
    bonRetourFournisseur: opts.bonRetourFournisseur?.trim() || undefined,
    bonRetourNotes: opts.bonRetourNotes?.trim() || undefined,
    retourneAt: now,
    updatedAt: now,
  }

  const mouvement: StockMouvement = {
    id: uuid(),
    stockItemId: item.id,
    numeroContenant: item.numeroContenant,
    fluide: item.fluide,
    sens: 'sortie',
    quantiteKg: 0,
    quantiteAvantKg: 0,
    quantiteApresKg: 0,
    date,
    cerfaLabel: `BON-RETOUR-${ref}`,
    createdByName: opts.createdByName,
    kind: 'retour_consigne',
    bonRetourReference: ref,
    tiersNom: opts.bonRetourFournisseur?.trim() || undefined,
    documentReference: ref,
    note: [
      'Retour consigne / emballage réutilisable vide',
      opts.bonRetourFournisseur?.trim() ? `Fournisseur : ${opts.bonRetourFournisseur.trim()}` : '',
      opts.bonRetourNotes?.trim() || '',
    ]
      .filter(Boolean)
      .join(' · '),
  }

  const stock = data.stock.map((s, i) => (i === idx ? nextItem : s))
  return {
    ...data,
    stock,
    stockMouvements: [...(data.stockMouvements || []), mouvement],
  }
}

/**
 * Entrée de fluide neuf (achat / BL fournisseur) — bouteille vierge ou régénérée.
 * Crée la bouteille et un mouvement `achat` daté précisément.
 */
export function enregistrerAchat(
  data: AppData,
  opts: {
    fluide: string
    contenantType?: ContenantType
    numeroContenant: string
    quantiteKg: number
    date: string
    fournisseur?: string
    documentReference?: string
    bsffReference?: string
    codeUn?: string
    denominationAdr?: string
    notes?: string
    createdByName?: string
  },
): AppData {
  const numero = opts.numeroContenant.trim()
  if (!numero) throw new Error('N° de bouteille obligatoire.')
  const qty = roundKg(Number(opts.quantiteKg) || 0)
  if (qty <= 0) throw new Error('Quantité achetée (kg) obligatoire.')
  const type = opts.contenantType || 'vierge'
  if (type === 'recuperation') {
    throw new Error('Un achat concerne une bouteille neuve (vierge) ou régénérée, pas récupération.')
  }
  if (data.stock.some((s) => s.numeroContenant.trim().toLowerCase() === numero.toLowerCase())) {
    throw new Error(`Une bouteille ${numero} existe déjà dans le stock.`)
  }

  const now = new Date().toISOString()
  const date = opts.date || now.slice(0, 10)
  const item: StockItem = {
    id: uuid(),
    fluide: opts.fluide.trim(),
    contenantType: type,
    numeroContenant: numero,
    quantiteKg: qty,
    quantiteInitialeKg: qty,
    bsffReference: opts.bsffReference?.trim() || undefined,
    codeUn: opts.codeUn?.trim() || undefined,
    denominationAdr: opts.denominationAdr?.trim() || undefined,
    notes: opts.notes?.trim() || undefined,
    updatedAt: now,
  }

  const ref = opts.documentReference?.trim()
  const fournisseur = opts.fournisseur?.trim()
  const mouvement = makeMouvement({
    item,
    sens: 'entree',
    quantiteKg: qty,
    quantiteAvantKg: 0,
    quantiteApresKg: qty,
    date,
    cerfaLabel: ref ? `ACHAT-${ref}` : `ACHAT-${date}-${numero}`,
    createdByName: opts.createdByName,
    kind: 'achat',
    tiersNom: fournisseur,
    documentReference: ref,
    note: [
      'Achat fluide neuf',
      fournisseur ? `Fournisseur : ${fournisseur}` : '',
      ref ? `BL / doc. : ${ref}` : '',
    ]
      .filter(Boolean)
      .join(' · '),
  })

  return {
    ...data,
    stock: [...data.stock, item],
    stockMouvements: [...(data.stockMouvements || []), mouvement],
  }
}

/**
 * Destruction / remise à une installation agréée (fluide usagé / récupéré).
 * Sortie stock avec date précise + traçabilité (BSFF, centre).
 */
export function enregistrerDestruction(
  data: AppData,
  opts: {
    stockItemId: string
    quantiteKg: number
    date: string
    centreDestruction?: string
    documentReference?: string
    notes?: string
    createdByName?: string
  },
): AppData {
  const idx = data.stock.findIndex((s) => s.id === opts.stockItemId)
  if (idx < 0) throw new Error('Bouteille introuvable.')
  const item = data.stock[idx]
  const qty = roundKg(Number(opts.quantiteKg) || 0)
  if (qty <= 0) throw new Error('Quantité à détruire (kg) obligatoire.')
  if (qty > item.quantiteKg + 1e-9) {
    throw new Error(`Stock insuffisant : reste ${item.quantiteKg} kg.`)
  }

  const now = new Date().toISOString()
  const date = opts.date || now.slice(0, 10)
  const apres = roundKg(item.quantiteKg - qty)
  const centre = opts.centreDestruction?.trim()
  const ref = opts.documentReference?.trim() || item.bsffReference?.trim()

  const nextItem: StockItem = {
    ...item,
    quantiteKg: apres,
    updatedAt: now,
    ...(ref && !item.bsffReference ? { bsffReference: ref } : {}),
  }

  const mouvement = makeMouvement({
    item,
    sens: 'sortie',
    quantiteKg: qty,
    quantiteAvantKg: item.quantiteKg,
    quantiteApresKg: apres,
    date,
    cerfaLabel: ref ? `DEST-${ref}` : `DEST-${date}-${item.numeroContenant}`,
    createdByName: opts.createdByName,
    kind: 'destruction',
    tiersNom: centre,
    documentReference: ref,
    note: [
      'Destruction / traitement agréé',
      centre ? `Centre : ${centre}` : '',
      ref ? `BSFF / doc. : ${ref}` : '',
      opts.notes?.trim() || '',
    ]
      .filter(Boolean)
      .join(' · '),
  })

  return {
    ...data,
    stock: data.stock.map((s, i) => (i === idx ? nextItem : s)),
    stockMouvements: [...(data.stockMouvements || []), mouvement],
  }
}
