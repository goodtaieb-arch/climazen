/**
 * Catalogue fluides frigorigènes — GWP / PRG
 * Source : tableau_fluides_frigorigenes_gwp.pdf (F-Gas III / Cerfa 15497*04)
 * Calcul teq CO₂ : Charge (kg) × GWP / 1000
 */

export type FluideFamille =
  | 'HFC'
  | 'HFO'
  | 'Naturel'
  | 'HC'
  | 'HCFC'
  | 'CFC'

export type FluideRef = {
  code: string
  famille: FluideFamille
  familleDetail: string
  /** Pouvoir de réchauffement global (PRG) */
  gwp: number
  /** true si la source indique « < 1 » ou « ~ » */
  gwpApprox?: boolean
  applications: string
  /** Interdit à la manipulation / recharge */
  interdit?: boolean
  /** Classe de sécurité ASHRAE / ISO (inflammabilité) */
  classeSecurite?: 'A1' | 'A2L' | 'A2' | 'A3' | 'B1' | 'B2L' | 'B2' | 'B3'
}

export const FLUIDES: FluideRef[] = [
  // 1. HFC
  {
    code: 'R-32',
    famille: 'HFC',
    familleDetail: 'HFC pur',
    gwp: 675,
    applications: 'Climatisation résidentielle, Pompes à chaleur (PAC)',
    classeSecurite: 'A2L',
  },
  {
    code: 'R-134a',
    famille: 'HFC',
    familleDetail: 'HFC pur',
    gwp: 1430,
    applications: 'Chillers, Froid commercial, Climatisation automobile',
    classeSecurite: 'A1',
  },
  {
    code: 'R-407C',
    famille: 'HFC',
    familleDetail: 'Mélange HFC',
    gwp: 1774,
    applications: 'Climatisation, Groupes de production d’eau glacée',
    classeSecurite: 'A1',
  },
  {
    code: 'R-410A',
    famille: 'HFC',
    familleDetail: 'Mélange HFC',
    gwp: 2088,
    applications: 'PAC, Climatisation (remplacement progressif par R-32 / R-454B)',
    classeSecurite: 'A1',
  },
  {
    code: 'R-404A',
    famille: 'HFC',
    familleDetail: 'Mélange HFC',
    gwp: 3922,
    applications: 'Froid commercial & industriel (interdiction de recharge neuve)',
    classeSecurite: 'A1',
  },
  {
    code: 'R-507A',
    famille: 'HFC',
    familleDetail: 'Mélange HFC',
    gwp: 3985,
    applications: 'Froid commercial & industriel à basse température',
    classeSecurite: 'A1',
  },

  // 2. HFO & mélanges HFO/HFC
  {
    code: 'R-1234yf',
    famille: 'HFO',
    familleDetail: 'HFO pur',
    gwp: 1,
    gwpApprox: true,
    applications: 'Climatisation automobile, Chillers',
    classeSecurite: 'A2L',
  },
  {
    code: 'R-1234ze',
    famille: 'HFO',
    familleDetail: 'HFO pur',
    gwp: 1,
    gwpApprox: true,
    applications: 'Groupes d’eau glacée, Pompes à chaleur grande puissance',
    classeSecurite: 'A2L',
  },
  {
    code: 'R-1233zd',
    famille: 'HFO',
    familleDetail: 'HFO pur',
    gwp: 1,
    applications: 'Chillers centrifuges très basse pression',
    classeSecurite: 'A1',
  },
  {
    code: 'R-454C',
    famille: 'HFO',
    familleDetail: 'Mélange HFO/HFC',
    gwp: 148,
    applications: 'Alternative au R-404A (GWP < 150)',
    classeSecurite: 'A2L',
  },
  {
    code: 'R-455A',
    famille: 'HFO',
    familleDetail: 'Mélange HFO/HFC',
    gwp: 148,
    applications: 'Froid commercial (GWP < 150)',
    classeSecurite: 'A2L',
  },
  {
    code: 'R-454B',
    famille: 'HFO',
    familleDetail: 'Mélange HFO/HFC',
    gwp: 466,
    applications: 'Alternative principale au R-410A dans les PAC Air-Eau',
    classeSecurite: 'A2L',
  },
  {
    code: 'R-448A',
    famille: 'HFO',
    familleDetail: 'Mélange HFO/HFC',
    gwp: 1387,
    gwpApprox: true,
    applications: 'Substitution directe (drop-in) du R-404A',
    classeSecurite: 'A1',
  },
  {
    code: 'R-449A',
    famille: 'HFO',
    familleDetail: 'Mélange HFO/HFC',
    gwp: 1387,
    gwpApprox: true,
    applications: 'Substitution directe (drop-in) du R-404A',
    classeSecurite: 'A1',
  },
  {
    code: 'R-452A',
    famille: 'HFO',
    familleDetail: 'Mélange HFO/HFC',
    gwp: 2140,
    applications: 'Transport frigorifique (camions, conteneurs)',
    classeSecurite: 'A1',
  },

  // 3. Naturels & HC
  {
    code: 'R-744',
    famille: 'Naturel',
    familleDetail: 'Inorganique naturel (CO₂)',
    gwp: 1,
    applications: 'Référence GWP. Froid commercial (supermarchés), PAC',
    classeSecurite: 'A1',
  },
  {
    code: 'R-717',
    famille: 'Naturel',
    familleDetail: 'Ammoniac (NH₃)',
    gwp: 0,
    applications: 'Froid industriel (entrepôts logistiques, patinoires)',
    classeSecurite: 'B2L',
  },
  {
    code: 'R-290',
    famille: 'HC',
    familleDetail: 'Hydrocarbure (Propane)',
    gwp: 0.02,
    applications: 'PAC monobloc extérieures, vitrines frigorifiques',
    classeSecurite: 'A3',
  },
  {
    code: 'R-600a',
    famille: 'HC',
    familleDetail: 'Hydrocarbure (Isobutane)',
    gwp: 0.04,
    applications: 'Électroménager, réfrigérateurs & congélateurs domestiques',
    classeSecurite: 'A3',
  },
  {
    code: 'R-1270',
    famille: 'HC',
    familleDetail: 'Hydrocarbure (Propylène)',
    gwp: 1.8,
    applications: 'Groupes d’eau glacée, Froid commercial spécialisé',
    classeSecurite: 'A3',
  },

  // 4. Interdits HCFC & CFC
  {
    code: 'R-22',
    famille: 'HCFC',
    familleDetail: 'HCFC',
    gwp: 1810,
    applications: 'Interdit depuis 2015 (destruction chlore / ozone)',
    interdit: true,
  },
  {
    code: 'R-408A',
    famille: 'HCFC',
    familleDetail: 'Mélange HCFC',
    gwp: 3152,
    applications: 'Interdit (ancien substitut R-502 / R-12)',
    interdit: true,
  },
  {
    code: 'R-409A',
    famille: 'HCFC',
    familleDetail: 'Mélange HCFC',
    gwp: 1585,
    applications: 'Interdit (ancien substitut R-502 / R-12)',
    interdit: true,
  },
  {
    code: 'R-12',
    famille: 'CFC',
    familleDetail: 'CFC',
    gwp: 10900,
    applications: 'Interdit (fort pouvoir de destruction de l’ozone)',
    interdit: true,
  },
  {
    code: 'R-502',
    famille: 'CFC',
    familleDetail: 'CFC',
    gwp: 4657,
    applications: 'Interdit',
    interdit: true,
  },
]

