/** Impression des fiches maintenance : 1 document par équipement, ou 2/3 par page. */

export type EquipementsParFiche = 1 | 2 | 3

export const EQUIPEMENTS_PAR_FICHE_OPTIONS: {
  value: EquipementsParFiche
  label: string
  hint: string
}[] = [
  {
    value: 1,
    label: '1 par fiche',
    hint: 'Un document par équipement (défaut). Idéal si les relevés ou le résultat diffèrent beaucoup.',
  },
  {
    value: 2,
    label: '2 par fiche',
    hint: 'Moins de papier. Chaque machine garde son n° de série et ses relevés, colonnes côte à côte.',
  },
  {
    value: 3,
    label: '3 par fiche',
    hint: 'Le plus compact pour imprimer. Annuel CTA / VMC : format paysage. Évitez si une machine est en réserve.',
  },
]

export function normalizeEquipementsParFiche(n?: number | null): EquipementsParFiche {
  if (n === 2 || n === 3) return n
  return 1
}

export function chunkItems<T>(items: T[], size: number): T[][] {
  const n = Math.max(1, size)
  const out: T[][] = []
  for (let i = 0; i < items.length; i += n) out.push(items.slice(i, i + n))
  return out
}

export function pagesCountForGroupement(total: number, perPage: EquipementsParFiche): number {
  if (total <= 0) return 0
  if (perPage <= 1) return total
  return Math.ceil(total / perPage)
}

export function groupementSummary(total: number, perPage: EquipementsParFiche): string {
  if (total < 2) return 'Une fiche à imprimer.'
  const pages = pagesCountForGroupement(total, perPage)
  if (perPage <= 1) {
    return `${total} fiches à imprimer (une par équipement).`
  }
  return `${total} équipements → ${pages} page${pages > 1 ? 's' : ''} à imprimer (${perPage} par fiche).`
}
