/** Référence réglementaire : CERFA FI 15497-04 (fiche d'intervention fluides). */

import type { FicheMaintenanceClim } from './ficheMaintenanceClim'
import type { FicheMaintenanceChaufferie } from './ficheMaintenanceChaufferie'
import type { FicheMaintenanceCtaVmc } from './ficheMaintenanceCtaVmc'
import type { OrdreTravail } from './ordreTravail'
import type { ContratMaintenance } from './contratMaintenance'

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
  demantelement: 'Démantèlement / récup. définitive (déchet)',
  recuperation: 'Récupération temporaire (réinjection prévue)',
  charge: 'Charge de fluide',
  autre: 'Autre manipulation de fluide',
}

export type ContenantType = 'vierge' | 'recycle' | 'regenere' | 'recuperation' | 'transfert'

export const CONTENANT_TYPE_LABELS: Record<ContenantType, string> = {
  vierge: 'Vierge (neuf)',
  recycle: 'Recyclé (sur site — même client)',
  regenere: 'Régénéré (achat distributeur)',
  recuperation: 'Récupération (déchet)',
  transfert: 'Transfert / Service',
}

/** Bouteille créée vide (récupération déchet ou recyclage site). */
export function contenantDemarreVide(type: ContenantType): boolean {
  return type === 'recuperation' || type === 'recycle'
}

/**
 * Achat distributeur (vierge / régénéré) : uniquement des sorties (charge).
 * Pas de recharge → capacité = quantité à l’entrée (pas de champ séparé).
 */
export function contenantSansRecharge(type: ContenantType): boolean {
  return type === 'vierge' || type === 'regenere'
}

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
  /**
   * Fallback société (1 détecteur) — cadre [5].
   * Préférer `AppData.detecteurs` avec attribution par technicien.
   */
  detecteurIdentification?: string
  /** Date du dernier contrôle / étalonnage (annuel) — cadre [5] Contrôlé le */
  detecteurControleDate?: string
  /** Nom de l’opérateur signataire (prérempli sur CERFA) */
  signataireNom?: string
  /** Qualité / fonction */
  signataireQualite?: string
  /** Signature manuscrite PNG data URL — réutilisée automatiquement */
  signatureImage?: string
  /** Logo société (data URL) — affiché à côté de ClimaZEN dans l’app */
  logoImage?: string
  /**
   * Facturation externe via Make.com → Tiime, Pennylane, Sellsy…
   * Évite la double saisie client / devis / facture.
   */
  facturationPlateforme?: FacturationPlateforme
  /** URL webhook Make (Custom webhook) */
  facturationWebhookUrl?: string
  /** create_client | create_devis | create_facture */
  facturationActionDefaut?: FacturationAction
  /**
   * Dossier cloud général de la société (Drive / OneDrive / SharePoint).
   * ClimaZEN classe ensuite : ClimaZEN → Dossiers techniciens → Nom du tech → catégorie.
   */
  lienCloudRhRacine?: string
  /**
   * Où enregistrer les PDF générés (devis, commandes, CERFA, fiches…).
   * - cloud : ouvre le dossier cloud + télécharge pour ranger
   * - prive : PUT vers le serveur privé (WebDAV / Nextcloud / NAS)
   * - telechargement : fichier local uniquement (+ copie Supabase si org)
   */
  docsStockageMode?: 'cloud' | 'prive' | 'telechargement'
  /**
   * Dossier cloud Documents (sinon repli sur lienCloudRhRacine).
   * Arborescence : ClimaZEN → Documents → {année|Clients} → type.
   */
  lienCloudDocsRacine?: string
  /**
   * URL de base du serveur privé (ex. https://nas.entreprise.fr/.../ClimaZEN/Documents).
   * Les chemins relatifs (Devis/…, CERFA/…) sont ajoutés après.
   */
  serveurPriveDocsUrl?: string
  /** Jeton Bearer optionnel pour l’upload serveur privé. */
  serveurPriveDocsToken?: string
  /**
   * Installations de destination habituelles (CERFA [13]) —
   * préremplit le menu (Climalife, Gazechim, Dépôt…) + texte libre.
   */
  destinationsInstallation?: string[]
  /**
   * Magasinier pièces détachées — gère le stock GMAO.
   * Si absent, le bureau (secrétariat / gérant) gère le stock.
   */
  magasinierUserId?: string
  /** E-mail alertes tickets portail client (sinon e-mail société + gérant). */
  ticketNotificationEmail?: string
}