const FAMILLE_ORDER: FluideFamille[] = ['HFC', 'HFO', 'Naturel', 'HC', 'HCFC', 'CFC']

const FAMILLE_LABEL: Record<FluideFamille, string> = {
  HFC: 'HFC (Hydrofluorocarbures)',
  HFO: 'HFO & mélanges HFO/HFC',
  Naturel: 'Fluides naturels',
  HC: 'Hydrocarbures (HC)',
  HCFC: 'HCFC — interdits',
  CFC: 'CFC — interdits',
}

export function normalizeFluideCode(code: string) {
  return code.trim().toUpperCase().replace(/\s+/g, '').replace(/^R(?=\d)/, 'R-')
}

/** true si deux codes désignent le même fluide (R-32 / R32 / r-32). */
export function sameFluideCode(a: string, b: string): boolean {
  if (!a?.trim() || !b?.trim()) return false
  return normalizeFluideCode(a) === normalizeFluideCode(b)
}

/** Bouteille récup. créée vide sans gaz — fluide fixé au 1er CERFA. */
export function isFluideNonAssigne(fluide?: string | null): boolean {
  return !(fluide || '').trim()
}

/** Libellé affichage stock / listes. */
export function labelFluideStock(fluide?: string | null): string {
  return isFluideNonAssigne(fluide) ? 'Non assigné' : (fluide || '').trim()
}

