/**
 * Agences société = département (75 Paris, 06 Alpes-Maritimes, 13 Bouches-du-Rhône…).
 * Clients, sites, techs et responsables s’y rattachent.
 */

export type AgenceDef = { code: string; nom: string }

export const DEPARTEMENTS_FR: readonly AgenceDef[] = [
  { code: '01', nom: 'Ain' },
  { code: '02', nom: 'Aisne' },
  { code: '03', nom: 'Allier' },
  { code: '04', nom: 'Alpes-de-Haute-Provence' },
  { code: '05', nom: 'Hautes-Alpes' },
  { code: '06', nom: 'Alpes-Maritimes' },
  { code: '07', nom: 'Ardèche' },
  { code: '08', nom: 'Ardennes' },
  { code: '09', nom: 'Ariège' },
  { code: '10', nom: 'Aube' },
  { code: '11', nom: 'Aude' },
  { code: '12', nom: 'Aveyron' },
  { code: '13', nom: 'Bouches-du-Rhône' },
  { code: '14', nom: 'Calvados' },
  { code: '15', nom: 'Cantal' },
  { code: '16', nom: 'Charente' },
  { code: '17', nom: 'Charente-Maritime' },
  { code: '18', nom: 'Cher' },
  { code: '19', nom: 'Corrèze' },
  { code: '21', nom: 'Côte-d’Or' },
  { code: '22', nom: 'Côtes-d’Armor' },
  { code: '23', nom: 'Creuse' },
  { code: '24', nom: 'Dordogne' },
  { code: '25', nom: 'Doubs' },
  { code: '26', nom: 'Drôme' },
  { code: '27', nom: 'Eure' },
  { code: '28', nom: 'Eure-et-Loir' },
  { code: '29', nom: 'Finistère' },
  { code: '2A', nom: 'Corse-du-Sud' },
  { code: '2B', nom: 'Haute-Corse' },
  { code: '30', nom: 'Gard' },
  { code: '31', nom: 'Haute-Garonne' },
  { code: '32', nom: 'Gers' },
  { code: '33', nom: 'Gironde' },
  { code: '34', nom: 'Hérault' },
  { code: '35', nom: 'Ille-et-Vilaine' },
  { code: '36', nom: 'Indre' },
  { code: '37', nom: 'Indre-et-Loire' },
  { code: '38', nom: 'Isère' },
  { code: '39', nom: 'Jura' },
  { code: '40', nom: 'Landes' },
  { code: '41', nom: 'Loir-et-Cher' },
  { code: '42', nom: 'Loire' },
  { code: '43', nom: 'Haute-Loire' },
  { code: '44', nom: 'Loire-Atlantique' },
  { code: '45', nom: 'Loiret' },
  { code: '46', nom: 'Lot' },
  { code: '47', nom: 'Lot-et-Garonne' },
  { code: '48', nom: 'Lozère' },
  { code: '49', nom: 'Maine-et-Loire' },
  { code: '50', nom: 'Manche' },
  { code: '51', nom: 'Marne' },
  { code: '52', nom: 'Haute-Marne' },
  { code: '53', nom: 'Mayenne' },
  { code: '54', nom: 'Meurthe-et-Moselle' },
  { code: '55', nom: 'Meuse' },
  { code: '56', nom: 'Morbihan' },
  { code: '57', nom: 'Moselle' },
  { code: '58', nom: 'Nièvre' },
  { code: '59', nom: 'Nord' },
  { code: '60', nom: 'Oise' },
  { code: '61', nom: 'Orne' },
  { code: '62', nom: 'Pas-de-Calais' },
  { code: '63', nom: 'Puy-de-Dôme' },
  { code: '64', nom: 'Pyrénées-Atlantiques' },
  { code: '65', nom: 'Hautes-Pyrénées' },
  { code: '66', nom: 'Pyrénées-Orientales' },
  { code: '67', nom: 'Bas-Rhin' },
  { code: '68', nom: 'Haut-Rhin' },
  { code: '69', nom: 'Rhône' },
  { code: '70', nom: 'Haute-Saône' },
  { code: '71', nom: 'Saône-et-Loire' },
  { code: '72', nom: 'Sarthe' },
  { code: '73', nom: 'Savoie' },
  { code: '74', nom: 'Haute-Savoie' },
  { code: '75', nom: 'Paris' },
  { code: '76', nom: 'Seine-Maritime' },
  { code: '77', nom: 'Seine-et-Marne' },
  { code: '78', nom: 'Yvelines' },
  { code: '79', nom: 'Deux-Sèvres' },
  { code: '80', nom: 'Somme' },
  { code: '81', nom: 'Tarn' },
  { code: '82', nom: 'Tarn-et-Garonne' },
  { code: '83', nom: 'Var' },
  { code: '84', nom: 'Vaucluse' },
  { code: '85', nom: 'Vendée' },
  { code: '86', nom: 'Vienne' },
  { code: '87', nom: 'Haute-Vienne' },
  { code: '88', nom: 'Vosges' },
  { code: '89', nom: 'Yonne' },
  { code: '90', nom: 'Territoire de Belfort' },
  { code: '91', nom: 'Essonne' },
  { code: '92', nom: 'Hauts-de-Seine' },
  { code: '93', nom: 'Seine-Saint-Denis' },
  { code: '94', nom: 'Val-de-Marne' },
  { code: '95', nom: 'Val-d’Oise' },
  { code: '971', nom: 'Guadeloupe' },
  { code: '972', nom: 'Martinique' },
  { code: '973', nom: 'Guyane' },
  { code: '974', nom: 'La Réunion' },
  { code: '976', nom: 'Mayotte' },
] as const

const BY_CODE = new Map(DEPARTEMENTS_FR.map((d) => [d.code, d]))

export function parseAgenceCode(raw: unknown): string | undefined {
  const v = String(raw || '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '')
  if (!v) return undefined
  if (BY_CODE.has(v)) return v
  const padded = v.padStart(2, '0')
  if (BY_CODE.has(padded)) return padded
  return undefined
}

export function labelAgence(code: unknown): string {
  const parsed = parseAgenceCode(code)
  if (!parsed) return ''
  const d = BY_CODE.get(parsed)
  return d ? `${d.code} · ${d.nom}` : parsed
}

export function nomAgence(code: unknown): string {
  const parsed = parseAgenceCode(code)
  if (!parsed) return ''
  return BY_CODE.get(parsed)?.nom || parsed
}

/** CP français → code département (agence). */
export function agenceDepuisCodePostal(cp: string | undefined): string | undefined {
  const digits = String(cp || '').replace(/\D/g, '')
  if (digits.length < 2) return undefined
  if (digits.startsWith('971')) return parseAgenceCode('971')
  if (digits.startsWith('972')) return parseAgenceCode('972')
  if (digits.startsWith('973')) return parseAgenceCode('973')
  if (digits.startsWith('974')) return parseAgenceCode('974')
  if (digits.startsWith('976')) return parseAgenceCode('976')
  if (digits.startsWith('20')) {
    const n = Number(digits.slice(0, 3) || '200')
    if (n >= 200 && n < 202) return '2A'
    return '2B'
  }
  return parseAgenceCode(digits.slice(0, 2))
}

export function agenceEffective(opts: {
  agenceCode?: string
  codePostal?: string
  fallbackCode?: string
}): string | undefined {
  return (
    parseAgenceCode(opts.agenceCode) ||
    agenceDepuisCodePostal(opts.codePostal) ||
    parseAgenceCode(opts.fallbackCode)
  )
}
