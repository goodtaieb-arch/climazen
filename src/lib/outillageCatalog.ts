/** Types d’outillage terrain frigoriste + CVC — catalogue pour menus déroulants. */

export type OutillageTypeId =
  | 'detecteur_fuite'
  | 'station_recuperation'
  | 'pompe_vide'
  | 'groupe_manometrique'
  | 'balance_pesee'
  | 'vacuometre'
  | 'identificateur_fluide'
  | 'detecteur_formier'
  | 'station_charge'
  | 'caisse_outils'
  | 'electroportatif'
  | 'chalumeau_poste'
  | 'presse_sertir'
  | 'thermometre_sonde'
  | 'pince_amperemetrique'
  | 'detecteur_tension'
  | 'camera_thermique'
  | 'enregistreur_temperature'
  | 'cle_dynamometrique'
  | 'analyseur_combustion'
  | 'anemometre'
  | 'hygrometre'
  | 'micromanometre'
  | 'detecteur_co'
  | 'analyseur_eau'
  | 'sonometre'
  | 'mallette_equilibrage'
  | 'generateur_fumee'
  | 'camera_inspection'
  | 'aspirateur_industriel'
  | 'flexibles_raccords'
  | 'clefs_outils_main'
  | 'epi_securite'
  | 'telephone_pro'
  | 'bouteille_azote'
  | 'echelle_escabeau'
  | 'palan_elinguage'
  | 'autre'

export type OutillageGroupeId = 'obligatoire' | 'mesure' | 'cvc' | 'terrain'

export const OUTILLAGE_GROUPE_LABELS: Record<OutillageGroupeId, string> = {
  obligatoire: 'Obligatoires frigoriste (5)',
  mesure: 'Mesure froid / fluides (étalonnage)',
  cvc: 'CVC / chaufferie / CTA',
  terrain: 'Autre matériel terrain',
}

export const OUTILLAGE_GROUPE_ORDER: OutillageGroupeId[] = [
  'obligatoire',
  'mesure',
  'cvc',
  'terrain',
]