/**
 * Compatible avec le fluide CERFA ?
 * Non assigné = OK (sera verrouillé au 1er remplissage).
 */
export function fluideCompatibleAvecCerfa(bottleFluide: string, cerfaFluide: string): boolean {
  if (!(cerfaFluide || '').trim()) return false
  if (isFluideNonAssigne(bottleFluide)) return true
  return sameFluideCode(bottleFluide, cerfaFluide)
}

export function findFluide(code: string): FluideRef | undefined {
  if (!code.trim()) return undefined
  const n = normalizeFluideCode(code)
  return FLUIDES.find((f) => normalizeFluideCode(f.code) === n)
}

/** Classe de sécurité ASHRAE (A1, A2L, A3…). */
export function classeSecuriteFluide(code: string): FluideRef['classeSecurite'] | undefined {
  return findFluide(code)?.classeSecurite
}

/** Classe ASHRAE affichée sous le sélecteur fluide (ex. « Classe A2L ⚠️ »). */
export function formatClasseSecuriteLabel(code: string): string | null {
  const c = classeSecuriteFluide(code)
  if (!c) return null
  const warn = c === 'A2L' || c === 'A2' || c === 'A3' || c === 'B2L' || c === 'B2' || c === 'B3'
  return warn ? `Classe ${c} ⚠️` : `Classe ${c}`
}

/** Fluide inflammable A2L ou A3 → bouteille récup. collerette rouge + pas à gauche. */
export function isFluideInflammableA2LOrA3(code: string): boolean {
  const c = classeSecuriteFluide(code)
  return c === 'A2L' || c === 'A3'
}

/**
 * Classification déchets CERFA [12] :
 * - Inflammable (A2L/A3/A2…) → rubrique 16 05 04*
 * - Non inflammable (A1…) → rubrique 14 06 01*
 * R-410A = A1 / UN 1078 (déchet NSA) → NON inflammable (pas 16 05 04*).
 */
export function isFluideAdrInflammable(fluideCode: string, codeUn?: string): boolean {
  const c = classeSecuriteFluide(fluideCode)
  if (c === 'A1' || c === 'B1') return false
  if (c === 'A2L' || c === 'A2' || c === 'A3' || c === 'B2L' || c === 'B2' || c === 'B3') {
    return true
  }
  if (isFluideInflammableA2LOrA3(fluideCode)) return true
  const code = (codeUn || '').toUpperCase().replace(/\s+/g, '')
  // UN connus inflammables (sans se fier à 3163 — gaz n.s.a. souvent non inflam.)
  if (
    code.includes('3161') ||
    code.includes('3252') ||
    code.includes('1978') ||
    code.includes('1969') ||
    code.includes('1077') ||
    code.includes('1005')
  ) {
    return true
  }
  return false
}

export function messageBouteilleRecupA2L(code: string): string | null {
  if (!isFluideInflammableA2LOrA3(code)) return null
  const classe = classeSecuriteFluide(code) || 'A2L'
  return `Bouteille ${classe} obligatoire (collerette rouge + pas de vis à gauche / LH). Pictogramme flamme, classe gravée, PH (bar) et date de rééprouvage à vérifier.`
}

/** Transport ADR / RID — cadres CERFA [12] (préremplissage stock). */
export type FluideAdrInfo = {
  codeUn: string
  denominationAdr: string
}

/** Chiffres du code UN (sans préfixe « UN », sans doublon). */
export function digitsCodeUn(raw?: string | null): string {
  return String(raw || '')
    .replace(/^UN\s*/i, '')
    .replace(/\D/g, '')
}

/** Nom usuel CERFA : R-32 → « R 32 », R-134a → « R 134a ». */
export function formatNomUsuelGaz(code: string): string {
  const raw = (code || '').trim()
  const m = raw.match(/^R[-\s]?(.+)$/i)
  if (!m) return raw
  return `R ${m[1]}`
}

