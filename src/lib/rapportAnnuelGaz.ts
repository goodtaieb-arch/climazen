import type { AppData, ContenantType, StockItem, StockMouvement } from './types'
import { normalizeFluideCode } from './fluides'

function roundKg(n: number) {
  return Math.round(n * 1000) / 1000
}

function roundDeclare(n: number) {
  /** Déclaration annuelle : kg arrondis à l’unité */
  return Math.round(n)
}

function isNeuf(type: ContenantType) {
  return type === 'vierge' || type === 'regenere' || type === 'transfert'
}

function yearBounds(year: number) {
  return {
    start: `${year}-01-01`,
    end: `${year}-12-31`,
    startPrev: `${year - 1}-12-31`,
  }
}

function inYear(date: string, year: number) {
  return date.slice(0, 4) === String(year)
}

/** Quantité de la bouteille à la fin de `asOf` (inclus). */
export function qtyAtEndOfDay(
  item: StockItem,
  mouvements: StockMouvement[],
  asOf: string,
): number {
  let qty = Number(item.quantiteKg) || 0
  const after = mouvements
    .filter((m) => m.stockItemId === item.id && m.date > asOf)
    .sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id))
  for (const m of after) {
    if (m.sens === 'sortie') qty = roundKg(qty + m.quantiteKg)
    else qty = roundKg(qty - m.quantiteKg)
  }
  return Math.max(0, roundKg(qty))
}

export type BilanFluideAnnuel = {
  fluide: string
  stockNeuf1erJanvier: number
  stockNeuf31Decembre: number
  stockUsage1erJanvier: number
  stockUsage31Decembre: number
  acheteKg: number
  chargeKg: number
  recupereKg: number
  detruitKg: number
  remisFournisseurKg: number
}

export type LigneMouvementAnnuel = {
  date: string
  fluide: string
  numeroContenant: string
  kind: string
  sens: string
  quantiteKg: number
  label: string
  tiers?: string
  document?: string
  note?: string
}

/** Justificatif fournisseur (BL) ou déchèterie / centre agréé (BSFF). */
export type JustificatifAnnuel = {
  categorie: 'fournisseur' | 'decheterie' | 'retour_consigne'
  categorieLabel: string
  date: string
  fluide: string
  quantiteKg: number
  numeroContenant: string
  /** Nom du fournisseur ou de la déchèterie / centre */
  organisme: string
  /** N° BL, facture, BSFF, bon de retour… */
  reference: string
  typeDoc: string
  note?: string
}

export type RapportAnnuelGaz = {
  year: number
  genereAt: string
  operateur: AppData['operateur']
  bilans: BilanFluideAnnuel[]
  mouvements: LigneMouvementAnnuel[]
  justificatifs: JustificatifAnnuel[]
  totaux: {
    acheteKg: number
    chargeKg: number
    recupereKg: number
    detruitKg: number
    remisFournisseurKg: number
  }
}

function kindLabel(m: StockMouvement): string {
  switch (m.kind) {
    case 'achat':
      return 'Achat (neuf)'
    case 'destruction':
      return 'Destruction'
    case 'retour_consigne':
      return 'Retour consigne'
    case 'transfert_interne':
      return 'Transfert interne'
    case 'perte_emission':
      return 'Perte / émission accidentelle'
    case 'cerfa':
      return m.sens === 'entree' ? 'Récupération (CERFA)' : 'Charge / sortie (CERFA)'
    default:
      return m.sens === 'entree' ? 'Entrée' : 'Sortie'
  }
}

function bottleTypeAt(item: StockItem): ContenantType {
  return item.contenantType
}

