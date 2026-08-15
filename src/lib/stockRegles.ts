import type { ContenantType, NatureIntervention, StockItem, StockMouvementSens } from './types'
import { CONTENANT_TYPE_LABELS, isContenantDestination } from './types'

/** Taux de remplissage max sécurité (dilatation thermique) — récupération. */
export const TAUX_REMPLISSAGE_SECURITE = 0.8

function roundKg(n: number) {
  return Math.round(n * 1000) / 1000
}

/** Capacité nominale (kg) saisie en stock — avant application du 80 %. */
export function capaciteNominaleKg(
  item: Pick<StockItem, 'capaciteMaxKg' | 'quantiteInitialeKg'>,
): number | null {
  const cap = Number(item.capaciteMaxKg)
  if (Number.isFinite(cap) && cap > 0) return cap
  const init = Number(item.quantiteInitialeKg)
  if (Number.isFinite(init) && init > 0) return init
  return null
}

/** @deprecated alias — préférer capaciteNominaleKg */
export function capaciteMaxEffective(
  item: Pick<StockItem, 'capaciteMaxKg' | 'quantiteInitialeKg'>,
): number | null {
  return capaciteNominaleKg(item)
}

/**
 * Poids max fluide autorisé (sécurité).
 * Récupération : 80 % de la capacité nominale. Autres : capacité nominale.
 */
export function poidsMaxAutoriseKg(item: StockItem): number | null {
  const nom = capaciteNominaleKg(item)
  if (nom == null) return null
  if (item.contenantType === 'recuperation') {
    return roundKg(nom * TAUX_REMPLISSAGE_SECURITE)
  }
  return nom
}

export function capaciteRestanteKg(item: StockItem): number | null {
  const max = poidsMaxAutoriseKg(item)
  if (max == null) return null
  return Math.max(0, roundKg(max - (Number(item.quantiteKg) || 0)))
}

export type JaugeRecupInfo = {
  actuelKg: number
  nominalKg: number
  maxAutoriseKg: number
  restanteKg: number
  /** 0–100 par rapport au poids max autorisé (80 % nominal) */
  pctAutorise: number
  alerteBientotPleine: boolean
  pleine: boolean
  message: string | null
}

/** Jauge cumulée multi-sites + seuils d’alerte (80 % du max autorisé). */
export function jaugeRemplissageRecup(item: StockItem): JaugeRecupInfo | null {
  if (item.contenantType !== 'recuperation') return null
  const nominalKg = capaciteNominaleKg(item)
  const maxAutoriseKg = poidsMaxAutoriseKg(item)
  if (nominalKg == null || maxAutoriseKg == null) return null
  const actuelKg = roundKg(Number(item.quantiteKg) || 0)
  const restanteKg = Math.max(0, roundKg(maxAutoriseKg - actuelKg))
  const pctAutorise =
    maxAutoriseKg > 0 ? Math.min(100, Math.round((actuelKg / maxAutoriseKg) * 100)) : 0
  const pleine = actuelKg >= maxAutoriseKg - 1e-9
  const alerteBientotPleine = !pleine && pctAutorise >= 80
  let message: string | null = null
  if (pleine) {
    message = `Bouteille pleine (${actuelKg} / ${maxAutoriseKg} kg max autorisés) — générer le BSFF et retour distributeur.`
  } else if (alerteBientotPleine) {
    message = `Bouteille bientôt pleine (${actuelKg} / ${maxAutoriseKg} kg max) — prévoir le retour distributeur (BSFF).`
  }
  return {
    actuelKg,
    nominalKg,
    maxAutoriseKg,
    restanteKg,
    pctAutorise,
    alerteBientotPleine,
    pleine,
    message,
  }
}

/** CERFA natures qui autorisent le remplissage d’une bouteille de récupération. */
export function naturesPermettentRemplissageRecup(natures: NatureIntervention[]): boolean {
  return natures.some((n) => n === 'recuperation' || n === 'demantelement')
}

/**
 * Réinjection (sortie / charge) autorisée chez ce client ?
 * - Récupération : jamais (déchet → BSFF / distributeur)
 * - Recyclé site : uniquement le même détenteur (origineClientId)
 * - Régénéré usine : OK partout
 * - Transfert avec origine : même client
 */
export function peutReinjectionSurClient(
  item: Pick<StockItem, 'contenantType' | 'origineClientId'>,
  clientId: string | undefined | null,
): boolean {
  if (item.contenantType === 'recuperation') return false
  if (item.contenantType === 'recycle') {
    if (!item.origineClientId || !clientId) return false
    return item.origineClientId === clientId
  }
  if (item.contenantType === 'regenere') return true
  if (item.contenantType === 'transfert') {
    if (!item.origineClientId) return true
    if (!clientId) return false
    return item.origineClientId === clientId
  }
  return true
}

/**
 * Sens autorisés sur CERFA selon F-Gas / suivi stock.
 * - Vierge / Régénéré : sortie seule (charge)
 * - Récupération : entrée seule (fluide usagé → BSFF, jamais réinjection)
 * - Recyclé / Transfert : entrée et sortie (sortie filtrée par client si recyclé site)
 */