/**
 * Chaîne ADR officielle, sans doublon de code UN :
 * `UN [code] [NOM OFFICIEL] (GAZ RÉFRIGÉRANT [nom usuel]), [classe]`
 * Les NSA n’ont pas de parenthèse « GAZ RÉFRIGÉRANT ».
 */
export function formatDenominationAdrOfficielle(opts: {
  codeUn: string
  nomOfficiel: string
  nomUsuel?: string | null
  classeDanger: string
}): string {
  const un = digitsCodeUn(opts.codeUn)
  let nom = String(opts.nomOfficiel || '')
    .replace(/^\d{3,4}\s+/, '')
    .replace(/^UN\s*\d{3,4}\s*/i, '')
    .replace(/\s+/g, ' ')
    .trim()
  const usuel = (opts.nomUsuel || '').trim()
  const nomUp = nom.toUpperCase()
  const dejaUsuel =
    !usuel ||
    nomUp.includes(usuel.toUpperCase()) ||
    nomUp.includes('NSA') ||
    nomUp.includes('GAZ RÉFRIGÉRANT') ||
    nomUp.includes('GAZ REFRIGERANT')
  const gaz = !dejaUsuel ? ` (GAZ RÉFRIGÉRANT ${usuel})` : ''
  const classe = String(opts.classeDanger || '').trim()
  const corps = [`UN ${un}`, `${nom}${gaz}`].filter((p) => p && p !== 'UN ').join(' ')
  return classe ? `${corps}, ${classe}` : corps
}

/**
 * Évite « 3252 UN 3252 … » quand le code UN est déjà dans la dénomination.
 */
export function libelleAdrSansDoublon(codeUn?: string, denominationAdr?: string): string {
  let denom = (denominationAdr || '').trim()
  const code = digitsCodeUn(codeUn)
  if (!denom && !code) return ''
  denom = denom.replace(/^\d{3,4}\s+(?=UN\s*\d{3,4}\b)/i, '').trim()
  if (!denom) return code ? `UN ${code}` : ''
  if (/^UN\s*\d{3,4}\b/i.test(denom)) return denom
  if (code && denom.toUpperCase().startsWith(code)) {
    const rest = denom.slice(code.length).trim()
    return rest ? `UN ${code} ${rest}` : `UN ${code}`
  }
  return code ? `UN ${code} ${denom}` : denom
}

/** Libellé à imprimer sur le CERFA [12] — fluide d’abord, sinon nettoyage du texte saisi. */
export function libelleAdrPourCerfa(opts: {
  fluideType?: string
  codeUn?: string
  denominationAdr?: string
}): string {
  const auto = opts.fluideType ? adrInfoForFluide(opts.fluideType) : null
  if (auto?.denominationAdr) return auto.denominationAdr
  return libelleAdrSansDoublon(opts.codeUn, opts.denominationAdr)
}

function adrNamed(
  codeUn: string,
  nomOfficiel: string,
  fluideCode: string,
  classeDanger: string,
): FluideAdrInfo {
  return {
    codeUn,
    denominationAdr: formatDenominationAdrOfficielle({
      codeUn,
      nomOfficiel,
      nomUsuel: formatNomUsuelGaz(fluideCode),
      classeDanger,
    }),
  }
}

function adrNsa(codeUn: string, nomOfficiel: string, classeDanger: string): FluideAdrInfo {
  return {
    codeUn,
    denominationAdr: formatDenominationAdrOfficielle({
      codeUn,
      nomOfficiel,
      classeDanger,
    }),
  }
}