/** Plateformes de facturation les plus utilisées (via Make). */
export type FacturationPlateforme =
  | 'tiime'
  | 'pennylane'
  | 'sellsy'
  | 'axonaut'
  | 'freebe'
  | 'henrri'
  | 'indy'
  | 'autre'

export type FacturationAction = 'create_client' | 'create_devis' | 'create_facture'

export const FACTURATION_PLATEFORMES: {
  id: FacturationPlateforme
  label: string
  makeHint: string
  /** URL d’ouverture simple (sans API) */
  openUrl: string
}[] = [
  { id: 'tiime', label: 'Tiime', makeHint: 'Module Make « Tiime Apps »', openUrl: 'https://www.tiime.fr/' },
  {
    id: 'pennylane',
    label: 'Pennylane',
    makeHint: 'Module Make Pennylane',
    openUrl: 'https://app.pennylane.com/',
  },
  { id: 'sellsy', label: 'Sellsy', makeHint: 'Module Make Sellsy', openUrl: 'https://www.sellsy.com/' },
  {
    id: 'axonaut',
    label: 'Axonaut',
    makeHint: 'Module Make Axonaut',
    openUrl: 'https://axonaut.com/',
  },
  { id: 'freebe', label: 'Freebe', makeHint: 'HTTP / Make Freebe si dispo', openUrl: 'https://www.freebe.me/' },
  { id: 'henrri', label: 'Henrri', makeHint: 'HTTP / Make Henrri si dispo', openUrl: 'https://www.henrri.com/' },
  { id: 'indy', label: 'Indy', makeHint: 'Module Make Indy si dispo', openUrl: 'https://www.indy.fr/' },
  { id: 'autre', label: 'Autre', makeHint: 'N’importe quel module Make', openUrl: '' },
]

export type TypeClient = 'entreprise' | 'particulier'

export interface Client {
  id: string
  /** Entreprise (défaut) ou particulier */
  typeClient?: TypeClient
  /** Cadre [2] Détenteur — raison sociale (entreprise) ou « Prénom Nom » (particulier) */
  raisonSociale: string
  /** Contact (entreprise) */
  nomContact: string
  /** Nom de famille (particulier) */
  nom?: string
  /** Prénom (particulier) */
  prenom?: string
  adresse: string
  codePostal: string
  ville: string
  telephone: string
  email: string
  /** Agence / département (75 Paris, 06, 13…) */
  agenceCode?: string
  /** SIRET client (utile facturation B2B / Tiime) */
  siret?: string
  notes?: string
  createdAt: string
  /** Qui a enregistré le client (admin ou employé) — visible par toute l’équipe */
  createdByUserId?: string
  createdByName?: string
  /** Lien devis renvoyé par Make / plateforme */
  devisLien?: string
  /** Lien facture renvoyé par Make / plateforme */
  factureLien?: string
  /** Dernier envoi vers Make (ISO) */
  facturationSyncedAt?: string
}

/** Libellé d’affichage client (entreprise ou particulier). */
export function clientDisplayName(
  c: Pick<Client, 'typeClient' | 'raisonSociale' | 'nom' | 'prenom' | 'nomContact'>,
): string {
  if (c.typeClient === 'particulier') {
    const n = [c.prenom, c.nom].filter((x) => (x || '').trim()).join(' ').trim()
    return n || (c.raisonSociale || '').trim() || '—'
  }
  return (c.raisonSociale || '').trim() || '—'
}

/** Normalise raisonSociale pour un particulier (CERFA / listes). */
export function syncClientRaisonSociale<
  T extends Pick<Client, 'typeClient' | 'raisonSociale' | 'nom' | 'prenom'>,
>(c: T): T {
  if (c.typeClient !== 'particulier') return c
  const label = [c.prenom, c.nom].filter((x) => (x || '').trim()).join(' ').trim()
  if (!label) return c
  return { ...c, raisonSociale: label }
}