export function sensAutorisesCerfa(type: ContenantType): StockMouvementSens[] {
  if (type === 'vierge' || type === 'regenere') return ['sortie']
  if (type === 'recuperation') return ['entree']
  return ['entree', 'sortie']
}

export function assertSensCerfaLegal(type: ContenantType, sens: StockMouvementSens): void {
  const ok = sensAutorisesCerfa(type)
  if (!ok.includes(sens)) {
    const label = CONTENANT_TYPE_LABELS[type] || type
    if (type === 'recuperation' && sens === 'sortie') {
      throw new Error(
        `Bouteille « ${label} » : réinjection interdite (F-Gas). Le fluide usagé doit être évacué via Stock → BSFF / retour distributeur (régénération usine).`,
      )
    }
    if ((type === 'vierge' || type === 'regenere') && sens === 'entree') {
      throw new Error(
        `Bouteille « ${label} » : seules des sorties (charge / appoint) sont autorisées.`,
      )
    }
    throw new Error(`Mouvement « ${sens} » non autorisé pour une bouteille ${label}.`)
  }
}

/** Validations stock + mouvement avant application CERFA. */
export function assertMouvementCerfaLegal(opts: {
  item: StockItem
  sens: StockMouvementSens
  quantiteKg: number
  clientId?: string | null
}): void {
  const { item, sens, quantiteKg, clientId } = opts
  const qty = Number(quantiteKg) || 0
  if (qty <= 0) throw new Error('Quantité (kg) obligatoire.')

  assertSensCerfaLegal(item.contenantType, sens)

  if (sens === 'entree') {
    const restante = capaciteRestanteKg(item)
    if (item.contenantType === 'recuperation') {
      const max = poidsMaxAutoriseKg(item)
      const nom = capaciteNominaleKg(item)
      if (max == null || max <= 0 || nom == null) {
        throw new Error(
          `Bouteille ${item.numeroContenant} : indiquez la capacité nominale (kg) dans Stock. Le plafond sécurité est 80 % (${TAUX_REMPLISSAGE_SECURITE * 100} %).`,
        )
      }
    }
    if (item.contenantType === 'transfert') {
      throw new Error(
        `Bouteille « Transfert » : pas de récupération client. Utilisez une bouteille Récupération (déchet) ou Recyclé (même détenteur).`,
      )
    }
    if (item.contenantType === 'regenere') {
      throw new Error(
        `Bouteille « Régénéré » : achat distributeur — pas de vidange client. Utilisez Récupération ou Recyclé site.`,
      )
    }
    if (restante != null && qty > restante + 1e-9) {
      const max = poidsMaxAutoriseKg(item)
      throw new Error(
        `Plafond sécurité dépassé sur ${item.numeroContenant} : reste ${restante} kg (max autorisé ${max} kg = 80 % de la capacité). Même fluide uniquement, multi-sites OK jusqu’à ce plafond.`,
      )
    }
  }

  if (sens === 'sortie' && !peutReinjectionSurClient(item, clientId)) {
    if (item.contenantType === 'recuperation') {
      throw new Error(
        `Fluide usagé (${item.numeroContenant}) : réinjection interdite. Évacuez via Stock → BSFF / retour distributeur.`,
      )
    }
    throw new Error(
      `Fluide recyclé (${item.numeroContenant}) : réinjection uniquement chez le même détenteur / client (recyclage site). Pour un autre site : régénération usine via distributeur.`,
    )
  }
}

export function resumeRegleContenant(type: ContenantType): string {
  switch (type) {
    case 'vierge':
      return 'Neuf distributeur : stock positif au départ, uniquement des sorties (charge). N° bouteille obligatoire.'
    case 'recuperation':
      return 'Déchet usagé : démarre vide, accumulation multi-sites (même fluide), max 80 % capacité. Jamais de réinjection — BSFF / distributeur quand pleine.'
    case 'recycle':
      return 'Recyclage sur site : démarre vide, remplissage puis réinjection uniquement chez le même détenteur / client.'
    case 'regenere':
      return 'Régénéré usine (achat distributeur) : quantité d’entrée > 0, utilisable partout en charge — pas de vidange client.'
    case 'transfert':
      return 'Logistique interne atelier ↔ véhicule (sans CERFA). Pas de vidange client dans cette bouteille.'
    default:
      return ''
  }
}

export function isDestinationVidange(type: ContenantType): boolean {
  return isContenantDestination(type)
}

/** Visible dans la liste CERFA pour une opération de charge (sortie). */
export function bouteilleEligibleChargeCerfa(
  item: Pick<StockItem, 'contenantType' | 'origineClientId' | 'quantiteKg'>,
  clientId: string | undefined | null,
): boolean {
  const qty = Number(item.quantiteKg) || 0
  if (qty <= 0) return false
  if (item.contenantType === 'recuperation') return false
  return peutReinjectionSurClient(item, clientId)
}
