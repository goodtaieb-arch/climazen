/** Référence réglementaire : CERFA FI 15497-04 (fiche d'intervention fluides). */

export type NatureIntervention =
  | 'mise_en_service'
  | 'assemblage'
  | 'modification'
  | 'entretien_reparation'
  | 'controle_etancheite_periodique'
  | 'controle_etancheite_non_periodique'
  | 'demantelement'
  | 'recuperation'
  | 'charge'
  | 'autre'

export const NATURE_LABELS: Record<NatureIntervention, string> = {
  mise_en_service: 'Mise en service',
  assemblage: 'Assemblage',
  modification: 'Modification',
  entretien_reparation: 'Entretien / réparation',
  controle_etancheite_periodique: 'Contrôle d’étanchéité périodique',
  controle_etancheite_non_periodique: 'Contrôle d’étanchéité non périodique',
  demantelement: 'Démantèlement',
  recuperation: 'Récupération de fluide',
  charge: 'Charge de fluide',
  autre: 'Autre manipulation de fluide',
}

export type ContenantType = 'vierge' | 'regenere' | 'recuperation' | 'transfert'

/** Mouvement de fluide → n° de bouteille obligatoire (F-Gas / Cerfa). */
export function natureImpliqueMouvementFluide(natures: NatureIntervention[]): boolean {
  // Obligatoire : charge, récupération, démantèlement.
  // Les autres natures (mise en service, entretien, contrôles, autre…) : bouteille au choix.
  return natures.some(
    (n) => n === 'recuperation' || n === 'charge' || n === 'demantelement',
  )
}

/** true si un conteneur doit être identifié sur la fiche. */
export function needsBottleNumber(opts: {
  natures: NatureIntervention[]
  /** Quantité totale manipulée sur une ou plusieurs bouteilles */
  manipQty?: number
  stockItemId?: string
  /** Nombre de lignes bouteille renseignées */
  manipCount?: number
}): boolean {
  if (natureImpliqueMouvementFluide(opts.natures)) return true
  if ((opts.manipQty ?? 0) > 0) return true
  if (opts.stockItemId) return true
  if ((opts.manipCount ?? 0) > 0) return true
  return false
}

export interface Operateur {
  id: string
  raisonSociale: string
  adresse: string
  siret: string
  attestationNumero: string
  telephone: string
  email: string
  /** Détecteur manuel entreprise — cadre [5] Identification */
  detecteurIdentification?: string
  /** Date du dernier contrôle / étalonnage (annuel) — cadre [5] Contrôlé le */
  detecteurControleDate?: string
  /** Nom de l’opérateur signataire (prérempli sur CERFA) */
  signataireNom?: string
  /** Qualité / fonction */
  signataireQualite?: string
  /** Signature manuscrite PNG data URL — réutilisée automatiquement */
  signatureImage?: string
}

export interface Client {
  id: string
  /** Cadre [2] Détenteur */
  raisonSociale: string
  nomContact: string
  adresse: string
  codePostal: string
  ville: string
  telephone: string
  email: string
  notes?: string
  createdAt: string
}

export interface Chantier {
  id: string
  clientId: string
  nom: string
  adresse: string
  codePostal: string
  ville: string
  /** Cadre [3] équipement */
  equipementType: string
  equipementMarque: string
  equipementModele: string
  equipementNumeroSerie: string
  fluideType: string
  chargeNominaleKg: number
  /** tonnes équivalent CO2 si connu — Equipement_teqCO2 */
  teqCO2?: number
  detectionPermanente: boolean
  statut: 'actif' | 'termine' | 'archive'
  notes?: string
  createdAt: string
}

export interface StockItem {
  id: string
  /** Ex. R-32, R-410A, R-1234yf */
  fluide: string
  contenantType: ContenantType
  numeroContenant: string
  /** Quantité restante actuelle (kg) */
  quantiteKg: number
  /** Quantité à l’entrée en stock (kg) — pour suivre les usages partiels */
  quantiteInitialeKg?: number
  /** BSFF Trackdéchets si applicable */
  bsffReference?: string
  codeUn?: string
  denominationAdr?: string
  notes?: string
  /**
   * Bon de retour de consigne (bouteille neuve vide / emballage réutilisable).
   * Preuve pour crédit fournisseur + audit attestation de capacité.
   */
  bonRetourConsigne?: string
  bonRetourDate?: string
  bonRetourFournisseur?: string
  bonRetourNotes?: string
  /** Date d’enregistrement du retour (ISO) */
  retourneAt?: string
  updatedAt: string
}

/** Mouvement stock lié à un CERFA (ex. sortie 2 kg d’une bouteille de 10 kg). */
export type StockMouvementSens = 'sortie' | 'entree'

export type StockMouvementKind = 'cerfa' | 'retour_consigne'