export interface Equipement {
  id: string
  /** Libellé métier : « Chambre froide 1 », « CTA toiture »… */
  nom: string
  type: string
  marque: string
  modele: string
  numeroSerie: string
  /**
   * true = cet équipement contient du fluide → CERFA / stock gaz.
   * false = matériel sans fluide (ex. VMC) sur le même site.
   * Défaut true pour les fiches existantes.
   */
  avecFluideFrigorigene?: boolean
  fluideType: string
  chargeNominaleKg: number
  teqCO2?: number
  detectionPermanente: boolean
  notes?: string
}

/** Catégorie de travaux sur un site / équipement. */
export type TypeTravaux =
  | 'installation'
  | 'depanage'
  | 'maintenance'
  | 'mise_en_service'
  | 'controle_etancheite'
  | 'recuperation'
  | 'demantelement'
  | 'ventilation_vmc'
  | 'autre'

export const TYPE_TRAVAUX_LABELS: Record<TypeTravaux, string> = {
  installation: 'Installation',
  depanage: 'Dépannage',
  maintenance: 'Maintenance',
  mise_en_service: 'Mise en service',
  controle_etancheite: 'Contrôle d’étanchéité',
  recuperation: 'Récupération temporaire',
  demantelement: 'Démantèlement / récup. définitive',
  ventilation_vmc: 'Ventilation / VMC',
  autre: 'Autre',
}

/**
 * Relation commerciale / usage du site dans le parc.
 * - contrat : inventaire sous contrat (équipements en veille, prêts pour CERFA)
 * - ponctuel : chantier / dépannage occasionnel
 */
export type ModeGestion = 'contrat' | 'ponctuel'

export const MODE_GESTION_LABELS: Record<ModeGestion, string> = {
  contrat: 'Contrat maintenance',
  ponctuel: 'Travaux occasionnels',
}

/**
 * Site d’intervention (EHPAD, usine, agence, hypermarché…).
 * Un site peut contenir plusieurs équipements → un CERFA par équipement.
 * Ancien nom : « chantier ».
 */
export interface Site {
  id: string
  clientId: string
  nom: string
  adresse: string
  codePostal: string
  ville: string
  /** Agence / département — si vide, on prend le CP ou l’agence du client */
  agenceCode?: string
  /** Multi-équipements (évolution) — optionnel */
  equipements?: Equipement[]
  statut: 'actif' | 'termine' | 'archive'
  notes?: string
  createdAt: string
  /** Qui a créé le site / travaux — visible par toute l’équipe */
  createdByUserId?: string
  createdByName?: string
  /** Signature client réutilisable pour tous les CERFA du site */
  signatureDetenteurNom?: string
  signatureDetenteurQualite?: string
  signatureDetenteurImage?: string
  signatureDetenteurAt?: string
  /** Catégorie de travaux (installation, dépannage…) — nature typique, pas l’état du parc */
  typeTravaux?: TypeTravaux
  /** Précision libre : « maintenance semestrielle », « clim bureau directeur »… */
  detailTravaux?: string
  /** Contrat (parc en veille) vs travaux / dépannage ponctuel */
  modeGestion?: ModeGestion
  /** Prochain contrôle d’étanchéité annuel (YYYY-MM-DD) */
  prochaineControleEtancheite?: string
  /** Dernière maintenance validée (génération CERFA groupée) */
  derniereMaintenanceAt?: string
  derniereMaintenanceDate?: string
  /**
   * true = au moins un équipement avec fluide → CERFA / stock gaz.
   * false = uniquement travaux / matériel standard (ex. VMC).
   * Dérivé des équipements à l’enregistrement ; conservé pour compat.
   */
  avecFluideFrigorigene?: boolean
  /** Portail client GMAO — lien public maintenance + tickets */
  portailActif?: boolean
  portailToken?: string
  /** Équipement principal (format actuel UI Sites) */
  equipementType: string
  equipementMarque: string
  equipementModele: string
  equipementNumeroSerie: string
  fluideType: string
  chargeNominaleKg: number
  teqCO2?: number
  detectionPermanente: boolean
}

/** @deprecated alias — utiliser Site */
export type Chantier = Site

/** Équipement concerné par CERFA / fluides (défaut true pour les fiches existantes). */
export function equipAvecFluideFrigorigene(
  e: Pick<Equipement, 'avecFluideFrigorigene'>,
): boolean {
  return e.avecFluideFrigorigene !== false
}