export type OutillageTypeDef = {
  id: OutillageTypeId
  label: string
  groupe: OutillageGroupeId
  /** Obligatoire réglementaire / CERFA pour intervention fluides */
  obligatoire?: boolean
  hint?: string
  /** Afficher / exiger la date d’étalonnage (détecteur, balance, analyseur…) */
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
    groupe: 'obligatoire',
    obligatoire: true,
    needsControleDate: true,
    hint: 'Contrôle annuel obligatoire — cadre CERFA [5]',
  },
  station_recuperation: {
    id: 'station_recuperation',
    label: 'Station de récupération / recycleur',
    groupe: 'obligatoire',
    obligatoire: true,
    hint: 'Récupération et transfert fluides frigorigènes',
  },
  pompe_vide: {
    id: 'pompe_vide',
    label: 'Pompe à vide',
    groupe: 'obligatoire',
    obligatoire: true,
    hint: 'Dépression circuit avant charge',
  },
  groupe_manometrique: {
    id: 'groupe_manometrique',
    label: 'Groupe manométrique (manifold)',
    groupe: 'obligatoire',
    obligatoire: true,
    needsControleDate: true,
    hint: 'Manomètres HP/BP — étalonnage périodique',
  },
  balance_pesee: {
    id: 'balance_pesee',
    label: 'Balance de pesée fluide',
    groupe: 'obligatoire',
    obligatoire: true,
    needsControleDate: true,
    hint: 'Quantités kg avant/après — étalonnage annuel',
  },
  vacuometre: {
    id: 'vacuometre',
    label: 'Vacuomètre numérique',
    groupe: 'mesure',
    needsControleDate: true,
    hint: 'Niveau de vide (micron / mbar) — étalonnage',
  },
  identificateur_fluide: {
    id: 'identificateur_fluide',
    label: 'Identificateur / analyseur de fluide',
    groupe: 'mesure',
    needsControleDate: true,
    hint: 'Vérifier le fluide avant récupération / charge',
  },
  detecteur_formier: {
    id: 'detecteur_formier',
    label: 'Détecteur mélange formier (N2/H2)',
    groupe: 'mesure',
    needsControleDate: true,
    hint: 'Recherche de fuite au formier — contrôle périodique',
  },
  station_charge: {
    id: 'station_charge',
    label: 'Station de charge automatique',
    groupe: 'mesure',
    hint: 'Charge / récupération automatique (groupe froid, PAC…)',
  },
  caisse_outils: {
    id: 'caisse_outils',
    label: 'Caisse à outils / servante',
    groupe: 'terrain',
    hint: 'Outillage à main, clés, embouts',
  },
  electroportatif: {
    id: 'electroportatif',
    label: 'Outillage électroportatif',
    groupe: 'terrain',
    hint: 'Perceuse, visseuse, disqueuse, aspirateur…',
  },
  chalumeau_poste: {
    id: 'chalumeau_poste',
    label: 'Poste à braser / chalumeau',
    groupe: 'terrain',
    hint: 'Brasure cuivre — habilitation requise',
  },
  presse_sertir: {
    id: 'presse_sertir',
    label: 'Pince / presse à sertir',
    groupe: 'terrain',
    hint: 'Sertissage tubes cuivre / multicouche',
  },
  thermometre_sonde: {
    id: 'thermometre_sonde',
    label: 'Thermomètre / sonde de température',
    groupe: 'mesure',
    needsControleDate: true,
    hint: 'Sonde contact, pince, infrarouge — étalonnage',
  },
  pince_amperemetrique: {
    id: 'pince_amperemetrique',
    label: 'Pince ampèremétrique / multimètre',
    groupe: 'mesure',
    needsControleDate: true,
    hint: 'Mesures électriques — vérification métrologique',
  },
  detecteur_tension: {
    id: 'detecteur_tension',
    label: 'Détecteur de tension / VAT',
    groupe: 'mesure',
    needsControleDate: true,
    hint: 'Vérification d’absence de tension — contrôle périodique',
  },
  camera_thermique: {
    id: 'camera_thermique',
    label: 'Caméra thermique',
    groupe: 'mesure',
    needsControleDate: true,
    hint: 'Diagnostic fuites, surchauffe — certificat d’étalonnage',
  },
  enregistreur_temperature: {
    id: 'enregistreur_temperature',
    label: 'Enregistreur de température',
    groupe: 'mesure',
    needsControleDate: true,
    hint: 'Sondes enregistreuses chambre / process — étalonnage',
  },
  cle_dynamometrique: {
    id: 'cle_dynamometrique',
    label: 'Clé dynamométrique',
    groupe: 'mesure',
    needsControleDate: true,
    hint: 'Serrage couples (brides, compresseur) — étalonnage',
  },
  analyseur_combustion: {
    id: 'analyseur_combustion',
    label: 'Analyseur / contrôleur de combustion gaz',
    groupe: 'cvc',
    needsControleDate: true,
    hint: 'O2, CO, rendement chaudière — étalonnage obligatoire',
  },
  anemometre: {
    id: 'anemometre',
    label: 'Anémomètre / débimètre d’air',
    groupe: 'cvc',
    needsControleDate: true,
    hint: 'Débits CTA / VMC / bouches — étalonnage',
  },
  hygrometre: {
    id: 'hygrometre',
    label: 'Hygromètre / thermo-hygromètre',
    groupe: 'cvc',
    needsControleDate: true,
    hint: 'Humidité ambiante / gaines — étalonnage',
  },
  micromanometre: {
    id: 'micromanometre',
    label: 'Micromanomètre ΔP (filtres CTA)',
    groupe: 'cvc',
    needsControleDate: true,
    hint: 'Pertes de charge filtres / caisson — étalonnage',
  },
  detecteur_co: {
    id: 'detecteur_co',
    label: 'Détecteur CO / CO₂',
    groupe: 'cvc',
    needsControleDate: true,
    hint: 'Local chaufferie, ambiance — étalonnage / cellules',
  },
  analyseur_eau: {
    id: 'analyseur_eau',
    label: 'pH-mètre / conductimètre (eau)',
    groupe: 'cvc',
    needsControleDate: true,
    hint: 'Traitement d’eau chaudière / circuit — étalonnage',
  },
  sonometre: {
    id: 'sonometre',
    label: 'Sonomètre',
    groupe: 'cvc',
    needsControleDate: true,
    hint: 'Nuisances CTA / groupes froids — étalonnage',
  },
  mallette_equilibrage: {
    id: 'mallette_equilibrage',
    label: 'Mallette d’équilibrage hydraulique',
    groupe: 'cvc',
    hint: 'Vannes d’équilibrage, ΔP réseaux',
  },
  generateur_fumee: {
    id: 'generateur_fumee',
    label: 'Générateur de fumée',
    groupe: 'cvc',
    hint: 'Test étanchéité gaines / VMC',
  },
  camera_inspection: {
    id: 'camera_inspection',
    label: 'Caméra d’inspection / endoscope',
    groupe: 'terrain',
    hint: 'Échangeurs, conduits, unités intérieures',
  },
  aspirateur_industriel: {
    id: 'aspirateur_industriel',
    label: 'Aspirateur industriel / nettoyeur',
    groupe: 'terrain',
    hint: 'Nettoyage condenseur, locaux techniques',
  },
  flexibles_raccords: {
    id: 'flexibles_raccords',
    label: 'Flexibles & raccords rapides',
    groupe: 'terrain',
    hint: 'Tuyaux HP/BP, quick-connect, adaptateurs',
  },
  clefs_outils_main: {
    id: 'clefs_outils_main',
    label: 'Clés & outils à main frigoriste',
    groupe: 'terrain',
    hint: 'Clés à cliquet, clés pipe, pinces, cutters',
  },
  epi_securite: {
    id: 'epi_securite',
    label: 'EPI (lunettes, gants, masque)',
    groupe: 'terrain',
    hint: 'Protection individuelle terrain',
  },
  telephone_pro: {
    id: 'telephone_pro',
    label: 'Téléphone professionnel',
    groupe: 'terrain',
    hint: 'Smartphone fourni par la société — n° de ligne, IMEI. L’opérateur valide la réception.',
  },
  bouteille_azote: {
    id: 'bouteille_azote',
    label: 'Bouteille azote / gaz inerte',
    groupe: 'terrain',
    hint: 'Essais pression, purge circuit',
  },
  echelle_escabeau: {
    id: 'echelle_escabeau',
    label: 'Échelle / escabeau',
    groupe: 'terrain',
    hint: 'Accès unités extérieures, VMC',
  },
  palan_elinguage: {
    id: 'palan_elinguage',
    label: 'Palan / élingues / sangles',
    groupe: 'terrain',
    hint: 'Levage groupes, CTA, unités extérieures',
  },
  autre: {
    id: 'autre',
    label: 'Autre outillage',
    groupe: 'terrain',
    hint: 'Précisez dans les notes',
  },
}

