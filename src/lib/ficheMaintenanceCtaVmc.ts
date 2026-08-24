/**
 * Fiche maintenance CTA / VMC — registre par période (sans mélange).
 * Mensuel ⊂ Trimestriel ⊂ Semestriel ⊂ Annuel.
 */

export type FicheCtaVmcResultat = 'conforme' | 'reserves' | 'non_conforme' | ''

export type PeriodeCtaVmc = 'mensuel' | 'trimestriel' | 'semestriel' | 'annuel'

export const PERIODES_CTA_VMC: {
  id: PeriodeCtaVmc
  label: string
  short: string
  hint: string
}[] = [
  { id: 'mensuel', label: 'Mensuel', short: '1M', hint: 'Exploitation & contrôle courant' },
  { id: 'trimestriel', label: 'Trimestriel', short: '3M', hint: 'Filtres & transmission' },
  { id: 'semestriel', label: 'Semestriel', short: '6M', hint: 'Turbine, filtres F7/F9, condensats' },
  { id: 'annuel', label: 'Annuel', short: '1Y', hint: 'Grand entretien & réglementaire' },
]

export const PERIODE_ORDER_CTA_VMC: PeriodeCtaVmc[] = [
  'mensuel',
  'trimestriel',
  'semestriel',
  'annuel',
]

/** Périodes incluses dans une visite (ex. annuel = les 4). */
export function periodesIncluesCtaVmc(periode: PeriodeCtaVmc): PeriodeCtaVmc[] {
  const i = PERIODE_ORDER_CTA_VMC.indexOf(periode)
  return PERIODE_ORDER_CTA_VMC.slice(0, Math.max(0, i) + 1)
}

export type FicheCtaVmcCheckId =
  // —— Mensuel (1M) ——
  | 'm_bouches_extraction'
  | 'm_entrees_air'
  | 'm_caisson_visuel'
  | 'm_voyants_alarmes'
  // —— Trimestriel (3M) ——
  | 't_delta_p_filtres'
  | 't_prefiltres_g4_m5'
  | 't_courroies_tension'
  | 't_registres_air'
  // —— Semestriel (6M) ——
  | 's_turbine_pales'
  | 's_viroles_fond'
  | 's_filtres_f7_f9'
  | 's_gaines_flexibles'
  | 's_bac_condensats'
  // —— Annuel (1Y) ——
  | 'a_graissage_paliers'
  | 'a_remplacement_courroies'
  | 'a_silent_blocks'
  | 'a_intensite_moteur'
  | 'a_connexions_electriques'
  | 'a_commutateur_pv_gv'
  | 'a_asservissements_incendie'
  | 'a_debits_vitesses'

export type CtaVmcCheckItem = {
  id: FicheCtaVmcCheckId
  label: string
}

export type CtaVmcSection = {
  id: string
  periode: PeriodeCtaVmc
  title: string
  items: CtaVmcCheckItem[]
}

export const FICHE_CTA_VMC_SECTIONS: CtaVmcSection[] = [
  {
    id: 'm_courant',
    periode: 'mensuel',
    title: '1. Contrôles mensuels (1M)',
    items: [
      {
        id: 'm_bouches_extraction',
        label: 'Nettoyage et dépoussiérage des bouches d’extraction (Cuisine, SDB, WC)',
      },
      {
        id: 'm_entrees_air',
        label:
          'Contrôle du passage d’air sur les entrées d’air en façade / autoréglables / hygro',
      },
      {
        id: 'm_caisson_visuel',
        label:
          'Inspection visuelle du caisson d’extraction (absence de bruit anormal / vibration)',
      },
      {
        id: 'm_voyants_alarmes',
        label: 'Relevé visuel des voyants de défaut / alarmes sur l’armoire de commande',
      },
    ],
  },
  {
    id: 't_filtres',
    periode: 'trimestriel',
    title: '2. Filtres, transmission & registres (3M)',
    items: [
      {
        id: 't_delta_p_filtres',
        label: 'Relevé de la pression différentielle (ΔP) sur les filtres',
      },
      {
        id: 't_prefiltres_g4_m5',
        label: 'Nettoyage ou remplacement des pré-filtres (G4 / M5)',
      },
      {
        id: 't_courroies_tension',
        label: 'Inspection de la tension et de l’alignement des courroies de transmission',
      },
      {
        id: 't_registres_air',
        label: 'Vérification de la propreté des registres d’air neuf et d’air extrait',
      },
    ],
  },
  {
    id: 's_entretien',
    periode: 'semestriel',
    title: '3. Turbine, filtres secondaires & condensats (6M)',
    items: [
      {
        id: 's_turbine_pales',
        label: 'Nettoyage et dépoussiérage de la turbine d’extraction VMC et des pales',
      },
      {
        id: 's_viroles_fond',
        label: 'Nettoyage des viroles d’aspiration et du fond de caisson',
      },
      {
        id: 's_filtres_f7_f9',
        label: 'Remplacement des filtres secondaires (F7 / F9) sur les CTA',
      },
      {
        id: 's_gaines_flexibles',
        label: 'Inspection de l’état et de l’étanchéité des gaines flexibles d’extraction',
      },
      {
        id: 's_bac_condensats',
        label: 'Nettoyage du bac à condensats et contrôle du siphon (CTA double flux)',
      },
    ],
  },
  {
    id: 'a_grand',
    periode: 'annuel',
    title: '4. Grand entretien & contrôles réglementaires (1Y)',
    items: [
      {
        id: 'a_graissage_paliers',
        label: 'Graissage des paliers et roulements du moteur et du ventilateur',
      },
      {
        id: 'a_remplacement_courroies',
        label: 'Remplacement systématique des courroies d’entraînement usées',
      },
      {
        id: 'a_silent_blocks',
        label: 'Contrôle des silent-blocks et des manchettes souples de raccordement',
      },
      {
        id: 'a_intensite_moteur',
        label:
          'Mesure de l’intensité absorbée (en Ampères) et comparaison à la plaque signalétique',
      },
      {
        id: 'a_connexions_electriques',
        label: 'Resserrage des connexions électriques dans le coffret / variateur de fréquence',
      },
      {
        id: 'a_commutateur_pv_gv',
        label: 'Test du commutateur PV/GV (Petite Vitesse / Grande Vitesse)',
      },
      {
        id: 'a_asservissements_incendie',
        label:
          'Tests réglementaires : vérification des asservissements incendie, arrêt coup de poing et clapets coupe-feu',
      },
      {
        id: 'a_debits_vitesses',
        label: 'Mesure des débits et des vitesses d’air aux bouches principales (anémomètre)',
      },
    ],
  },
]