function buildJustificatifs(
  data: AppData,
  yearMouv: StockMouvement[],
  year: number,
): JustificatifAnnuel[] {
  const list: JustificatifAnnuel[] = []
  const seen = new Set<string>()

  const push = (j: JustificatifAnnuel) => {
    const key = [
      j.categorie,
      j.date,
      j.reference,
      j.organisme,
      j.numeroContenant,
      j.fluide,
      j.quantiteKg,
    ].join('|')
    if (seen.has(key)) return
    seen.add(key)
    list.push(j)
  }

  for (const m of yearMouv) {
    if (m.kind === 'achat') {
      push({
        categorie: 'fournisseur',
        categorieLabel: 'Fournisseur — achat fluide neuf',
        date: m.date.slice(0, 10),
        fluide: m.fluide,
        quantiteKg: m.quantiteKg,
        numeroContenant: m.numeroContenant,
        organisme: m.tiersNom?.trim() || 'Fournisseur non renseigné',
        reference: m.documentReference?.trim() || m.cerfaLabel || '—',
        typeDoc: 'BL / facture / bon de livraison',
        note: m.note,
      })
    } else if (m.kind === 'destruction') {
      push({
        categorie: 'decheterie',
        categorieLabel: 'Déchèterie / centre agréé — destruction',
        date: m.date.slice(0, 10),
        fluide: m.fluide,
        quantiteKg: m.quantiteKg,
        numeroContenant: m.numeroContenant,
        organisme: m.tiersNom?.trim() || 'Centre / déchèterie non renseigné',
        reference: m.documentReference?.trim() || m.cerfaLabel || '—',
        typeDoc: 'BSFF / bon de prise en charge déchets',
        note: m.note,
      })
    } else if (m.kind === 'perte_emission') {
      push({
        categorie: 'decheterie',
        categorieLabel: 'Perte / fuite / dégazage accidentel (émission)',
        date: m.date.slice(0, 10),
        fluide: m.fluide,
        quantiteKg: m.quantiteKg,
        numeroContenant: m.numeroContenant,
        organisme: 'Déclaration interne F-Gas',
        reference: m.cerfaLabel || '—',
        typeDoc: 'Déclaration de perte / émission',
        note: m.note,
      })
    } else if (m.kind === 'retour_consigne') {
      push({
        categorie: 'retour_consigne',
        categorieLabel: 'Fournisseur — retour consigne (bouteille vide)',
        date: m.date.slice(0, 10),
        fluide: m.fluide,
        quantiteKg: m.quantiteKg,
        numeroContenant: m.numeroContenant,
        organisme: m.tiersNom?.trim() || 'Fournisseur non renseigné',
        reference: m.bonRetourReference?.trim() || m.documentReference?.trim() || m.cerfaLabel || '—',
        typeDoc: 'Bon de retour de consigne',
        note: m.note,
      })
    } else if (m.kind === 'cerfa' && m.sens === 'entree') {
      const bottle = data.stock.find((s) => s.id === m.stockItemId)
      const bsff = m.documentReference?.trim() || bottle?.bsffReference?.trim()
      if (bsff) {
        push({
          categorie: 'decheterie',
          categorieLabel: 'Traçabilité déchets — BSFF (récupération)',
          date: m.date.slice(0, 10),
          fluide: m.fluide,
          quantiteKg: m.quantiteKg,
          numeroContenant: m.numeroContenant,
          organisme: m.tiersNom?.trim() || 'BSFF Trackdéchets',
          reference: bsff,
          typeDoc: 'BSFF',
          note: m.note || m.cerfaLabel,
        })
      }
    }
  }

  for (const s of data.stock) {
    if (s.bonRetourConsigne?.trim() && s.bonRetourDate && inYear(s.bonRetourDate, year)) {
      push({
        categorie: 'retour_consigne',
        categorieLabel: 'Fournisseur — retour consigne (bouteille vide)',
        date: s.bonRetourDate.slice(0, 10),
        fluide: s.fluide,
        quantiteKg: 0,
        numeroContenant: s.numeroContenant,
        organisme: s.bonRetourFournisseur?.trim() || 'Fournisseur non renseigné',
        reference: s.bonRetourConsigne.trim(),
        typeDoc: 'Bon de retour de consigne',
        note: s.bonRetourNotes,
      })
    }
  }

  return list.sort(
    (a, b) =>
      a.date.localeCompare(b.date) ||
      a.categorie.localeCompare(b.categorie) ||
      a.reference.localeCompare(b.reference),
  )
}

