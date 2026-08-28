/** Types d’outillage terrain frigoriste — catalogue pour menus déroulants. */

export type OutillageTypeId =
  | 'detecteur_fuite'
  | 'station_recuperation'
  | 'pompe_vide'
  | 'groupe_manometrique'
  | 'balance_pesee'
  | 'caisse_outils'
  | 'electroportatif'
  | 'chalumeau_poste'
  | 'thermometre_sonde'
  | 'pince_amperemetrique'
  | 'detecteur_tension'
  | 'aspirateur_industriel'
  | 'flexibles_raccords'
  | 'clefs_outils_main'
  | 'epi_securite'
  | 'bouteille_azote'
  | 'echelle_escabeau'
  | 'generateur_fumee'
  | 'camera_thermique'
  | 'autre'

export type OutillageTypeDef = {
  id: OutillageTypeId
  label: string
  /** Obligatoire réglementaire / CERFA pour intervention fluides */
  obligatoire?: boolean
  hint?: string
  /** Afficher date contrôle / étalonnage */
  needsControleDate?: boolean
}

/** Les 5 outils réglementaires minimum frigoriste (fluides + CERFA). */
export const OUTILLAGE_OBLIGATOIRE_IDS: OutillageTypeId[] = [
  'detecteur_fuite',
  'station_recuperation',
  'pompe_vide',
  'groupe_manometrique',
  'balance_pesee',
]

export const OUTILLAGE_CATALOG: Record<OutillageTypeId, OutillageTypeDef> = {
  detecteur_fuite: {
    id: 'detecteur_fuite',
    label: 'Détecteur de fuite électronique',
    obligatoire: true,
    needsControleDate: true,
    hint: 'Contrôle annuel obligatoire — cadre CERFA [5]',
  },
  station_recuperation: {
    id: 'station_recuperation',
    label: 'Station de récupération / recycleur',
    obligatoire: true,
    hint: 'Récupération et transfert fluides frigorigènes',
  },
  pompe_vide: {
    id: 'pompe_vide',
    label: 'Pompe à vide',
    obligatoire: true,
    hint: 'Dépression circuit avant charge',
  },
  groupe_manometrique: {
    id: 'groupe_manometrique',
    label: 'Groupe manométrique (manifold)',
    obligatoire: true,
    hint: 'Raccordement HP/BP, charge et récupération',
  },
  balance_pesee: {
    id: 'balance_pesee',
    label: 'Balance de pesée fluide',
    obligatoire: true,
    needsControleDate: true,
    hint: 'Quantités kg avant/après intervention',
  },
  caisse_outils: {
    id: 'caisse_outils',
    label: 'Caisse à outils / servante',
    hint: 'Outillage à main, clés, embouts',
  },
  electroportatif: {
    id: 'electroportatif',
    label: 'Outillage électroportatif',
    hint: 'Perceuse, visseuse, disqueuse, aspirateur…',
  },
  chalumeau_poste: {
    id: 'chalumeau_poste',
    label: 'Poste à braser / chalumeau',
    hint: 'Brasure cuivre — habilitation requise',
  },
  thermometre_sonde: {
    id: 'thermometre_sonde',
    label: 'Thermomètre / sonde de température',
    hint: 'Sonde infrarouge ou contact, pinces',
  },
  pince_amperemetrique: {
    id: 'pince_amperemetrique',
    label: 'Pince ampèremétrique / multimètre',
    hint: 'Mesures électriques compresseur / armoire',
  },
  detecteur_tension: {
    id: 'detecteur_tension',
    label: 'Détecteur de tension / testeur',
    hint: 'Sécurité électrique avant intervention',
  },
  aspirateur_industriel: {
    id: 'aspirateur_industriel',
    label: 'Aspirateur industriel / nettoyeur',
    hint: 'Nettoyage condenseur, locaux techniques',
  },
  flexibles_raccords: {
    id: 'flexibles_raccords',
    label: 'Flexibles & raccords rapides',
    hint: 'Tuyaux HP/BP, quick-connect, adaptateurs',
  },
  clefs_outils_main: {
    id: 'clefs_outils_main',
    label: 'Clés & outils à main frigoriste',
    hint: 'Clés à cliquet, clés pipe, pinces, cutters',
  },
  epi_securite: {
    id: 'epi_securite',
    label: 'EPI (lunettes, gants, masque)',
    hint: 'Protection individuelle terrain',
  },
  bouteille_azote: {
    id: 'bouteille_azote',
    label: 'Bouteille azote / gaz inerte',
    hint: 'Essais pression, purge circuit',
  },
  echelle_escabeau: {
    id: 'echelle_escabeau',
    label: 'Échelle / escabeau',
    hint: 'Accès unités extérieures, VMC',
  },
  generateur_fumee: {
    id: 'generateur_fumee',
    label: 'Générateur de fumée',
    hint: 'Test étanchéité gaines / VMC',
  },
  camera_thermique: {
    id: 'camera_thermique',
    label: 'Caméra thermique',
    hint: 'Diagnostic fuites, surchauffe compresseur',
  },
  autre: {
    id: 'autre',
    label: 'Autre outillage',
    hint: 'Précisez dans les notes',
  },
}

/** Liste ordonnée pour les menus déroulants (obligatoires en tête). */
export const OUTILLAGE_TYPE_OPTIONS: OutillageTypeDef[] = [
  ...OUTILLAGE_OBLIGATOIRE_IDS.map((id) => OUTILLAGE_CATALOG[id]),
  ...(Object.keys(OUTILLAGE_CATALOG) as OutillageTypeId[])
    .filter((id) => !OUTILLAGE_OBLIGATOIRE_IDS.includes(id))
    .map((id) => OUTILLAGE_CATALOG[id]),
]

export function outillageTypeLabel(type: OutillageTypeId | string): string {
  const def = OUTILLAGE_CATALOG[type as OutillageTypeId]
  return def?.label || type
}

export function isOutillageTypeId(v: unknown): v is OutillageTypeId {
  return typeof v === 'string' && v in OUTILLAGE_CATALOG
}