/** Site concerné par CERFA / fluides — true si au moins un équipement fluide. */
export function siteAvecFluideFrigorigene(
  s: Pick<Site, 'avecFluideFrigorigene' | 'equipements'>,
): boolean {
  if (s.equipements && s.equipements.length > 0) {
    return s.equipements.some((e) => equipAvecFluideFrigorigene(e))
  }
  return s.avecFluideFrigorigene !== false
}

export interface StockItem {
  id: string
  /**
   * Ex. R-32, R-410A, R-1234yf.
   * Vide = non assigné (bouteille récup. vide : fixé au 1er CERFA).
   */
  fluide: string
  contenantType: ContenantType
  /**
   * N° de série / n° de contenant officiel (gravé, distributeur, code-barres).
   * Obligatoire — c’est ce numéro qui figure sur le CERFA 15497 [11].
   * Ne jamais y mettre le type (« Transfert », « Récupération »…).
   */
  numeroContenant: string
  /**
   * Surnom / libellé interne optionnel (ex. « Bouteille Transfert Camion Luc »).
   * Affichage stock & menus uniquement — jamais imprimé à la place du n° sur le CERFA.
   */
  surnom?: string
  /** Quantité restante actuelle (kg) */
  quantiteKg: number
  /** Quantité à l’entrée en stock (kg) — pour suivre les usages partiels */
  quantiteInitialeKg?: number
  /**
   * Capacité max de remplissage (kg) — obligatoire pour récupération (surcharge).
   * Distinct de quantiteInitialeKg (contenu à l’entrée).
   */
  capaciteMaxKg?: number
  /**
   * Client / détenteur d’origine du fluide (recyclé) — réinjection limitée à ce client.
   * Renseigné à la première récupération CERFA ou à la création (bouteille récup.).
   */
  origineClientId?: string
  /**
   * Récupération : fluide non lié à un site — destiné à la destruction chez le distributeur.
   * Exclusif avec origineClientId.
   */
  origineDestructionDistributeur?: boolean
  /** Emplacement logistique (atelier / véhicule) — suivi interne sans CERFA. */
  emplacement?: 'atelier' | 'vehicule'
  /** Libellé véhicule / dépôt (ex. « Véhicule A », « Camion 12 »). */
  emplacementLabel?: string
  /**
   * Technicien qui a la bouteille (hors atelier / dépôt).
   * Utile si plusieurs techs — masqué en entreprise solo.
   */
  assigneeUserId?: string
  /** Nom dénormalisé pour affichage liste / hors ligne. */
  assigneeName?: string
  /**
   * Récup. fluide A2L/A3 : technicien confirme bouteille adaptée
   * (collerette rouge, pas à gauche, pictogramme flamme).
   */
  conformeA2LA3?: boolean
  /** Pression d’épreuve PH (bar) — marquage ogive. */
  pressionEpreuveBar?: number
  /**
   * Date de la dernière épreuve (marquage bouteille).
   * Sert au calcul auto de la fin de validité (+10 ou +5 ans).
   */
  dateDerniereEpreuve?: string
  /** Date de fin de validité / prochain rééprouvage (contrôle périodique). */
  dateReepreuvage?: string
  /** Poids à vide (tare) kg — pour calcul balance terrain. */
  tareKg?: number
  /**
   * Date d’entrée en possession (consigne distributeur).
   * Sert au compteur « jours en possession ».
   */
  dateEntreePossession?: string
  /** Seuil d’alerte consigne (jours), défaut 30. */
  seuilAlerteConsigneJours?: number
  /**
   * Type d’huile associé (récupération) — éviter mélange MO / POE.
   * MO = minérale, POE = polyolester, PAG, AB = alkylbenzène.
   */
  typeHuile?: 'POE' | 'PAG' | 'MO' | 'AB' | 'autre' | 'inconnu'
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

export type StockMouvementKind =
  | 'cerfa'
  | 'retour_consigne'
  /** Fluide neuf acquis (BL fournisseur) */
  | 'achat'
  /** Remise à un centre / installation de destruction agréée */
  | 'destruction'
  /** Déplacement interne atelier ↔ véhicule (pas de CERFA client) */
  | 'transfert_interne'
  /** Perte / fuite / dégazage accidentel (bilan F-Gas annuel) */
  | 'perte_emission'

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
  /** Fournisseur / BL (achat) ou centre de destruction */
  tiersNom?: string
  /** Référence BL, BSFF destruction, etc. */
  documentReference?: string
}

