import type { ContenantType, NatureIntervention, StockItem, StockMouvementSens } from './types'
import { CONTENANT_TYPE_LABELS, isContenantDestination } from './types'

/** Capacité max utile (kg) — récup. obligatoire ; sinon quantiteInitialeKg en repli. */
export function capaciteMaxEffective(item: Pick<StockItem, 'capaciteMaxKg' | 'quantiteInitialeKg'>): number | null {
  const cap = Number(item.capaciteMaxKg)
  if (Number.isFinite(cap) && cap > 0) return cap
  const init = Number(item.quantiteInitialeKg)
  if (Number.isFinite(init) && init > 0) return init
  return null
}

export function capaciteRestanteKg(item: StockItem): number | null {
  const cap = capaciteMaxEffective(item)
  if (cap == null) return null
  return Math.max(0, Math.round((cap - (Number(item.quantiteKg) || 0)) * 1000) / 1000)
}

/** CERFA natures qui autorisent le remplissage d’une bouteille de récupération. */
export function naturesPermettentRemplissageRecup(natures: NatureIntervention[]): boolean {
  return natures.some((n) => n === 'recuperation' || n === 'demantelement')
}

/**
 * Réinjection (sortie / charge) autorisée chez ce client ?
 * - Récupération : jamais (déchet → BSFF / distributeur)
 * - Recyclé avec origineClientId : uniquement le même détenteur
 * - Régénéré usine (regenere sans origine) : OK partout
 * - Transfert avec origine (ex. fluide récupéré à tort) : même client
 */
export function peutReinjectionSurClient(
  item: Pick<StockItem, 'contenantType' | 'origineClientId'>,
  clientId: string | undefined | null,
): boolean {
  if (item.contenantType === 'recuperation') return false
  if (item.contenantType === 'regenere' || item.contenantType === 'transfert') {
    if (!item.origineClientId) return true // régénéré usine / fluide propre logistique
    if (!clientId) return false
    return item.origineClientId === clientId
  }
  return true
}

/**
 * Sens autorisés sur CERFA selon F-Gas / suivi stock.
 * - Vierge : sortie seule (charge)
 * - Récupération : entrée seule (fluide usagé → BSFF, jamais réinjection)
 * - Recyclé / Transfert : entrée et sortie (sortie filtrée par client si recyclé site)
 */
export function sensAutorisesCerfa(type: ContenantType): StockMouvementSens[] {
  if (type === 'vierge') return ['sortie']
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
    if (type === 'vierge' && sens === 'entree') {
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
      const cap = capaciteMaxEffective(item)
      if (cap == null || cap <= 0) {
        throw new Error(
          `Bouteille ${item.numeroContenant} : indiquez la capacité max (kg) dans Stock pour éviter la surcharge.`,
        )
      }
    }
    if (item.contenantType === 'transfert') {
      throw new Error(
        `Bouteille « Transfert » : pas de récupération client. Utilisez une bouteille Récupération (déchet) ou Recyclé (même détenteur).`,
      )
    }
    if (restante != null && qty > restante + 1e-9) {
      throw new Error(
        `Capacité dépassée sur ${item.numeroContenant} : reste ${restante} kg avant le max (${capaciteMaxEffective(item)} kg).`,
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
      return 'Déchet usagé : se remplit à la récupération uniquement. Jamais de charge/appoint client. Sortie = BSFF / retour distributeur uniquement.'
    case 'regenere':
      return 'Recyclé site = même détenteur uniquement. Régénéré usine (sans client d’origine) = utilisable partout après achat distributeur.'
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
