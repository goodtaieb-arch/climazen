/**
 * Fiche maintenance chaufferie P2/P3 — registre par période (sans mélange).
 * Mensuel ⊂ Trimestriel ⊂ Semestriel ⊂ Annuel.
 */

export type FicheChauffResultat = 'conforme' | 'reserves' | 'non_conforme' | ''

export type PeriodeChaufferie = 'mensuel' | 'trimestriel' | 'semestriel' | 'annuel'

export const PERIODES_CHAUFFERIE: {
  id: PeriodeChaufferie
  label: string
  short: string
  hint: string
}[] = [
  { id: 'mensuel', label: 'Mensuel', short: 'M', hint: 'Exploitation & suivi' },
  { id: 'trimestriel', label: 'Trimestriel', short: 'T', hint: 'Manœuvres & entretien courant' },
  { id: 'semestriel', label: 'Semestriel', short: 'S', hint: 'Mi-saison / basculement' },
  { id: 'annuel', label: 'Annuel', short: 'A', hint: 'Grand entretien & conformité' },
]

export const PERIODE_ORDER: PeriodeChaufferie[] = [
  'mensuel',
  'trimestriel',
  'semestriel',
  'annuel',
]

/** Périodes incluses dans une visite (ex. annuel = les 4). */
export function periodesInclues(periode: PeriodeChaufferie): PeriodeChaufferie[] {
  const i = PERIODE_ORDER.indexOf(periode)
  return PERIODE_ORDER.slice(0, Math.max(0, i) + 1)
}

export type FicheChauffCheckId =
  // —— Mensuel ——
  | 'm_releve_temps'
  | 'm_releve_pressions'
  | 'm_niveau_sel'
  | 'm_th_ph'
  | 'm_fuite_visuelle'
  | 'm_alarmes_regulation'
  | 'm_ventilation_local'
  // —— Trimestriel ——
  | 't_perm_pompes'
  | 't_pompe_secours'
  | 't_rotation_bruit'
  | 't_etancheite_garnitures'
  | 't_purge_pot_boue'
  | 't_filtre_tamis'
  | 't_degazage_purge'
  | 't_manoeuvre_vannes'
  | 't_serrage_echangeur'
  | 't_delta_approche'
  // —— Semestriel ——
  | 's_vase_pregonflage'
  | 's_centrale_pression'
  | 's_manoeuvre_v3v'
  | 's_fermeture_vannes'
  | 's_sondes_etalonnage'
  | 's_chasse_soupapes'
  | 's_disconnecteur'
  // —— Annuel ——
  | 'a_ramonage_corps'
  | 'a_bruleur_demontage'
  | 'a_filtre_fioul_gaz'
  | 'a_analyse_combustion'
  | 'a_echangeur_dp'
  | 'a_detartrage_echangeur'
  | 'a_analyse_fluide'
  | 'a_purge_reseau'
  | 'a_arret_urgence'
  | 'a_vanne_police'
  | 'a_detecteurs_gaz'
  | 'a_pressostats_aquastats'

export type ChauffCheckItem = {
  id: FicheChauffCheckId
  label: string
  /** Champ numérique lié (clé dans `mesures`) */
  measureKey?: keyof FicheChauffMesures
}

export type ChauffSection = {
  id: string
  periode: PeriodeChaufferie
  title: string
  items: ChauffCheckItem[]
}