export function buildRapportAnnuelGaz(data: AppData, year: number): RapportAnnuelGaz {
  const { end, startPrev } = yearBounds(year)
  const mouvements = data.stockMouvements || []
  const yearMouv = mouvements
    .filter((m) => inYear(m.date, year))
    .sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id))

  const fluides = new Set<string>()
  for (const s of data.stock) fluides.add(normalizeFluideCode(s.fluide) || s.fluide)
  for (const m of yearMouv) fluides.add(normalizeFluideCode(m.fluide) || m.fluide)

  const bilans: BilanFluideAnnuel[] = [...fluides]
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b, 'fr'))
    .map((fluide) => {
      const bottles = data.stock.filter(
        (s) => (normalizeFluideCode(s.fluide) || s.fluide) === fluide,
      )

      let stockNeuf1 = 0
      let stockNeuf31 = 0
      let stockUsage1 = 0
      let stockUsage31 = 0

      for (const b of bottles) {
        const t = bottleTypeAt(b)
        const q1 = qtyAtEndOfDay(b, mouvements, startPrev)
        const q31 = qtyAtEndOfDay(b, mouvements, end)
        if (isNeuf(t)) {
          stockNeuf1 += q1
          stockNeuf31 += q31
        } else {
          stockUsage1 += q1
          stockUsage31 += q31
        }
      }

      const ofFluide = yearMouv.filter(
        (m) => (normalizeFluideCode(m.fluide) || m.fluide) === fluide,
      )

      let acheteKg = 0
      let chargeKg = 0
      let recupereKg = 0
      let detruitKg = 0
      let remisFournisseurKg = 0

      for (const m of ofFluide) {
        const q = m.quantiteKg
        if (m.kind === 'achat') {
          acheteKg += q
          continue
        }
        if (m.kind === 'destruction' || m.kind === 'perte_emission') {
          detruitKg += q
          continue
        }
        if (m.kind === 'retour_consigne') {
          remisFournisseurKg += q
          continue
        }
        if (m.kind === 'transfert_interne') continue
        if (m.sens === 'sortie') chargeKg += q
        else recupereKg += q
      }

      return {
        fluide,
        stockNeuf1erJanvier: roundKg(stockNeuf1),
        stockNeuf31Decembre: roundKg(stockNeuf31),
        stockUsage1erJanvier: roundKg(stockUsage1),
        stockUsage31Decembre: roundKg(stockUsage31),
        acheteKg: roundKg(acheteKg),
        chargeKg: roundKg(chargeKg),
        recupereKg: roundKg(recupereKg),
        detruitKg: roundKg(detruitKg),
        remisFournisseurKg: roundKg(remisFournisseurKg),
      }
    })
    .filter(
      (b) =>
        b.stockNeuf1erJanvier ||
        b.stockNeuf31Decembre ||
        b.stockUsage1erJanvier ||
        b.stockUsage31Decembre ||
        b.acheteKg ||
        b.chargeKg ||
        b.recupereKg ||
        b.detruitKg ||
        b.remisFournisseurKg,
    )

  const lignes: LigneMouvementAnnuel[] = yearMouv.map((m) => ({
    date: m.date.slice(0, 10),
    fluide: m.fluide,
    numeroContenant: m.numeroContenant,
    kind: kindLabel(m),
    sens: m.sens === 'entree' ? 'Entrée' : 'Sortie',
    quantiteKg: m.quantiteKg,
    label: m.cerfaLabel,
    tiers: m.tiersNom,
    document: m.documentReference || m.bonRetourReference,
    note: m.note,
  }))

  const totaux = bilans.reduce(
    (acc, b) => ({
      acheteKg: roundKg(acc.acheteKg + b.acheteKg),
      chargeKg: roundKg(acc.chargeKg + b.chargeKg),
      recupereKg: roundKg(acc.recupereKg + b.recupereKg),
      detruitKg: roundKg(acc.detruitKg + b.detruitKg),
      remisFournisseurKg: roundKg(acc.remisFournisseurKg + b.remisFournisseurKg),
    }),
    { acheteKg: 0, chargeKg: 0, recupereKg: 0, detruitKg: 0, remisFournisseurKg: 0 },
  )

  return {
    year,
    genereAt: new Date().toISOString(),
    operateur: data.operateur,
    bilans,
    mouvements: lignes,
    justificatifs: buildJustificatifs(data, yearMouv, year),
    totaux,
  }
}

export function kgDeclare(n: number) {
  return roundDeclare(n)
}

export { yearBounds }
