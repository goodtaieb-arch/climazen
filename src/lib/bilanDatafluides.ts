/**
 * Bilan annuel fluides frigorigènes — brouillon pour déclaration Datafluides (Cemafroid).
 * Datafluides n’a pas d’API publique : ce document sert de justificatif à recopier
 * manuellement sur datafluides.fr, ou à transmettre tel quel à un organisme de contrôle.
 */

import type { AppData, ContenantType, StockItem } from './types'
import { calcTeqCO2, findFluide, normalizeFluideCode } from './fluides'
import { qtyAtEndOfDay, yearBounds } from './rapportAnnuelGaz'

function roundKg(n: number) {
  return Math.round(n * 1000) / 1000
}

function roundTeq(n: number) {
  return Math.round(n * 1000) / 1000
}

function inYear(date: string, year: number) {
  return (date || '').slice(0, 4) === String(year)
}

/** Achat neuf distributeur ou régénéré acheté distributeur (pas récupération/recyclage). */
function isAchatNeufOuRegenere(type: ContenantType) {
  return type === 'vierge' || type === 'regenere'
}

export type FiliereTraitement = 'regeneration' | 'recyclage' | 'destruction'

export const FILIERE_TRAITEMENT_LABELS: Record<FiliereTraitement, string> = {
  regeneration: 'Régénération / distributeur',
  recyclage: 'Recyclage sur site',
  destruction: 'Destruction',
}

/**
 * Filière d’un contenant : recyclé site (réinjecté chez le même client), régénération
 * usine (bouteille récupération renvoyée au distributeur) ou destruction (déchet BSFF).
 * Même logique que `filiereRecupOf` de la page Stock.
 */
function filiereTraitementOf(
  s: Pick<StockItem, 'contenantType' | 'origineDestructionDistributeur'>,
): FiliereTraitement {
  if (s.contenantType === 'recycle') return 'recyclage'
  return s.origineDestructionDistributeur ? 'destruction' : 'regeneration'
}

export type TransfertTraitementLigne = {
  date: string
  fluide: string
  numeroContenant: string
  filiere: FiliereTraitement
  quantiteKg: number
  bsffReference: string
  organisme: string
}

export type BilanFluideDatafluides = {
  fluide: string
  gwp: number | null
  /** Neuf distributeur + régénéré acheté distributeur */
  acheteKg: number
  /** Chargé / mis en service sur équipements (sorties CERFA) */
  chargeKg: number
  /** Récupéré sur chantier (entrées bouteilles récupération / recyclage) */
  recupereKg: number
  transfereRegenerationKg: number
  transfereRecyclageKg: number
  transfereDestructionKg: number
  /** Réf. BSFF associées aux transferts vers traitement, toutes filières confondues */
  bsffReferences: string[]
  /** Stock restant au 31/12 (utilisable + récupéré) */
  stockRestantKg: number
  /** kg chargés × GWP / 1000 */
  teqCO2Charge: number
  /** kg stock restant × GWP / 1000 */
  teqCO2StockRestant: number
}

export type BilanDatafluidesTotaux = {
  acheteKg: number
  chargeKg: number
  recupereKg: number
  transfereRegenerationKg: number
  transfereRecyclageKg: number
  transfereDestructionKg: number
  stockRestantKg: number
  teqCO2Charge: number
  teqCO2StockRestant: number
}

export type BilanDatafluides = {
  year: number
  genereAt: string
  operateur: AppData['operateur']
  lignes: BilanFluideDatafluides[]
  transferts: TransfertTraitementLigne[]
  /** N° CERFA (ou libellés mouvement) inclus dans le calcul — traçabilité / justificatif */
  cerfaNumeros: string[]
  totaux: BilanDatafluidesTotaux
}

