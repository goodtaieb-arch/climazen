/** Points de contrôle — fiche maintenance clim / PAC (hors CERFA). */

export type FicheMaintResultat = 'conforme' | 'reserves' | 'non_conforme' | ''

export type FicheMaintCheckId =
  | 'ui_filtres'
  | 'ui_echangeur'
  | 'ui_bac'
  | 'ui_condensats'
  | 'ui_electrique'
  | 'ui_telecommande'
  | 'ue_batterie'
  | 'ue_ventilateur'
  | 'ue_silentblocs'
  | 'ue_electrique'
  | 'ue_isolation'
  | 'fr_etancheite'
  | 'fr_souffle'
  | 'fr_repris'
  | 'fr_delta'
  | 'fr_pression'
  | 'el_tension'
  | 'el_intensite'
  | 'el_modes'

export const FICHE_MAINT_SECTIONS: {
  id: string
  title: string
  items: { id: FicheMaintCheckId; label: string; hasValue?: boolean }[]
}[] = [
  {
    id: 'ui',
    title: '1. Unité intérieure (évaporation / brassage)',
    items: [
      { id: 'ui_filtres', label: 'Nettoyage et désinfection des filtres à air' },
      { id: 'ui_echangeur', label: 'Dépoussiérage et nettoyage de l’échangeur (batterie ailetée)' },
      { id: 'ui_bac', label: 'Désinfection du bac à condensats (produit fongicide/bactéricide)' },
      {
        id: 'ui_condensats',
        label: 'Test d’écoulement des condensats + vérification de la pompe de relevage',
      },
      {
        id: 'ui_electrique',
        label: 'Contrôle de l’état des connexions électriques et serrage des borniers',
      },
      {
        id: 'ui_telecommande',
        label: 'Vérification de la télécommande / thermostat (piles, consigne, affichage)',
      },
    ],
  },
  {
    id: 'ue',
    title: '2. Unité extérieure (condensation / compresseur)',
    items: [
      { id: 'ue_batterie', label: 'Nettoyage de la batterie extérieure (dégagement feuilles/poussières)' },
      {
        id: 'ue_ventilateur',
        label: 'Inspection des pales du ventilateur et vérification de la rotation',
      },
      {
        id: 'ue_silentblocs',
        label: 'Contrôle visuel de l’état des silent-blocs et fixations anti-vibratiles',
      },
      {
        id: 'ue_electrique',
        label: 'Resserrement des connexions électriques de la carte d’alimentation / Inverter',
      },
      {
        id: 'ue_isolation',
        label: 'Inspection de l’état de l’isolation des liaisons frigorifiques',
      },
    ],
  },
  {
    id: 'fr',
    title: '3. Contrôles frigorifiques & étanchéité (obligation légale)',
    items: [
      {
        id: 'fr_etancheite',
        label: 'Contrôle d’étanchéité du circuit (détecteur électronique / mille-bulles)',
      },
      { id: 'fr_souffle', label: 'Relevé température d’air soufflé (°C)', hasValue: true },
      { id: 'fr_repris', label: 'Relevé température d’air repris (°C)', hasValue: true },
      {
        id: 'fr_delta',
        label: 'Delta T° (reprise − soufflage) — conforme si 8 à 12 °C',
        hasValue: true,
      },
      {
        id: 'fr_pression',
        label: 'Pression basse (BP) / surchauffe si manomètre (bar)',
        hasValue: true,
      },
    ],
  },
  {
    id: 'el',
    title: '4. Relevés électriques & fonctionnement',
    items: [
      { id: 'el_tension', label: 'Tension d’alimentation générale (V)', hasValue: true },
      {
        id: 'el_intensite',
        label: 'Intensité absorbée en charge par le compresseur (A)',
        hasValue: true,
      },
      {
        id: 'el_modes',
        label: 'Validation des basculements de modes (Chaud / Froid / Déshumidification)',
      },
    ],
  },
]

export interface FicheMaintenanceClim {
  id: string
  /** N° OT / intervention (OT20260001) — signé */
  numero: string
  date: string
  technicien: string
  clientId?: string
  chantierId?: string
  equipementId?: string
  clientNom: string
  adresse: string
  marqueModele: string
  numeroSerie: string
  fluide: string
  /** Quantité de fluide (kg) — charge nominale équipement */
  quantiteFluideKg?: number | null
  checks: Partial<Record<FicheMaintCheckId, boolean>>
  tempSouffleC?: number | null
  tempReprisC?: number | null
  deltaTC?: number | null
  pressionBpBar?: number | null
  tensionV?: number | null
  intensiteA?: number | null
  observations: string
  resultat: FicheMaintResultat
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

/** Toutes les tâches cochées par défaut — l’opérateur décoche ce qui n’a pas été fait. */
export function blankFicheMaintChecks(): Partial<Record<FicheMaintCheckId, boolean>> {
  const o: Partial<Record<FicheMaintCheckId, boolean>> = {}
  for (const sec of FICHE_MAINT_SECTIONS) {
    for (const it of sec.items) o[it.id] = true
  }
  return o
}

export function blankFicheMaintenanceClim(): Omit<FicheMaintenanceClim, 'id' | 'createdAt' | 'updatedAt'> {
  return {
    numero: '',
    date: new Date().toISOString().slice(0, 10),
    technicien: '',
    clientNom: '',
    adresse: '',
    marqueModele: '',
    numeroSerie: '',
    fluide: '',
    quantiteFluideKg: null,
    checks: blankFicheMaintChecks(),
    tempSouffleC: null,
    tempReprisC: null,
    deltaTC: null,
    pressionBpBar: null,
    tensionV: null,
    intensiteA: null,
    observations: '',
    resultat: 'conforme',
  }
}