export interface CerfaDraft {
  id: string
  clientId: string
  /** ID du site (ex-chantier) */
  chantierId: string
  /** Équipement du site concerné par ce CERFA (1 CERFA = 1 équipement) */
  equipementId?: string
  dateIntervention: string
  /**
   * N° d’intervention / OT unique (signé) — format OT20260001.
   * Obligatoire pour tracer toute action terrain (avec ou sans PDF CERFA).
   */
  numeroIntervention?: string
  /** Lien vers l’ordre de travail (OT) */
  ordreTravailId?: string

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
    /** Huile associée à cette récupération (MO / POE…) */
    typeHuile?: StockItem['typeHuile']
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

/** Détecteur manuel de fuite — parc société, attribué à un technicien */
export interface DetecteurManuel {
  id: string
  /** Identification / réf. (n° série, étiquette…) — CERFA cadre [5] */
  identification: string
  /** Date du dernier contrôle annuel */
  controleDate: string
  /** Compte utilisateur (opérateur) qui utilise ce détecteur */
  assigneeUserId?: string
  /** Nom affiché (copie au moment de l’attribution) */
  assigneeName?: string
  notes?: string
  updatedAt: string
}

/** Véhicule de la flotte société — attribué à un technicien */
export type VoitureDocumentId =
  | 'carte_grise'
  | 'assurance_carte_verte'
  | 'controle_technique'
  | 'critair'
  | 'livret_entretien'
  | 'double_cles'
  | 'carte_carburant'
  | 'badge_peage'
  | 'kit_securite'
  | 'roue_secours'
  | 'autre'

export type VoitureEtatNiveau = 'bon' | 'usure_normale' | 'rayures' | 'chocs' | 'a_surveiller' | 'a_changer' | 'sale' | 'abime'

export type VoitureCarburant = 'vide' | 'quart' | 'moitie' | 'trois_quarts' | 'plein'

export type VoitureMarqueType = 'rayure' | 'bosse'

export type VoitureZoneId =
  | 'parechoc_av'
  | 'capot'
  | 'parebrise'
  | 'toit'
  | 'hayon'
  | 'parechoc_ar'
  | 'aile_av_g'
  | 'porte_av_g'
  | 'porte_ar_g'
  | 'aile_ar_g'
  | 'aile_av_d'
  | 'porte_av_d'
  | 'porte_ar_d'
  | 'aile_ar_d'

export type VoitureMarqueCarrosserie = {
  zone: VoitureZoneId
  type: VoitureMarqueType
}

export interface VoitureEtatLieux {
  date: string
  kilometrage?: number
  carburant?: VoitureCarburant
  carrosserie?: 'bon' | 'usure_normale' | 'rayures' | 'chocs'
  interieur?: 'bon' | 'usure_normale' | 'sale' | 'abime'
  pneus?: 'bon' | 'a_surveiller' | 'a_changer'
  /** Documents / pièces que l’opérateur déclare avoir pris avec le véhicule */
  documentsRecus: VoitureDocumentId[]
  documentsAutre?: string
  dommages?: string
  observations?: string
  /** Marques sur le schéma (constat) : rayure ou bosse par zone */
  marquesCarrosserie?: VoitureMarqueCarrosserie[]
}

export interface Voiture {
  id: string
  /** Immatriculation (matricule) */
  matricule: string
  /** Marque (Renault, Peugeot…) */
  marque: string
  /** Modèle (Kangoo, Partner…) */
  modele?: string
  /** Date du dernier contrôle technique */
  controleTechniqueDate?: string
  /** Date d'expiration de l'assurance */
  assuranceDate?: string
  /** Compte utilisateur (opérateur) qui conduit ce véhicule */
  assigneeUserId?: string
  /** Nom affiché (copie au moment de l'attribution) */
  assigneeName?: string
  /** Date ISO : l’opérateur a validé la réception */
  receptionAt?: string
  receptionParUserId?: string
  /** Papiers / accessoires que la société remet avec le véhicule */
  documentsFournis?: VoitureDocumentId[]
  /** État des lieux saisi à la réception par l’opérateur */
  etatReception?: VoitureEtatLieux
  notes?: string
  updatedAt: string
}

/** Outillage terrain — parc société, attribué à un technicien */
export interface Outillage {
  id: string
  /** Type catalogue (menu déroulant) */
  type: import('./outillageCatalog').OutillageTypeId
  /** N° série, étiquette interne, réf. */
  identification: string
  marque?: string
  modele?: string
  /** Contrôle annuel (détecteur) ou étalonnage balance */
  controleDate?: string
  assigneeUserId?: string
  assigneeName?: string
  /** Date ISO : l’opérateur a validé la réception */
  receptionAt?: string
  receptionParUserId?: string
  notes?: string
  updatedAt: string
}

export type MaterielKind = 'voiture' | 'outillage'

export type MaterielLigne = {
  kind: MaterielKind
  itemId: string
  famille: string
  label: string
}

/** Bon de remise officiel (réception véhicule, téléphone, outillage…). */
export interface BonRemiseMateriel {
  id: string
  userId: string
  userName: string
  createdAt: string
  items: MaterielLigne[]
  fileName: string
  kind?: 'outillage' | 'vehicule'
  voitureId?: string
  etatVoiture?: VoitureEtatLieux
  createdByUserId?: string
  createdByName?: string
}

/** Édition produit : Light (solo / AE) ou Pro (PME / TPE). */
export type AppEdition = import('./appEdition').AppEdition

/** Option IA souscrite (Light) — Agent complet OT/CERFA (OpenAI, clé société). */
export type AiPlan = import('./aiAccess').AiPlan

export interface AppData {
  /** Light = solo sans équipe ; Pro = PME/TPE (défaut si absent = Pro). */
  appEdition?: AppEdition
  /** Light : option Agent IA payante (`agent`). Pro : ignoré (Agent inclus). */
  aiPlan?: AiPlan
  operateur: Operateur
  clients: Client[]
  /** Sites d’intervention (clé historique « chantiers ») */
  chantiers: Site[]
  stock: StockItem[]
  /** Historique des usages partiels liés aux CERFA */
  stockMouvements: StockMouvement[]
  interventions: CerfaDraft[]
  /** Parc détecteurs manuels — un par technicien si plusieurs */
  detecteurs?: DetecteurManuel[]
  /** Flotte véhicules société — un par technicien si plusieurs */
  voitures?: Voiture[]
  /** Parc outillage terrain — attribution par technicien */
  outillages?: Outillage[]
  /** Bons de remise matériel (PDF chez le gérant) */
  bonsRemiseMateriel?: BonRemiseMateriel[]
  /** Fiches maintenance clim / PAC (checklist terrain, hors CERFA) */
  fichesMaintenanceClim?: FicheMaintenanceClim[]
  /** Fiches maintenance chaufferie P2/P3 (registre périodique) */
  fichesMaintenanceChaufferie?: FicheMaintenanceChaufferie[]
  /** Fiches maintenance CTA / VMC (registre périodique 1M→1Y) */
  fichesMaintenanceCtaVmc?: FicheMaintenanceCtaVmc[]
  /** Ordres de travail (OT) — n° unique OT2026xxxx */
  ordresTravail?: OrdreTravail[]
  /** Contrats de maintenance (documents signables) */
  contratsMaintenance?: ContratMaintenance[]
  /** Devis (standard ou régularisation) — 1 devis → N OT */
  devis?: import('./chaineCommerciale').Devis[]
  /** Commandes fournisseur (pièces) — OT en attente de réception */
  commandesFournisseur?: import('./chaineCommerciale').CommandeFournisseur[]
  /** Stock pièces détachées GMAO */
  piecesDetachees?: import('./piecesDetachees').PieceDetachee[]
  /** Mouvements stock pièces (entrées, sorties OT, inventaire…) */
  piecesMouvements?: import('./piecesDetachees').PieceMouvement[]
  /** Factures légères (métadonnées + lien externe Make) */
  factures?: import('./chaineCommerciale').Facture[]
  /** Agenda / rappels RDV maintenance */
  agendaEvents?: import('./agenda').AgendaEvent[]
  /** Règles pointeuse (obligatoires avant activation). */
  pointageRegles?: import('./pointage').PointageRegles
  /** Horodatages ponctuels (pas de tracking GPS continu). */
  pointageEvents?: import('./pointage').PointageEvent[]
  /** Saisie horaire bureau (début / fin / pause) — personnel non terrain. */
  pointageBureauJours?: import('./pointage').PointageBureauJour[]
  /**
   * Dossiers RH des techniciens (CNI, permis, aptitude froid, habilitation…)
   * avec dates d’expiration — coffre société.
   */
  personnelDossiers?: import('./rhDocuments').PersonnelDossier[]
  /**
   * Employés autorisés par le gérant à voir les pièces d’identité de toute l’équipe
   * (secrétariat, accueil d’appels / agent IA). Le compte owner a toujours l’accès.
   */
  personnelRhAccesUserIds?: string[]
  /**
   * Techniciens retirés de l’équipe (départ société) — plus affichés, plus d’affectation.
   * Le compte Auth est aussi désactivé (plus de connexion).
   */
  personnelRetiresUserIds?: string[]
  /**
   * Validations humaines en attente (Lola / assistant) —
   * notifiées au responsable du secteur.
   */
  aiPendingValidations?: import('./aiPendingValidation').AiPendingValidation[]
  /**
   * Ids supprimés (tombstones) — la sync ne doit pas les réimporter depuis le cloud.
   */
  deletedEntityIds?: import('./deletedEntities').DeletedEntityIds
}

/** Libellé CERFA / intervention pour traçabilité stock */
export function cerfaLabelFor(
  intervention: Pick<
    CerfaDraft,
    'id' | 'dateIntervention' | 'cerfaPdfFileName' | 'numeroIntervention'
  >,
) {
  if (intervention.numeroIntervention?.trim()) {
    const base = intervention.numeroIntervention
      .trim()
      .replace(/^OT\s*/i, '')
      .replace(/-\d+$/, '')
    return base ? `OT${base}` : intervention.numeroIntervention.trim()
  }
  if (intervention.cerfaPdfFileName) {
    return intervention.cerfaPdfFileName.replace(/\.pdf$/i, '')
  }
  return `CERFA-15497-04-${intervention.dateIntervention || intervention.id.slice(0, 8)}`
}

/**
 * Contenant pouvant recevoir du fluide récupéré sur CERFA.
 * - Récupération (déchet) / Recyclé site / Transfert-Service (récup. temporaire)
 * Régénéré = achat distributeur (déjà plein) — pas une destination de vidange.
 */
export function isContenantDestination(type: ContenantType): boolean {
  return type === 'recuperation' || type === 'recycle' || type === 'transfert'
}

/**
 * Sens du mouvement selon le type (et le stock restant) :
 * - récupération → entrée (fluide récupéré dans la bouteille)
 * - recyclé / transfert vides → entrée (remplir depuis l’installation)
 * - sinon → sortie (usage / charge / réinjection)
 */
export function sensMouvementPourContenant(
  type: ContenantType,
  quantiteKg = 0,
): StockMouvementSens {
  if (type === 'recuperation') return 'entree'
  if (isContenantDestination(type) && (Number(quantiteKg) || 0) <= 0) return 'entree'
  return 'sortie'
}

/** Visible dans CERFA [11] même à 0 kg (destination de vidange). */
export function bouteilleVisibleCerfaMemeVide(type: ContenantType): boolean {
  return isContenantDestination(type)
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

/** Contrôle technique valable 2 ans — true si dépassé ou manquant. */
export function isCtExpire(dateIso?: string, refDate = new Date()): boolean {
  if (!dateIso) return true
  const d = new Date(dateIso)
  if (Number.isNaN(d.getTime())) return true
  const limit = new Date(d)
  limit.setFullYear(limit.getFullYear() + 2)
  return refDate > limit
}

/** Assurance expirée — true si date passée ou manquante. */
export function isAssuranceExpiree(dateIso?: string, refDate = new Date()): boolean {
  if (!dateIso) return true
  const d = new Date(dateIso)
  if (Number.isNaN(d.getTime())) return true
  return refDate > d
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