const FLUIDE_ADR: Record<string, FluideAdrInfo> = {
  'R-32': adrNamed('3252', 'DIFLUOROMÉTHANE', 'R-32', '2.1'),
  'R-134A': adrNamed('3159', 'TÉTRAFLUOROÉTHANE', 'R-134a', '2.2'),
  'R-407C': adrNamed('3340', 'GAZ RÉFRIGÉRANT R 407C', 'R-407C', '2.2'),
  'R-410A': adrNsa('1078', 'DÉCHET GAZ FRIGORIFIQUE NSA', '2.2'),
  'R-404A': adrNamed('3337', 'GAZ RÉFRIGÉRANT R 404A', 'R-404A', '2.2'),
  'R-507A': adrNsa('1078', 'DÉCHET GAZ FRIGORIFIQUE NSA', '2.2'),
  'R-1234YF': adrNamed('3161', '2,3,3,3-TÉTRAFLUOROPROPÈNE', 'R-1234yf', '2.1'),
  'R-1234ZE': adrNsa('3161', 'DÉCHET GAZ LIQUÉFIÉ INFLAMMABLE NSA', '2.1'),
  'R-1233ZD': adrNsa('1078', 'DÉCHET GAZ FRIGORIFIQUE NSA', '2.2'),
  'R-454C': adrNsa('3161', 'DÉCHET GAZ LIQUÉFIÉ INFLAMMABLE NSA', '2.1'),
  'R-455A': adrNsa('3161', 'DÉCHET GAZ LIQUÉFIÉ INFLAMMABLE NSA', '2.1'),
  'R-454B': adrNsa('3161', 'DÉCHET GAZ LIQUÉFIÉ INFLAMMABLE NSA', '2.1'),
  'R-448A': adrNsa('1078', 'DÉCHET GAZ FRIGORIFIQUE NSA', '2.2'),
  'R-449A': adrNsa('1078', 'DÉCHET GAZ FRIGORIFIQUE NSA', '2.2'),
  'R-452A': adrNsa('1078', 'DÉCHET GAZ FRIGORIFIQUE NSA', '2.2'),
  'R-744': adrNamed('1013', 'DIOXYDE DE CARBONE', 'R-744', '2.2'),
  'R-717': adrNamed('1005', 'AMMONIAC ANHYDRE', 'R-717', '2.3'),
  'R-290': adrNamed('1978', 'PROPANE', 'R-290', '2.1'),
  'R-600A': adrNamed('1969', 'ISOBUTANE', 'R-600A', '2.1'),
  'R-1270': adrNamed('1077', 'PROPYLÈNE', 'R-1270', '2.1'),
  'R-22': adrNamed('1018', 'CHLORODIFLUOROMÉTHANE', 'R-22', '2.2'),
  'R-12': adrNamed('1028', 'DICHLORODIFLUOROMÉTHANE', 'R-12', '2.2'),
  'R-502': adrNamed(
    '1973',
    'MÉLANGE CHLORODIFLUOROMÉTHANE ET CHLOROPENTAFLUOROÉTHANE',
    'R-502',
    '2.2',
  ),
  'R-408A': adrNsa('1078', 'DÉCHET GAZ FRIGORIFIQUE NSA', '2.2'),
  'R-409A': adrNsa('1078', 'DÉCHET GAZ FRIGORIFIQUE NSA', '2.2'),
}

/**
 * Code UN + dénomination ADR/RID selon le fluide (CERFA [12] — 100 % auto).
 * Source : table A ADR / fiches SDS distributeurs (Climalife, Arkema…).
 */
export function adrInfoForFluide(fluideCode: string): FluideAdrInfo | null {
  if (!fluideCode.trim()) return null
  const key = normalizeFluideCode(fluideCode)
  return FLUIDE_ADR[key] || null
}

/** Charge (kg) × GWP / 1000 → tonnes eq. CO₂ */
export function calcTeqCO2(chargeKg: number, gwp: number): number {
  if (!Number.isFinite(chargeKg) || !Number.isFinite(gwp) || chargeKg <= 0) return 0
  const teq = (chargeKg * gwp) / 1000
  return Math.round(teq * 1000) / 1000
}

export function calcTeqCO2FromFluide(chargeKg: number, fluideCode: string): number | null {
  const f = findFluide(fluideCode)
  if (!f) return null
  return calcTeqCO2(chargeKg, f.gwp)
}

export function formatGwp(f: FluideRef): string {
  if (f.gwpApprox && f.gwp <= 1) return '< 1'
  if (f.gwpApprox) return `~${f.gwp.toLocaleString('fr-FR')}`
  return f.gwp.toLocaleString('fr-FR', { maximumFractionDigits: 2 })
}

export function fluidesByFamille(): { famille: FluideFamille; label: string; items: FluideRef[] }[] {
  return FAMILLE_ORDER.map((famille) => ({
    famille,
    label: FAMILLE_LABEL[famille],
    items: FLUIDES.filter((f) => f.famille === famille),
  })).filter((g) => g.items.length > 0)
}