export interface StockMouvement {
  id: string
  stockItemId: string
  numeroContenant: string
  fluide: string
  sens: StockMouvementSens
  /** Quantité mouvementée (toujours > 0) */
  quantiteKg: number
  quantiteAvantKg: number
  quantiteApresKg: number
  date: string
  /** Fiche / CERFA liée (absent pour retour de consigne) */
  interventionId?: string
  /** Libellé traçabilité ex. CERFA-… ou BON-RETOUR-… */
  cerfaLabel: string
  createdByName?: string
  note?: string
  kind?: StockMouvementKind
  /** N° bon de retour de consigne */
  bonRetourReference?: string
}

export interface CerfaDraft {
  id: string
  clientId: string
  chantierId: string
  dateIntervention: string

  /** [1] Opérateur — copie au moment de l'intervention */
  operateur: Operateur

  /** [4] */
  natures: NatureIntervention[]

  /**
   * [5] Détecteur manuel de fuite
   * Identification → Detecteur_ID
   * Contrôlé le (annuel) → Controle_Jour / Mois / Annee
   */
  detecteurIdentification?: string
  detecteurControleDate?: string

  /** [6] */
  detectionPermanente: boolean

  /** [7] */
  fluideType: string
  quantiteTotaleKg: number
  quantiteHfoKg?: number
  teqCO2?: number

  /** [8]/[9] périodicité (ex. 12 mois) */
  periodiciteControle?: string

  /** [10] */
  fuiteConstatee: boolean
  fuiteDescription?: string
  fuiteReparee?: boolean
  fuiteLocalisation2?: string
  fuiteLocalisation3?: string
  fuite2Reparee?: boolean
  fuite3Reparee?: boolean

  /** [11] manipulation */
  manipulations: {
    type: ContenantType
    stockItemId?: string
    quantiteKg: number
    numeroContenant?: string
    bsffReference?: string
    /** Entrée (récup) ou sortie (usage / vidage) — historique lié au CERFA */
    sens?: StockMouvementSens
  }[]

  /** [12] */
  codeUn?: string
  denominationAdr?: string

  /** [13] */
  installationDestination?: string

  /** [14] */
  observations?: string

  signatureOperateur?: string
  signatureOperateurQualite?: string
  signatureDetenteur?: string
  signatureDetenteurQualite?: string
  /** Signatures manuscrites (PNG data URL) */
  signatureOperateurImage?: string
  signatureDetenteurImage?: string

  /** Qui a rempli la fiche (opérateur) — visible sur le compte boîte */
  createdByUserId?: string
  createdByName?: string

  /** CERFA PDF stocké dans IndexedDB (dans l’app) */
  hasCerfaPdf?: boolean
  cerfaPdfFileName?: string
  cerfaPdfSavedAt?: string

  status: 'brouillon' | 'signe' | 'envoye'
  createdAt: string
  updatedAt: string
}

export interface AppData {
  operateur: Operateur
  clients: Client[]
  chantiers: Chantier[]
  stock: StockItem[]
  /** Historique des usages partiels liés aux CERFA */
  stockMouvements: StockMouvement[]
  interventions: CerfaDraft[]
}

/** Libellé CERFA pour traçabilité stock */
export function cerfaLabelFor(intervention: Pick<CerfaDraft, 'id' | 'dateIntervention' | 'cerfaPdfFileName'>) {
  if (intervention.cerfaPdfFileName) {
    return intervention.cerfaPdfFileName.replace(/\.pdf$/i, '')
  }
  return `CERFA-15497-04-${intervention.dateIntervention || intervention.id.slice(0, 8)}`
}

/**
 * Sens du mouvement selon le type de contenant :
 * - vierge / régénéré / transfert → sortie (usage)
 * - récupération → entrée (fluide récupéré dans la bouteille)
 */
export function sensMouvementPourContenant(type: ContenantType): StockMouvementSens {
  return type === 'recuperation' ? 'entree' : 'sortie'
}

/** Contrôle détecteur valable 1 an — true si dépassé ou manquant. */
export function isDetecteurControleExpire(dateIso?: string, refDate = new Date()): boolean {
  if (!dateIso) return true
  const d = new Date(dateIso)
  if (Number.isNaN(d.getTime())) return true
  const limit = new Date(d)
  limit.setFullYear(limit.getFullYear() + 1)
  return refDate > limit
}

/** Bouteille neuve vide, consignée, pas encore retournée au fournisseur. */
export function needsRetourConsigne(s: StockItem): boolean {
  return (
    s.contenantType === 'vierge' &&
    (Number(s.quantiteKg) || 0) <= 1e-9 &&
    !s.bonRetourConsigne?.trim()
  )
}

/** Déjà retournée (bon de consigne enregistré). */
export function isBouteilleRetournee(s: StockItem): boolean {
  return !!s.bonRetourConsigne?.trim()
}