export function sectionsForPeriodeCtaVmc(periode: PeriodeCtaVmc): CtaVmcSection[] {
  const incl = new Set(periodesIncluesCtaVmc(periode))
  return FICHE_CTA_VMC_SECTIONS.filter((s) => incl.has(s.periode))
}

/** Relevés numériques optionnels associés à la fiche. */
export type FicheCtaVmcMesures = {
  /** ΔP filtres (Pa) — trimestriel+ */
  deltaPFiltresPa?: number | null
  /** Intensité absorbée (A) — annuel */
  intensiteAbsorbeeA?: number | null
  /** Intensité plaque signalétique (A) — annuel */
  intensitePlaqueA?: number | null
  /** Débit principal (m³/h) — annuel */
  debitPrincipalM3h?: number | null
  /** Vitesse d’air (m/s) — annuel */
  vitesseAirMs?: number | null
}

export type TypeEquipCtaVmc = 'cta' | 'vmc' | 'cta_vmc' | ''

export const TYPES_EQUIP_CTA_VMC: { id: TypeEquipCtaVmc; label: string }[] = [
  { id: 'cta', label: 'CTA' },
  { id: 'vmc', label: 'VMC' },
  { id: 'cta_vmc', label: 'CTA + VMC' },
]

export interface FicheMaintenanceCtaVmc {
  id: string
  numero: string
  date: string
  technicien: string
  /** Période de la visite (onglet actif) */
  periode: PeriodeCtaVmc
  clientId?: string
  chantierId?: string
  equipementId?: string
  clientNom: string
  adresse: string
  marqueModele: string
  numeroSerie: string
  /** CTA / VMC / les deux */
  typeEquipement: TypeEquipCtaVmc
  checks: Partial<Record<FicheCtaVmcCheckId, boolean>>
  mesures: FicheCtaVmcMesures
  observations: string
  resultat: FicheCtaVmcResultat
  signatureTechnicienImage?: string
  signatureClientImage?: string
  createdAt: string
  updatedAt: string
  hasPdf?: boolean
  pdfFileName?: string
  /**
   * Impression : 1 = un PDF par équipement (défaut).
   * 2 ou 3 = regrouper plusieurs équipements sur la même page PDF.
   */
  equipementsParFiche?: 1 | 2 | 3
}

export function blankFicheCtaVmcChecks(
  periode: PeriodeCtaVmc = 'mensuel',
): Partial<Record<FicheCtaVmcCheckId, boolean>> {
  const o: Partial<Record<FicheCtaVmcCheckId, boolean>> = {}
  for (const sec of sectionsForPeriodeCtaVmc(periode)) {
    for (const it of sec.items) o[it.id] = true
  }
  return o
}

export function blankFicheCtaVmcMesures(): FicheCtaVmcMesures {
  return {
    deltaPFiltresPa: null,
    intensiteAbsorbeeA: null,
    intensitePlaqueA: null,
    debitPrincipalM3h: null,
    vitesseAirMs: null,
  }
}

export function blankFicheMaintenanceCtaVmc(
  periode: PeriodeCtaVmc = 'mensuel',
): Omit<FicheMaintenanceCtaVmc, 'id' | 'createdAt' | 'updatedAt'> {
  return {
    numero: '',
    date: new Date().toISOString().slice(0, 10),
    technicien: '',
    periode,
    clientNom: '',
    adresse: '',
    marqueModele: '',
    numeroSerie: '',
    typeEquipement: 'cta_vmc',
    checks: blankFicheCtaVmcChecks(periode),
    mesures: blankFicheCtaVmcMesures(),
    observations: '',
    resultat: 'conforme',
  }
}

/** Fusionne les checks déjà faits quand on change de période (conserve + ajoute nouveaux à true). */
export function mergeChecksForPeriodeCtaVmc(
  current: Partial<Record<FicheCtaVmcCheckId, boolean>>,
  periode: PeriodeCtaVmc,
): Partial<Record<FicheCtaVmcCheckId, boolean>> {
  const next = { ...blankFicheCtaVmcChecks(periode) }
  for (const [k, v] of Object.entries(current)) {
    if (k in next) next[k as FicheCtaVmcCheckId] = v
  }
  return next
}
