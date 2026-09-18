/**
 * Règles TVA à respecter pour la facturation électronique (Factur-X),
 * codes EN16931 / Peppol BIS Billing 3.0 (confirmés par la référence
 * VATEX de FactPulse — GET /api/v1/references/vatex-codes).
 *
 * Règle de sécurité (cahier des charges §4) : ne jamais deviner
 * automatiquement le taux réduit. `resolveTvaLigne` ne renvoie 5,5 % ou
 * 10 % que si l'appelant transmet explicitement les cases cochées
 * correspondantes — sinon le taux standard 20 % (catégorie S) est renvoyé.
 */

export type CategorieTva = 'S' | 'E' | 'AE'

export type CasTva = {
  cas: string
  categorie: CategorieTva
  codeMotif: string | null
  taux: number | null
  mentionPdf: string | null
}

/** Table de correspondance générale (cahier des charges §4, colonnes 1 à 1). */
export const TVA_CAS_GENERAUX: CasTva[] = [
  {
    cas: 'Facture normale',
    categorie: 'S',
    codeMotif: null,
    taux: null, // dépend de l'équipement — voir TAUX_TVA_EQUIPEMENT
    mentionPdf: null,
  },
  {
    cas: 'Société en franchise en base (auto-entrepreneur)',
    categorie: 'E',
    codeMotif: 'VATEX-FR-FRANCHISE',
    taux: 0,
    mentionPdf: 'TVA non applicable, article 293 B du CGI',
  },
  {
    cas: 'Sous-traitance BTP pour donneur d’ordre assujetti',
    categorie: 'AE',
    codeMotif: 'VATEX-FR-AE',
    taux: 0,
    mentionPdf: 'Autoliquidation – article 283 du CGI',
  },
]

export type EquipementTva =
  | 'pac_air_eau'
  | 'pac_geothermique'
  | 'chauffe_eau_thermodynamique'
  | 'pac_air_air_main_oeuvre'
  | 'amelioration_logement_ancien'
  | 'pac_air_air_materiel_seul'
  | 'logement_neuf'
  | 'local_professionnel'

/** Taux selon équipement (cahier des charges §4) — référence, pas d'auto-sélection. */
export const TAUX_TVA_EQUIPEMENT: Record<EquipementTva, { taux: number; description: string }> = {
  pac_air_eau: {
    taux: 5.5,
    description:
      'PAC air-eau — logement > 2 ans, résidence principale/secondaire, RGE QualiPAC, fourniture + pose',
  },
  pac_geothermique: {
    taux: 5.5,
    description:
      'PAC géothermique — logement > 2 ans, résidence principale/secondaire, RGE QualiPAC, fourniture + pose',
  },
  chauffe_eau_thermodynamique: {
    taux: 5.5,
    description:
      'Chauffe-eau thermodynamique — logement > 2 ans, résidence principale/secondaire, RGE QualiPAC, fourniture + pose',
  },
  pac_air_air_main_oeuvre: { taux: 10, description: 'Main-d’œuvre PAC air-air' },
  amelioration_logement_ancien: { taux: 10, description: 'Travaux d’amélioration logement ancien' },
  pac_air_air_materiel_seul: { taux: 20, description: 'Matériel PAC air-air seul' },
  logement_neuf: { taux: 20, description: 'Logement neuf (< 2 ans)' },
  local_professionnel: { taux: 20, description: 'Local professionnel' },
}

/** Conditions à cocher explicitement avant d'appliquer 5,5 % (PAC air-eau / géothermique / CET). */
export type ConditionsTaux55 = {
  logementPlusDeDeuxAns: boolean
  residencePrincipaleOuSecondaire: boolean
  installateurRgeQualipac: boolean
  fournitureEtPose: boolean
}

export type LigneTvaInput =
  | { cas: 'standard' }
  | { cas: 'franchise_base' }
  | { cas: 'autoliquidation_btp' }
  | { cas: 'taux_reduit_55'; conditions: ConditionsTaux55 }
  | { cas: 'taux_reduit_10' }

export type LigneTvaResolue = {
  taux: number
  categorie: CategorieTva
  codeMotif: string | null
  mentionPdf: string | null
}

const STANDARD: LigneTvaResolue = { taux: 20, categorie: 'S', codeMotif: null, mentionPdf: null }

/**
 * Résout la ligne TVA à appliquer. Ne renvoie 5,5 % que si les 4 conditions
 * sont explicitement cochées (jamais déduit automatiquement de l'équipement).
 * Toute condition manquante retombe sur le taux standard 20 %.
 */
export function resolveTvaLigne(input: LigneTvaInput): LigneTvaResolue {
  switch (input.cas) {
    case 'franchise_base':
      return {
        taux: 0,
        categorie: 'E',
        codeMotif: 'VATEX-FR-FRANCHISE',
        mentionPdf: 'TVA non applicable, article 293 B du CGI',
      }
    case 'autoliquidation_btp':
      return {
        taux: 0,
        categorie: 'AE',
        codeMotif: 'VATEX-FR-AE',
        mentionPdf: 'Autoliquidation – article 283 du CGI',
      }
    case 'taux_reduit_10':
      return { taux: 10, categorie: 'S', codeMotif: null, mentionPdf: null }
    case 'taux_reduit_55': {
      const c = input.conditions
      const toutesConfirmees =
        c.logementPlusDeDeuxAns &&
        c.residencePrincipaleOuSecondaire &&
        c.installateurRgeQualipac &&
        c.fournitureEtPose
      if (!toutesConfirmees) return STANDARD
      return { taux: 5.5, categorie: 'S', codeMotif: null, mentionPdf: null }
    }
    case 'standard':
    default:
      return STANDARD
  }
}
