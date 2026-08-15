/**
 * Identifiants bouteille — CERFA vs affichage interne.
 * - numeroContenant = n° série officiel (obligatoire, imprimé sur CERFA 15497)
 * - surnom = libellé interne optionnel (liste stock / sélecteurs uniquement)
 */

import { CONTENANT_TYPE_LABELS, type ContenantType, type StockItem } from './types'

const TYPE_AS_NUMERO = new Set(
  [
    ...Object.keys(CONTENANT_TYPE_LABELS),
    ...Object.values(CONTENANT_TYPE_LABELS),
    'transfert',
    'Transfert',
    'récupération',
    'Récupération',
    'recuperation',
    'vierge',
    'recyclé',
    'recycle',
    'régénéré',
    'regenere',
  ].map((s) => s.trim().toLowerCase()),
)

/** N° série officiel pour CERFA / registre — jamais un type de contenant. */
export function assertNumeroContenantCerfa(numero: string): string {
  const n = (numero || '').trim()
  if (!n) {
    throw new Error(
      'N° de série / n° de contenant obligatoire (identification CERFA 15497 / registre F-Gas).',
    )
  }
  if (TYPE_AS_NUMERO.has(n.toLowerCase())) {
    throw new Error(
      `« ${n} » n’est pas un n° de série. Indiquez le numéro réel (ex. BOT-32-4890 ou code-barres). Pour un libellé du type « Transfert camion », utilisez le champ Surnom / libellé interne.`,
    )
  }
  return n
}

/** Titre court en liste stock : surnom si présent, sinon n° série. */
export function titreBouteilleStock(
  item: Pick<StockItem, 'numeroContenant' | 'surnom'>,
): string {
  const surnom = (item.surnom || '').trim()
  if (surnom) return surnom
  return (item.numeroContenant || '').trim() || '—'
}

/**
 * Affichage sélecteurs / listes :
 * « Surnom (N° de série : BOT-XXX) » ou « N° de série : BOT-XXX »
 */
export function labelBouteilleAffichage(
  item: Pick<StockItem, 'numeroContenant' | 'surnom'>,
): string {
  const num = (item.numeroContenant || '').trim()
  const surnom = (item.surnom || '').trim()
  if (surnom && num) return `${surnom} (N° de série : ${num})`
  if (surnom) return `${surnom} (N° de série : —)`
  if (num) return `N° de série : ${num}`
  return 'SANS N°'
}

/** Sous-ligne stock : rappelle toujours le n° officiel. */
export function sousTitreNumeroSerie(
  item: Pick<StockItem, 'numeroContenant' | 'surnom'>,
): string | null {
  const num = (item.numeroContenant || '').trim()
  const surnom = (item.surnom || '').trim()
  if (surnom && num) return `N° de série : ${num}`
  return null
}

export function isTypeContenantAsNumero(numero: string, type?: ContenantType): boolean {
  const n = (numero || '').trim().toLowerCase()
  if (!n) return false
  if (TYPE_AS_NUMERO.has(n)) return true
  if (type && CONTENANT_TYPE_LABELS[type]?.toLowerCase() === n) return true
  return false
}
