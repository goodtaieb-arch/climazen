import { v4 as uuid } from 'uuid'
import type { AppData, CerfaDraft, ContenantType, StockItem, StockMouvement, StockMouvementSens } from './types'
import { cerfaLabelFor, isBouteilleRetournee, sensMouvementPourContenant } from './types'
import { adrInfoForFluide, findFluide, isFluideNonAssigne, sameFluideCode } from './fluides'
import { BOUTEILLE_DEFAULTS, bouteilleDefaultsForFluide } from './bouteilleDefaults'
import { assertMouvementCerfaLegal } from './stockRegles'
import { sameOtNumero } from './ordreTravail'

function roundKg(n: number) {
  return Math.round(n * 1000) / 1000
}

function resolveSens(
  type: ContenantType,
  explicit?: StockMouvementSens,
): StockMouvementSens {
  return explicit || sensMouvementPourContenant(type)
}

function isCerfaMouvement(m: StockMouvement): boolean {
  return m.kind === 'cerfa' || (!m.kind && Boolean(m.interventionId))
}

/**
 * Fiches CERFA « même logique » : même OT + même équipement (ou même n° OT).
 * Sert à annuler le stock déjà déduit si on revalide après correction / doublon.
 */
export function relatedCerfaInterventionIds(
  data: AppData,
  intervention: Pick<CerfaDraft, 'id' | 'ordreTravailId' | 'equipementId' | 'numeroIntervention'>,
): Set<string> {
  const ids = new Set<string>([intervention.id])
  const otId = intervention.ordreTravailId
  const eqId = intervention.equipementId
  const num = (intervention.numeroIntervention || '').trim()

  for (const i of data.interventions || []) {
    if (i.id === intervention.id) continue
    // Multi-équipements : ne pas annuler le CERFA du voisin
    if (eqId && i.equipementId && i.equipementId !== eqId) continue
    if (otId && i.ordreTravailId === otId) {
      ids.add(i.id)
      continue
    }
    if (num && sameOtNumero(i.numeroIntervention, num)) {
      ids.add(i.id)
    }
  }
  return ids
}

/** Mouvements CERFA déjà appliqués pour cette fiche (y compris doublons OT+équipement). */
export function previousCerfaMouvements(
  data: AppData,
  intervention: Pick<CerfaDraft, 'id' | 'ordreTravailId' | 'equipementId' | 'numeroIntervention'>,
): StockMouvement[] {
  const related = relatedCerfaInterventionIds(data, intervention)
  return (data.stockMouvements || []).filter(
    (m) => m.interventionId && related.has(m.interventionId) && isCerfaMouvement(m),
  )
}

/**
 * Quantité disponible sur une bouteille après annulation des mouvements CERFA
 * déjà liés à cette fiche (pour contrôle avant re-validation).
 */