/** Famille CERFA [7] cases HFC / HFO / HCFC */
export function cerfaSeuilFamille(code: string): 'HFC' | 'HFO' | 'HCFC' | 'autre' {
  const f = findFluide(code)
  if (!f) {
    const u = code.toUpperCase()
    if (/1234|HFO|454|455|448|449|452/.test(u)) return 'HFO'
    if (/HCFC|^R-?22|^R-?408|^R-?409/.test(u)) return 'HCFC'
    if (/^R-?(744|717|290|600|1270)/.test(u)) return 'autre'
    return 'HFC'
  }
  if (f.famille === 'HFO') return 'HFO'
  if (f.famille === 'HCFC' || f.famille === 'CFC') return 'HCFC'
  if (f.famille === 'HFC') return 'HFC'
  return 'autre'
}

/**
 * Cadres [7]/[8]/[9] — contrôle périodique.
 * Sous les seuils (HCFC < 2 kg, HFC < 5 t eq. CO₂, HFO < 1 kg) : pas d’obligation → aucune case.
 */
export type ControlesPeriodiquesInfo = {
  famille: 'HFC' | 'HFO' | 'HCFC' | 'autre'
  /** 0 = sous seuil (non obligatoire), 1/2/3 = colonne du tableau CERFA */
  colonne: 0 | 1 | 2 | 3
  obligatoire: boolean
  /** Périodicité réglementaire suggérée, ou null si non obligatoire */
  periodeSuggeree: string | null
  message: string
}

export function controlesPeriodiquesInfo(opts: {
  fluideCode: string
  chargeKg: number
  teqCO2: number
  detectionPermanente: boolean
}): ControlesPeriodiquesInfo {
  const famille = cerfaSeuilFamille(opts.fluideCode)
  const kg = Number(opts.chargeKg) || 0
  const teq = Number(opts.teqCO2) || 0

  let colonne: 0 | 1 | 2 | 3 = 0

  if (famille === 'HCFC') {
    if (kg >= 300) colonne = 3
    else if (kg >= 30) colonne = 2
    else if (kg >= 2) colonne = 1
  } else if (famille === 'HFO') {
    if (kg >= 100) colonne = 3
    else if (kg >= 10) colonne = 2
    else if (kg >= 1) colonne = 1
  } else if (famille === 'HFC') {
    // Seuils en tonnes eq. CO₂ (pas en kg)
    if (teq >= 500) colonne = 3
    else if (teq >= 50) colonne = 2
    else if (teq >= 5) colonne = 1
  }

  if (famille === 'autre' || colonne === 0) {
    const seuilTxt =
      famille === 'HCFC'
        ? 'HCFC < 2 kg'
        : famille === 'HFO'
          ? 'HFO < 1 kg'
          : famille === 'HFC'
            ? 'HFC / PFC < 5 t eq. CO₂'
            : 'fluide hors tableau HCFC/HFC/HFO'
    return {
      famille,
      colonne: 0,
      obligatoire: false,
      periodeSuggeree: null,
      message: `Sous le seuil (${seuilTxt}) : contrôle périodique non obligatoire — aucune case [8]/[9] à cocher.`,
    }
  }

  // [8] sans détection : 12 / 6 / 3 mois — [9] avec : 24 / 12 / 6 mois
  const sans = ['12 mois', '6 mois', '3 mois'] as const
  const avec = ['24 mois', '12 mois', '6 mois'] as const
  const periodeSuggeree = opts.detectionPermanente ? avec[colonne - 1] : sans[colonne - 1]

  const detail =
    famille === 'HFC'
      ? `${teq} t eq. CO₂ (seuil ≥ 5 t)`
      : famille === 'HFO'
        ? `${kg} kg HFO (seuil ≥ 1 kg)`
        : `${kg} kg HCFC (seuil ≥ 2 kg)`

  return {
    famille,
    colonne,
    obligatoire: true,
    periodeSuggeree,
    message: `Contrôle périodique obligatoire (${detail}) → case [7] colonne ${colonne} + périodicité ${periodeSuggeree} (${opts.detectionPermanente ? 'avec' : 'sans'} détection permanente [6]).`,
  }
}

