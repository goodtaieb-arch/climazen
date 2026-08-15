import type { ContenantType, StockItem, StockMouvementSens } from './types'
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

/** Réinjection autorisée sur ce client (recyclé / régénéré). */
export function peutReinjectionSurClient(
  item: Pick<StockItem, 'contenantType' | 'origineClientId'>,
  clientId: string | undefined | null,
): boolean {
  if (item.contenantType !== 'regenere') return true
  if (!item.origineClientId) return true // pas encore rattaché → première utilisation libre
  if (!clientId) return false
  return item.origineClientId === clientId
}

/**
 * Sens autorisés sur CERFA selon F-Gas / suivi stock.
 * - Vierge : sortie seule (charge)
 * - Récupération : entrée seule (fluide usagé → BSFF / destruction, pas de réinjection)
 * - Recyclé / Transfert : entrée et sortie
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
        `Bouteille « ${label} » : réinjection interdite (F-Gas). Évacuez via Stock → destruction / BSFF.`,
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
    if (restante != null && qty > restante + 1e-9) {
      throw new Error(
        `Capacité dépassée sur ${item.numeroContenant} : reste ${restante} kg avant le max (${capaciteMaxEffective(item)} kg).`,
      )
    }
  }

  if (sens === 'sortie' && item.contenantType === 'regenere') {
    if (!peutReinjectionSurClient(item, clientId)) {
      throw new Error(
        `Fluide recyclé / régénéré (${item.numeroContenant}) : réinjection uniquement chez le même détenteur / client d’origine.`,
      )
    }
  }
}

export function resumeRegleContenant(type: ContenantType): string {
  switch (type) {
    case 'vierge':
      return 'Neuf distributeur : stock positif au départ, uniquement des sorties (charge). N° bouteille obligatoire.'
    case 'recuperation':
      return 'Fluide usagé : part de 0 kg, se remplit à la récupération. Capacité max obligatoire. Pas de réinjection client — BSFF / destruction.'
    case 'regenere':
      return 'Recyclé / régénéré : réinjection uniquement chez le même détenteur (même client).'
    case 'transfert':
      return 'Bouteille de service / logistique. Transfert atelier ↔ véhicule sans CERFA (registre F-Gas + ADR).'
    default:
      return ''
  }
}

export function isDestinationVidange(type: ContenantType): boolean {
  return isContenantDestination(type)
}
