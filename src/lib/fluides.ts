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
}

export const FLUIDES: FluideRef[] = [
  // 1. HFC
  {
    code: 'R-32',
    famille: 'HFC',
    familleDetail: 'HFC pur',
    gwp: 675,
    applications: 'Climatisation résidentielle, Pompes à chaleur (PAC)',
  },
  {
    code: 'R-134a',
    famille: 'HFC',
    familleDetail: 'HFC pur',
    gwp: 1430,
    applications: 'Chillers, Froid commercial, Climatisation automobile',
  },
  {
    code: 'R-407C',
    famille: 'HFC',
    familleDetail: 'Mélange HFC',
    gwp: 1774,
    applications: 'Climatisation, Groupes de production d’eau glacée',
  },
  {
    code: 'R-410A',
    famille: 'HFC',
    familleDetail: 'Mélange HFC',
    gwp: 2088,
    applications: 'PAC, Climatisation (remplacement progressif par R-32 / R-454B)',
  },
  {
    code: 'R-404A',
    famille: 'HFC',
    familleDetail: 'Mélange HFC',
    gwp: 3922,
    applications: 'Froid commercial & industriel (interdiction de recharge neuve)',
  },
  {
    code: 'R-507A',
    famille: 'HFC',
    familleDetail: 'Mélange HFC',
    gwp: 3985,
    applications: 'Froid commercial & industriel à basse température',
  },

  // 2. HFO & mélanges HFO/HFC
  {
    code: 'R-1234yf',
    famille: 'HFO',
    familleDetail: 'HFO pur',
    gwp: 1,
    gwpApprox: true,
    applications: 'Climatisation automobile, Chillers',
  },
  {
    code: 'R-1234ze',
    famille: 'HFO',
    familleDetail: 'HFO pur',
    gwp: 1,
    gwpApprox: true,
    applications: 'Groupes d’eau glacée, Pompes à chaleur grande puissance',
  },
  {
    code: 'R-1233zd',
    famille: 'HFO',
    familleDetail: 'HFO pur',
    gwp: 1,
    applications: 'Chillers centrifuges très basse pression',
  },
  {
    code: 'R-454C',
    famille: 'HFO',
    familleDetail: 'Mélange HFO/HFC',
    gwp: 148,
    applications: 'Alternative au R-404A (GWP < 150)',
  },
  {
    code: 'R-455A',
    famille: 'HFO',
    familleDetail: 'Mélange HFO/HFC',
    gwp: 148,
    applications: 'Froid commercial (GWP < 150)',
  },
  {
    code: 'R-454B',
    famille: 'HFO',
    familleDetail: 'Mélange HFO/HFC',
    gwp: 466,
    applications: 'Alternative principale au R-410A dans les PAC Air-Eau',
  },
  {
    code: 'R-448A',
    famille: 'HFO',
    familleDetail: 'Mélange HFO/HFC',
    gwp: 1387,
    gwpApprox: true,
    applications: 'Substitution directe (drop-in) du R-404A',
  },
  {
    code: 'R-449A',
    famille: 'HFO',
    familleDetail: 'Mélange HFO/HFC',
    gwp: 1387,
    gwpApprox: true,
    applications: 'Substitution directe (drop-in) du R-404A',
  },
  {
    code: 'R-452A',
    famille: 'HFO',
    familleDetail: 'Mélange HFO/HFC',
    gwp: 2140,
    applications: 'Transport frigorifique (camions, conteneurs)',
  },

  // 3. Naturels & HC
  {
    code: 'R-744',
    famille: 'Naturel',
    familleDetail: 'Inorganique naturel (CO₂)',
    gwp: 1,
    applications: 'Référence GWP. Froid commercial (supermarchés), PAC',
  },
  {
    code: 'R-717',
    famille: 'Naturel',
    familleDetail: 'Ammoniac (NH₃)',
    gwp: 0,
    applications: 'Froid industriel (entrepôts logistiques, patinoires)',
  },
  {
    code: 'R-290',
    famille: 'HC',
    familleDetail: 'Hydrocarbure (Propane)',
    gwp: 0.02,
    applications: 'PAC monobloc extérieures, vitrines frigorifiques',
  },
  {
    code: 'R-600a',
    famille: 'HC',
    familleDetail: 'Hydrocarbure (Isobutane)',
    gwp: 0.04,
    applications: 'Électroménager, réfrigérateurs & congélateurs domestiques',
  },
  {
    code: 'R-1270',
    famille: 'HC',
    familleDetail: 'Hydrocarbure (Propylène)',
    gwp: 1.8,
    applications: 'Groupes d’eau glacée, Froid commercial spécialisé',
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

export function findFluide(code: string): FluideRef | undefined {
  if (!code.trim()) return undefined
  const n = normalizeFluideCode(code)
  return FLUIDES.find((f) => normalizeFluideCode(f.code) === n)
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