export function stockKgAfterCerfaRevert(
  data: AppData,
  intervention: Pick<CerfaDraft, 'id' | 'ordreTravailId' | 'equipementId' | 'numeroIntervention'>,
  stockItemId: string,
): number {
  const item = data.stock.find((s) => s.id === stockItemId)
  if (!item) return 0
  let qty = Number(item.quantiteKg) || 0
  for (const m of previousCerfaMouvements(data, intervention)) {
    if (m.stockItemId !== stockItemId) continue
    qty += m.sens === 'sortie' ? m.quantiteKg : -m.quantiteKg
  }
  return roundKg(Math.max(0, qty))
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
  const previous = previousCerfaMouvements(data, intervention)
  const relatedIds = relatedCerfaInterventionIds(data, intervention)
  if (manip.length === 0 && previous.length === 0) return data

  let stock = data.stock.map((s) => ({ ...s }))

  // 1) Annuler les mouvements déjà liés à cette fiche (même id OU doublon OT+équipement)
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

  let mouvements = (data.stockMouvements || []).filter((m) => {
    if (!m.interventionId || !relatedIds.has(m.interventionId)) return true
    if (!isCerfaMouvement(m)) return true
    return false
  })
  const label = cerfaLabelFor(intervention)
  const now = new Date().toISOString()
  const date = intervention.dateIntervention || now.slice(0, 10)

    // 2) Appliquer les nouveaux mouvements
  const denomination = (intervention.fluideType || '').trim()
  for (const m of manip) {
    const idx = stock.findIndex((s) => s.id === m.stockItemId)
    if (idx < 0) throw new Error('Bouteille introuvable dans le stock.')
    let item = stock[idx]
    const sens = resolveSens(m.type || item.contenantType, m.sens)
    const qty = roundKg(m.quantiteKg)
    const avant = item.quantiteKg

    // Capacité nominale manquante → défaut 12,5 kg (modifiable ensuite dans Stock)
    if (
      (item.contenantType === 'recuperation' || item.contenantType === 'recycle') &&
      !(Number(item.capaciteMaxKg) > 0)
    ) {
      const defs = bouteilleDefaultsForFluide(item.fluide || denomination)
      item = {
        ...item,
        capaciteMaxKg: defs.capaciteMaxKg || BOUTEILLE_DEFAULTS.capaciteMaxKg,
        updatedAt: now,
      }
      stock[idx] = item
    }

    // 1er CERFA sur récup. non assignée : verrouille le fluide de l’intervention
    if (
      sens === 'entree' &&
      item.contenantType === 'recuperation' &&
      isFluideNonAssigne(item.fluide) &&
      denomination
    ) {
      const code = findFluide(denomination)?.code || denomination
      const adr = adrInfoForFluide(code)
      item = {
        ...item,
        fluide: code,
        codeUn: adr?.codeUn || item.codeUn,
        denominationAdr: adr?.denominationAdr || item.denominationAdr,
        updatedAt: now,
      }
      stock[idx] = item
    }

    if (denomination && !sameFluideCode(item.fluide, denomination)) {
      throw new Error(
        `Bouteille ${item.numeroContenant} (${item.fluide || 'non assigné'}) ≠ dénomination fluide ${denomination}. Même gaz obligatoire.`,
      )
    }

    assertMouvementCerfaLegal({
      item,
      sens,
      quantiteKg: qty,
      clientId: intervention.clientId,
    })

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
      const patch: Partial<StockItem> = { quantiteKg: apres, updatedAt: now }
      // Rattache au détenteur (réinjection même client) — recyclé site & transfert/service
      if (
        (item.contenantType === 'recycle' || item.contenantType === 'transfert') &&
        intervention.clientId &&
        !item.origineClientId
      ) {
        patch.origineClientId = intervention.clientId
      }
      // Huile récupération : mémorise / refuse mélange MO ↔ POE
      const huile = m.typeHuile
      if (huile && item.contenantType === 'recuperation') {
        if (
          item.typeHuile &&
          item.typeHuile !== 'inconnu' &&
          huile !== 'inconnu' &&
          item.typeHuile !== huile
        ) {
          throw new Error(
            `Mélange d’huiles interdit sur ${item.numeroContenant} : bouteille déjà en ${item.typeHuile}, récupération en ${huile}. Utilisez une autre bouteille.`,
          )
        }
        if (!item.typeHuile || item.typeHuile === 'inconnu') {
          patch.typeHuile = huile
        }
      }
      stock[idx] = { ...item, ...patch }
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

  if (item.contenantType === 'vierge' || item.contenantType === 'transfert') {
    throw new Error(
      'L’évacuation BSFF / destruction concerne surtout les bouteilles de récupération (fluide usagé).',
    )
  }
  if (!ref) {
    throw new Error('Référence BSFF / bordereau obligatoire pour l’évacuation vers un centre agréé.')
  }

  const nextItem: StockItem = {
    ...item,
    quantiteKg: apres,
    updatedAt: now,
    ...(ref && !item.bsffReference ? { bsffReference: ref } : {}),
    ...(apres <= 1e-9 && item.contenantType === 'recuperation'
      ? {
          fluide: '',
          codeUn: '',
          denominationAdr: '',
          conformeA2LA3: false,
          typeHuile: 'inconnu' as const,
          origineClientId: undefined,
        }
      : {}),
  }

  const mouvement = makeMouvement({
    item,
    sens: 'sortie',
    quantiteKg: qty,
    quantiteAvantKg: item.quantiteKg,
    quantiteApresKg: apres,
    date,
    cerfaLabel: `DEST-${ref}`,
    createdByName: opts.createdByName,
    kind: 'destruction',
    tiersNom: centre,
    documentReference: ref,
    note: [
      'Destruction / traitement agréé',
      centre ? `Centre : ${centre}` : '',
      `BSFF / doc. : ${ref}`,
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

export type EmplacementStock = 'atelier' | 'vehicule'

export function labelEmplacement(
  emplacement?: EmplacementStock | null,
  label?: string | null,
): string {
  if (emplacement === 'vehicule') {
    const name = (label || '').trim()
    return name ? `Véhicule « ${name} »` : 'Véhicule'
  }
  if (emplacement === 'atelier') return 'Atelier / dépôt'
  return 'Non renseigné'
}

/**
 * Transfert interne atelier ↔ véhicule (ou véhicule ↔ véhicule).
 * Aucun CERFA : le fluide reste propriété de l’entreprise.
 * Enregistre une ligne au registre de stock F-Gas (traçabilité).
 */
export function enregistrerTransfertInterne(
  data: AppData,
  opts: {
    stockItemId: string
    versEmplacement: EmplacementStock
    versLabel?: string
    date?: string
    notes?: string
    /** Réf. document ADR / déclaration transport (optionnel) */
    documentAdr?: string
    createdByName?: string
  },
): AppData {
  const idx = data.stock.findIndex((s) => s.id === opts.stockItemId)
  if (idx < 0) throw new Error('Bouteille introuvable.')
  const item = data.stock[idx]
  if (isBouteilleRetournee(item)) {
    throw new Error('Bouteille déjà retournée (consigne) — transfert impossible.')
  }

  const fromEmp = item.emplacement || 'atelier'
  const fromLabel = item.emplacementLabel
  const toEmp = opts.versEmplacement
  const toLabel = toEmp === 'vehicule' ? opts.versLabel?.trim() || '' : ''

  if (toEmp === 'vehicule' && !toLabel) {
    throw new Error('Indiquez le nom du véhicule (ex. Véhicule A, Camion 12).')
  }

  const samePlace =
    fromEmp === toEmp &&
    (fromEmp !== 'vehicule' || (fromLabel || '').trim() === toLabel)
  if (samePlace) {
    throw new Error('La bouteille est déjà à cet emplacement.')
  }

  const now = new Date().toISOString()
  const date = opts.date || now.slice(0, 10)
  const qty = roundKg(Number(item.quantiteKg) || 0)
  const fromTxt = labelEmplacement(fromEmp, fromLabel)
  const toTxt = labelEmplacement(toEmp, toLabel)
  const adr = opts.documentAdr?.trim()

  const nextItem: StockItem = {
    ...item,
    emplacement: toEmp,
    emplacementLabel: toEmp === 'vehicule' ? toLabel : undefined,
    updatedAt: now,
  }

  const mouvement = makeMouvement({
    item,
    // Quantité inchangée : snapshot pour le registre (où se trouve chaque kg)
    sens: 'sortie',
    quantiteKg: Math.max(qty, 0.001),
    quantiteAvantKg: qty,
    quantiteApresKg: qty,
    date,
    cerfaLabel: `TRF-${date}-${item.numeroContenant || item.id.slice(0, 6)}`,
    createdByName: opts.createdByName,
    kind: 'transfert_interne',
    documentReference: adr,
    note: [
      `Transfert interne (sans CERFA) : ${fromTxt} → ${toTxt}`,
      qty > 0 ? `Fluide suivi : ${qty} kg ${item.fluide}` : 'Bouteille vide déplacée',
      item.codeUn ? `ADR ${item.codeUn}` : '',
      item.denominationAdr || '',
      adr ? `Doc. transport ADR : ${adr}` : 'Penser au document ADR / seuil 1000 points',
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

/**
 * Déclaration de perte / fuite / dégazage accidentel (bilan F-Gas annuel).
 * Sortie de stock sans CERFA client.
 */
export function enregistrerPerteEmission(
  data: AppData,
  opts: {
    stockItemId: string
    quantiteKg: number
    date: string
    motif?: string
    notes?: string
    createdByName?: string
  },
): AppData {
  const idx = data.stock.findIndex((s) => s.id === opts.stockItemId)
  if (idx < 0) throw new Error('Bouteille introuvable.')
  const item = data.stock[idx]
  const qty = roundKg(Number(opts.quantiteKg) || 0)
  if (qty <= 0) throw new Error('Quantité perdue (kg) obligatoire.')
  if (qty > item.quantiteKg + 1e-9) {
    throw new Error(`Stock insuffisant : reste ${item.quantiteKg} kg.`)
  }

  const now = new Date().toISOString()
  const date = opts.date || now.slice(0, 10)
  const apres = roundKg(item.quantiteKg - qty)
  const motif = opts.motif?.trim() || 'Perte / fuite / dégazage accidentel'

  const nextItem: StockItem = {
    ...item,
    quantiteKg: apres,
    updatedAt: now,
  }

  const mouvement = makeMouvement({
    item,
    sens: 'sortie',
    quantiteKg: qty,
    quantiteAvantKg: item.quantiteKg,
    quantiteApresKg: apres,
    date,
    cerfaLabel: `PERTE-${date}-${item.numeroContenant || item.id.slice(0, 6)}`,
    createdByName: opts.createdByName,
    kind: 'perte_emission',
    note: [motif, opts.notes?.trim() || ''].filter(Boolean).join(' · '),
  })

  return {
    ...data,
    stock: data.stock.map((s, i) => (i === idx ? nextItem : s)),
    stockMouvements: [...(data.stockMouvements || []), mouvement],
  }
}