export const FICHE_CHAUFF_SECTIONS: ChauffSection[] = [
  {
    id: 'm_releves',
    periode: 'mensuel',
    title: '1. Relevés de fonctionnement',
    items: [
      {
        id: 'm_releve_temps',
        label:
          'Relevés températures (°C) : départ/retour chaudière, échangeur plaques, chauffage, ECS/bouclage',
      },
      {
        id: 'm_releve_pressions',
        label:
          'Pressions réseau (froid/chaud), ΔP échangeur, eau brute / traitée',
      },
      {
        id: 'm_niveau_sel',
        label: 'Niveau de sel dans le bac de l’adoucisseur (conforme / appoint)',
      },
      {
        id: 'm_th_ph',
        label: 'Chimie : TH eau brute / adoucie / réseau + pH circuit chauffage',
      },
    ],
  },
  {
    id: 'm_visuel',
    periode: 'mensuel',
    title: '2. Contrôles visuels & sécurité de base',
    items: [
      {
        id: 'm_fuite_visuelle',
        label:
          'Inspection visuelle des fuites (vannes, joints d’échangeur, presse-étoupes, pompes)',
      },
      {
        id: 'm_alarmes_regulation',
        label: 'Contrôle d’affichage des voyants d’alarme / défaut sur l’armoire de régulation',
      },
      {
        id: 'm_ventilation_local',
        label: 'Vérification des amenées d’air et de la grille de ventilation du local',
      },
    ],
  },
  {
    id: 't_pompes',
    periode: 'trimestriel',
    title: '3. Circulation & pompes',
    items: [
      {
        id: 't_perm_pompes',
        label:
          'Permutation manuelle / automatique des pompes doubles (chauffage, charge échangeur, bouclage ECS)',
      },
      {
        id: 't_pompe_secours',
        label: 'Vérification du basculement sur pompe de secours + voyant de défaut',
      },
      {
        id: 't_rotation_bruit',
        label: 'Sens de rotation + absence de bruit / vibration anormale (roulements)',
      },
      {
        id: 't_etancheite_garnitures',
        label: 'Contrôle d’étanchéité des garnitures mécaniques des pompes',
      },
    ],
  },
  {
    id: 't_filtration',
    periode: 'trimestriel',
    title: '4. Filtration, dégazage & vannes',
    items: [
      {
        id: 't_purge_pot_boue',
        label: 'Filtres à boue / pots magnétiques : purge point bas + nettoyage barreau magnétique',
      },
      {
        id: 't_filtre_tamis',
        label: 'Filtres à tamis (eau / fioul) : isolement, nettoyage panier inox, remontage',
      },
      {
        id: 't_degazage_purge',
        label: 'Dégazeurs / purgeurs : inspection et purge manuelle (bouteilles, points hauts)',
      },
      {
        id: 't_manoeuvre_vannes',
        label: 'Manœuvre complète ouverture/fermeture de toutes les vannes du local',
      },
    ],
  },
  {
    id: 't_echangeur',
    periode: 'trimestriel',
    title: '5. Échangeur à plaques',
    items: [
      {
        id: 't_serrage_echangeur',
        label: 'Contrôle visuel du serrage du tirant de l’échangeur',
      },
      {
        id: 't_delta_approche',
        label:
          'Relevé températures d’approche (ΔT primaire / secondaire) — encrassement / entartrage',
      },
    ],
  },
  {
    id: 's_vases',
    periode: 'semestriel',
    title: '6. Vases d’expansion & maintien de pression',
    items: [
      {
        id: 's_vase_pregonflage',
        label:
          'Isolement, vidange côté eau + contrôle pression de prégonflage à l’azote des vases',
        measureKey: 'vasePregonflageBar',
      },
      {
        id: 's_centrale_pression',
        label: 'Fonctionnement centrale de maintien de pression (transfert / gavage)',
      },
    ],
  },
  {
    id: 's_regulation',
    periode: 'semestriel',
    title: '7. Régulation & servomoteurs',
    items: [
      {
        id: 's_manoeuvre_v3v',
        label: 'Test manœuvre forcée 0→100 % des vannes 3 voies / 4 voies (primaire & secondaire)',
      },
      {
        id: 's_fermeture_vannes',
        label: 'Vérification de la fermeture étanche des vannes sous régulation',
      },
      {
        id: 's_sondes_etalonnage',
        label: 'Contrôle sondes (extérieure, départ, ambiance) + réétalonnage si décalage',
      },
    ],
  },
  {
    id: 's_securite',
    periode: 'semestriel',
    title: '8. Organes de sécurité',
    items: [
      {
        id: 's_chasse_soupapes',
        label: 'Essai de chasse manuel des soupapes de sécurité (3 / 7 / 10 bar)',
      },
      {
        id: 's_disconnecteur',
        label: 'Disconnecteur de remplissage : inspection (absence de fuite à l’égout)',
      },
    ],
  },
  {
    id: 'a_generateur',
    periode: 'annuel',
    title: '9. Générateur & combustion',
    items: [
      {
        id: 'a_ramonage_corps',
        label: 'Démontage, ramonage et nettoyage corps de chauffe, foyer et carneaux',
      },
      {
        id: 'a_bruleur_demontage',
        label:
          'Démontage brûleur : canon, accroche-flamme, électrodes, remplacement gicleur (fioul)',
      },
      {
        id: 'a_filtre_fioul_gaz',
        label: 'Contrôle et nettoyage filtre à fioul / flexible gaz',
      },
      {
        id: 'a_analyse_combustion',
        label: 'Analyse de combustion complète avec ticket (CO₂, O₂, CO, rendement)',
      },
    ],
  },
  {
    id: 'a_echangeur',
    periode: 'annuel',
    title: '10. Échangeur à plaques (entretien lourd)',
    items: [
      {
        id: 'a_echangeur_dp',
        label: 'Contrôle du différentiel de pression complet',
      },
      {
        id: 'a_detartrage_echangeur',
        label:
          'Si baisse de rendement : détartrage / désembouage chimique CIP ou remplacement joints/plaques',
      },
    ],
  },
  {
    id: 'a_chimie',
    periode: 'annuel',
    title: '11. Circuit chauffage & chimie',
    items: [
      {
        id: 'a_analyse_fluide',
        label: 'Analyse fluide caloporteur (inhibiteur, glycol, turbidité)',
      },
      {
        id: 'a_purge_reseau',
        label: 'Rinçage / vidange pot de boue et purge générale du réseau',
      },
    ],
  },
  {
    id: 'a_reglementaire',
    periode: 'annuel',
    title: '12. Sécurités réglementaires chaufferie',
    items: [
      {
        id: 'a_arret_urgence',
        label: 'Test bouton d’arrêt d’urgence extérieur (coup de poing)',
      },
      {
        id: 'a_vanne_police',
        label: 'Test électrovanne coupure gaz extérieure / vanne police fioul',
      },
      {
        id: 'a_detecteurs_gaz',
        label: 'Test détecteurs fuite gaz / CO (étalonnage ou remplacement cellules)',
      },
      {
        id: 'a_pressostats_aquastats',
        label: 'Test pressostats manque d’eau / aquastats sécurité HT à réarmement manuel',
      },
    ],
  },
]