export function buildBilanDatafluides(data: AppData, year: number): BilanDatafluides {
  const { end } = yearBounds(year)
  const mouvements = data.stockMouvements || []
  const yearMouv = mouvements
    .filter((m) => inYear(m.date, year))
    .sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id))

  const fluides = new Set<string>()
  for (const m of yearMouv) fluides.add(normalizeFluideCode(m.fluide) || m.fluide)
  for (const s of data.stock) {
    if ((Number(s.quantiteKg) || 0) > 0) fluides.add(normalizeFluideCode(s.fluide) || s.fluide)
  }

  const transferts: TransfertTraitementLigne[] = []

  const lignes: BilanFluideDatafluides[] = [...fluides]
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b, 'fr'))
    .map((fluide) => {
      const ofFluide = yearMouv.filter((m) => (normalizeFluideCode(m.fluide) || m.fluide) === fluide)

      let acheteKg = 0
      let chargeKg = 0
      let recupereKg = 0
      let regenerationKg = 0
      let recyclageKg = 0
      let destructionKg = 0
      const bsffSet = new Set<string>()

      for (const m of ofFluide) {
        const q = m.quantiteKg
        const item = data.stock.find((s) => s.id === m.stockItemId)

        if (m.kind === 'achat') {
          if (!item || isAchatNeufOuRegenere(item.contenantType)) acheteKg += q
          continue
        }
        if (m.kind === 'destruction') {
          const filiere = item ? filiereTraitementOf(item) : 'regeneration'
          const bsff = m.documentReference?.trim() || item?.bsffReference?.trim() || ''
          if (filiere === 'recyclage') recyclageKg += q
          else if (filiere === 'destruction') destructionKg += q
          else regenerationKg += q
          if (bsff) bsffSet.add(bsff)
          transferts.push({
            date: m.date.slice(0, 10),
            fluide,
            numeroContenant: m.numeroContenant,
            filiere,
            quantiteKg: q,
            bsffReference: bsff,
            organisme: m.tiersNom?.trim() || '—',
          })
          continue
        }
        if (m.kind === 'perte_emission' || m.kind === 'retour_consigne' || m.kind === 'transfert_interne') {
          continue
        }
        // kind === 'cerfa' (ou mouvement historique sans kind)
        if (m.sens === 'sortie') chargeKg += q
        else recupereKg += q
      }

      let stockRestant = 0
      for (const s of data.stock) {
        if ((normalizeFluideCode(s.fluide) || s.fluide) !== fluide) continue
        stockRestant += qtyAtEndOfDay(s, mouvements, end)
      }
      stockRestant = roundKg(stockRestant)

      const ref = findFluide(fluide)
      const gwp = ref ? ref.gwp : null

      return {
        fluide,
        gwp,
        acheteKg: roundKg(acheteKg),
        chargeKg: roundKg(chargeKg),
        recupereKg: roundKg(recupereKg),
        transfereRegenerationKg: roundKg(regenerationKg),
        transfereRecyclageKg: roundKg(recyclageKg),
        transfereDestructionKg: roundKg(destructionKg),
        bsffReferences: [...bsffSet].sort((a, b) => a.localeCompare(b, 'fr')),
        stockRestantKg: stockRestant,
        teqCO2Charge: gwp != null ? calcTeqCO2(chargeKg, gwp) : 0,
        teqCO2StockRestant: gwp != null ? calcTeqCO2(stockRestant, gwp) : 0,
      }
    })
    .filter(
      (l) =>
        l.acheteKg ||
        l.chargeKg ||
        l.recupereKg ||
        l.transfereRegenerationKg ||
        l.transfereRecyclageKg ||
        l.transfereDestructionKg ||
        l.stockRestantKg,
    )

  const cerfaNumeros = [
    ...new Set(
      yearMouv
        .filter((m) => (m.kind === 'cerfa' || (!m.kind && m.interventionId)) && m.cerfaLabel)
        .map((m) => m.cerfaLabel.trim())
        .filter(Boolean),
    ),
  ].sort((a, b) => a.localeCompare(b, 'fr'))

  const totaux = lignes.reduce<BilanDatafluidesTotaux>(
    (acc, l) => ({
      acheteKg: roundKg(acc.acheteKg + l.acheteKg),
      chargeKg: roundKg(acc.chargeKg + l.chargeKg),
      recupereKg: roundKg(acc.recupereKg + l.recupereKg),
      transfereRegenerationKg: roundKg(acc.transfereRegenerationKg + l.transfereRegenerationKg),
      transfereRecyclageKg: roundKg(acc.transfereRecyclageKg + l.transfereRecyclageKg),
      transfereDestructionKg: roundKg(acc.transfereDestructionKg + l.transfereDestructionKg),
      stockRestantKg: roundKg(acc.stockRestantKg + l.stockRestantKg),
      teqCO2Charge: roundTeq(acc.teqCO2Charge + l.teqCO2Charge),
      teqCO2StockRestant: roundTeq(acc.teqCO2StockRestant + l.teqCO2StockRestant),
    }),
    {
      acheteKg: 0,
      chargeKg: 0,
      recupereKg: 0,
      transfereRegenerationKg: 0,
      transfereRecyclageKg: 0,
      transfereDestructionKg: 0,
      stockRestantKg: 0,
      teqCO2Charge: 0,
      teqCO2StockRestant: 0,
    },
  )

  return {
    year,
    genereAt: new Date().toISOString(),
    operateur: data.operateur,
    lignes,
    transferts: transferts.sort((a, b) => a.date.localeCompare(b.date)),
    cerfaNumeros,
    totaux,
  }
}
