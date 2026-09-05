/**
 * Chaufferie / clim / CTA = exemples de fiches existantes.
 * On déduit depuis le nom / type de l’équipement.
 * Si aucune fiche ClimaZEN ne correspond → le rapport d’OT suffit.
 */

import type { Equipement } from './types'
import type { DocOtRequis } from './otParcours'

export type CategorieFicheEquipement =
  | 'clim'
  | 'chaufferie'
  | 'cta_vmc'
  | 'etancheite'
  | 'aucune'

export const CATEGORIE_FICHE_LABELS: Record<CategorieFicheEquipement, string> = {
  clim: 'Fiche clim / PAC',
  chaufferie: 'Fiche chaufferie P2/P3',
  cta_vmc: 'Fiche CTA / VMC',
  etancheite: 'CERFA étanchéité',
  aucune: 'Rapport d’INT (pas de fiche type)',
}

function haystack(eq: Pick<Equipement, 'type' | 'nom'> | { type?: string; nom?: string }): string {
  return `${eq.type || ''} ${eq.nom || ''}`.toLowerCase()
}

export function inferCategorieFicheEquipement(
  eq?: Pick<Equipement, 'type' | 'nom'> | { type?: string; nom?: string } | null,
): CategorieFicheEquipement {
  if (!eq) return 'aucune'
  const t = haystack(eq)
  if (!t.trim()) return 'aucune'
  if (/etanch|étanch|f-?gas|controle d.?etanch/.test(t)) return 'etancheite'
  if (/chaufferie|chaudi[eè]re|\bp2\b|\bp3\b|br[uû]leur|ballon ecs|g[eé]n[eé]rateur/.test(t)) {
    return 'chaufferie'
  }
  if (/\bcta\b|centrale de traitement|\bvmc\b|ventilation|caisson|extracteur/.test(t)) {
    return 'cta_vmc'
  }
  if (
    /clim|climatisation|pac\b|pompe [aà] chaleur|split|vrf|vrv|groupe froid|chambre froide|condensing/.test(
      t,
    )
  ) {
    return 'clim'
  }
  return 'aucune'
}

export function docsRequisPourEquipement(
  eq?: Pick<Equipement, 'type' | 'nom'> | { type?: string; nom?: string } | null,
): DocOtRequis[] {
  const cat = inferCategorieFicheEquipement(eq)
  if (cat === 'clim') return ['fiche_clim']
  if (cat === 'chaufferie') return ['fiche_chaufferie']
  if (cat === 'cta_vmc') return ['fiche_cta_vmc']
  if (cat === 'etancheite') return ['cerfa']
  return []
}

export function ficheExistePourEquipement(
  eq?: Pick<Equipement, 'type' | 'nom'> | { type?: string; nom?: string } | null,
): boolean {
  return inferCategorieFicheEquipement(eq) !== 'aucune'
}