export function sectionsForPeriode(periode: PeriodeChaufferie): ChauffSection[] {
  const incl = new Set(periodesInclues(periode))
  return FICHE_CHAUFF_SECTIONS.filter((s) => incl.has(s.periode))
}

/** Relevés numériques / texte associés à la fiche. */
export type FicheChauffMesures = {
  // Températures °C
  tempDepChaudiereC?: number | null
  tempRetChaudiereC?: number | null
  tempEchPrimEntreeC?: number | null
  tempEchPrimSortieC?: number | null
  tempEchSecEntreeC?: number | null
  tempEchSecSortieC?: number | null
  tempDepChauffageC?: number | null
  tempRetChauffageC?: number | null
  tempDepEcsC?: number | null
  tempBouclageEcsC?: number | null
  // Pressions bar
  pressionReseauFroidBar?: number | null
  pressionReseauChaudBar?: number | null
  deltaPEchangeurBar?: number | null
  pressionEauBruteBar?: number | null
  pressionEauTraiteeBar?: number | null
  // Chimie
  thEauBrute?: number | null
  thEauAdoucie?: number | null
  thEauReseau?: number | null
  phCircuit?: number | null
  niveauSelConforme?: boolean | null
  // Semestriel
  vasePregonflageBar?: number | null
  // Annuel combustion
  combustionCo2Pct?: number | null
  combustionO2Pct?: number | null
  combustionCoAmbiantPpm?: number | null
  combustionCoFumeesPpm?: number | null
  combustionRendementPct?: number | null
}

export interface FicheMaintenanceChaufferie {
  id: string
  numero: string
  date: string
  technicien: string
  /** Période de la visite (onglet actif) */
  periode: PeriodeChaufferie
  clientId?: string
  chantierId?: string
  equipementId?: string
  clientNom: string
  adresse: string
  marqueModele: string
  numeroSerie: string
  /** Combustible / énergie (fioul, gaz, …) */
  energie: string
  checks: Partial<Record<FicheChauffCheckId, boolean>>
  mesures: FicheChauffMesures
  observations: string
  resultat: FicheChauffResultat
  signatureTechnicienImage?: string
  signatureClientImage?: string
  createdAt: string
  updatedAt: string
  hasPdf?: boolean
  pdfFileName?: string
}

export function blankFicheChauffChecks(
  periode: PeriodeChaufferie = 'mensuel',
): Partial<Record<FicheChauffCheckId, boolean>> {
  const o: Partial<Record<FicheChauffCheckId, boolean>> = {}
  for (const sec of sectionsForPeriode(periode)) {
    for (const it of sec.items) o[it.id] = true
  }
  return o
}

export function blankFicheChauffMesures(): FicheChauffMesures {
  return {
    tempDepChaudiereC: null,
    tempRetChaudiereC: null,
    tempEchPrimEntreeC: null,
    tempEchPrimSortieC: null,
    tempEchSecEntreeC: null,
    tempEchSecSortieC: null,
    tempDepChauffageC: null,
    tempRetChauffageC: null,
    tempDepEcsC: null,
    tempBouclageEcsC: null,
    pressionReseauFroidBar: null,
    pressionReseauChaudBar: null,
    deltaPEchangeurBar: null,
    pressionEauBruteBar: null,
    pressionEauTraiteeBar: null,
    thEauBrute: null,
    thEauAdoucie: null,
    thEauReseau: null,
    phCircuit: null,
    niveauSelConforme: true,
    vasePregonflageBar: null,
    combustionCo2Pct: null,
    combustionO2Pct: null,
    combustionCoAmbiantPpm: null,
    combustionCoFumeesPpm: null,
    combustionRendementPct: null,
  }
}

export function blankFicheMaintenanceChaufferie(
  periode: PeriodeChaufferie = 'mensuel',
): Omit<FicheMaintenanceChaufferie, 'id' | 'createdAt' | 'updatedAt'> {
  return {
    numero: '',
    date: new Date().toISOString().slice(0, 10),
    technicien: '',
    periode,
    clientNom: '',
    adresse: '',
    marqueModele: '',
    numeroSerie: '',
    energie: '',
    checks: blankFicheChauffChecks(periode),
    mesures: blankFicheChauffMesures(),
    observations: '',
    resultat: 'conforme',
  }
}

/** Fusionne les checks déjà faits quand on change de période (conserve + ajoute nouveaux à true). */
export function mergeChecksForPeriode(
  current: Partial<Record<FicheChauffCheckId, boolean>>,
  periode: PeriodeChaufferie,
): Partial<Record<FicheChauffCheckId, boolean>> {
  const next = { ...blankFicheChauffChecks(periode) }
  for (const [k, v] of Object.entries(current)) {
    if (k in next) next[k as FicheChauffCheckId] = v
  }
  return next
}