/** Liste ordonnée pour les menus déroulants (groupes, obligatoires en tête). */
export const OUTILLAGE_TYPE_OPTIONS: OutillageTypeDef[] = OUTILLAGE_GROUPE_ORDER.flatMap((g) =>
  (Object.keys(OUTILLAGE_CATALOG) as OutillageTypeId[])
    .map((id) => OUTILLAGE_CATALOG[id])
    .filter((t) => t.groupe === g),
)

export function outillageCatalogParGroupe(): {
  id: OutillageGroupeId
  label: string
  items: OutillageTypeDef[]
}[] {
  return OUTILLAGE_GROUPE_ORDER.map((id) => ({
    id,
    label: OUTILLAGE_GROUPE_LABELS[id],
    items: OUTILLAGE_TYPE_OPTIONS.filter((t) => t.groupe === id),
  })).filter((g) => g.items.length > 0)
}

export function outillageTypeLabel(type: OutillageTypeId | string): string {
  const def = OUTILLAGE_CATALOG[type as OutillageTypeId]
  return def?.label || type
}

export function isOutillageTypeId(v: unknown): v is OutillageTypeId {
  return typeof v === 'string' && v in OUTILLAGE_CATALOG
}

export function outillageNeedsControleDate(type: OutillageTypeId | string): boolean {
  if (!isOutillageTypeId(type)) return false
  return Boolean(OUTILLAGE_CATALOG[type].needsControleDate)
}

/** Édition Light : appareils avec date d’étalonnage (+ détecteur CERFA). */
export function outillageTypesEtalonnage(): OutillageTypeDef[] {
  return OUTILLAGE_TYPE_OPTIONS.filter((t) => t.needsControleDate)
}

export function outillageCatalogEtalonnageParGroupe(): {
  id: OutillageGroupeId
  label: string
  items: OutillageTypeDef[]
}[] {
  const wanted = new Set(outillageTypesEtalonnage().map((t) => t.id))
  return outillageCatalogParGroupe()
    .map((g) => ({ ...g, items: g.items.filter((t) => wanted.has(t.id)) }))
    .filter((g) => g.items.length > 0)
}

export function outillageCatalogEtalonnageParGroupeFiltre(query: string): {
  id: OutillageGroupeId
  label: string
  items: OutillageTypeDef[]
}[] {
  const wanted = new Set(
    filterOutillageCatalog(query)
      .filter((t) => t.needsControleDate)
      .map((t) => t.id),
  )
  if (!foldOutillageSearch(query)) return outillageCatalogEtalonnageParGroupe()
  return outillageCatalogEtalonnageParGroupe()
    .map((g) => ({ ...g, items: g.items.filter((t) => wanted.has(t.id)) }))
    .filter((g) => g.items.length > 0)
}

/** Recherche FR : « etalon » trouve « étalonnage », « anem » trouve « anémomètre ». */
export function foldOutillageSearch(s: string): string {
  return (s || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

export function outillageTypeMatchesQuery(def: OutillageTypeDef, query: string): boolean {
  const q = foldOutillageSearch(query)
  if (!q) return true
  const hay = foldOutillageSearch(
    [def.label, def.hint || '', def.id, def.needsControleDate ? 'etalonnage' : ''].join(' '),
  )
  return q.split(/\s+/).every((part) => hay.includes(part))
}

export function filterOutillageCatalog(query: string): OutillageTypeDef[] {
  return OUTILLAGE_TYPE_OPTIONS.filter((t) => outillageTypeMatchesQuery(t, query))
}

export function outillageCatalogParGroupeFiltre(query: string): {
  id: OutillageGroupeId
  label: string
  items: OutillageTypeDef[]
}[] {
  const wanted = new Set(filterOutillageCatalog(query).map((t) => t.id))
  if (!foldOutillageSearch(query)) return outillageCatalogParGroupe()
  return outillageCatalogParGroupe()
    .map((g) => ({ ...g, items: g.items.filter((t) => wanted.has(t.id)) }))
    .filter((g) => g.items.length > 0)
}
