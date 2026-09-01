/**
 * Poste métier de chaque membre (Équipe) — indépendant du rôle login (owner / opérateur).
 * Permet de voir qui fait le terrain et qui pilote toute l’équipe.
 */

export type PosteFamille = 'terrain' | 'bureau'

export type PostePersonnelId =
  | 'tech_cvc'
  | 'tech_frigoriste'
  | 'tech_multitechnique'
  | 'plombier'
  | 'electricien'
  | 'responsable'
  | 'pilote'
  | 'secretaire'
  | 'directeur'
  | 'standard'
  | 'comptable'

export type PostePersonnelDef = {
  id: PostePersonnelId
  label: string
  famille: PosteFamille
  /** Responsable / directeur / pilote : s’occupe de toute l’équipe, pas d’un seul métier. */
  couvreTouteLEquipe?: boolean
}

export const POSTES_PERSONNEL: readonly PostePersonnelDef[] = [
  { id: 'tech_cvc', label: 'Tech CVC', famille: 'terrain' },
  { id: 'tech_frigoriste', label: 'Tech frigoriste', famille: 'terrain' },
  { id: 'tech_multitechnique', label: 'Tech multitechnique', famille: 'terrain' },
  { id: 'plombier', label: 'Plombier', famille: 'terrain' },
  { id: 'electricien', label: 'Électricien', famille: 'terrain' },
  { id: 'responsable', label: 'Responsable', famille: 'bureau', couvreTouteLEquipe: true },
  { id: 'pilote', label: 'Pilote', famille: 'bureau', couvreTouteLEquipe: true },
  { id: 'secretaire', label: 'Secrétaire', famille: 'bureau' },
  { id: 'directeur', label: 'Directeur', famille: 'bureau', couvreTouteLEquipe: true },
  { id: 'standard', label: 'Standard', famille: 'bureau' },
  { id: 'comptable', label: 'Comptable', famille: 'bureau' },
] as const

const POSTE_BY_ID = new Map<string, PostePersonnelDef>(POSTES_PERSONNEL.map((p) => [p.id, p]))

export function parsePostePersonnel(raw: unknown): PostePersonnelId | undefined {
  const id = String(raw || '').trim()
  if (!id) return undefined
  return POSTE_BY_ID.has(id) ? (id as PostePersonnelId) : undefined
}

export function defPostePersonnel(id: unknown): PostePersonnelDef | undefined {
  const parsed = parsePostePersonnel(id)
  return parsed ? POSTE_BY_ID.get(parsed) : undefined
}

export function labelPostePersonnel(id: unknown): string {
  return defPostePersonnel(id)?.label || ''
}

export function isPosteBureau(id: unknown): boolean {
  return defPostePersonnel(id)?.famille === 'bureau'
}

export function isPosteTerrain(id: unknown): boolean {
  return defPostePersonnel(id)?.famille === 'terrain'
}

/** Responsable, directeur, pilote : encadrent toute l’équipe. */
export function posteCouvreTouteLEquipe(id: unknown): boolean {
  return Boolean(defPostePersonnel(id)?.couvreTouteLEquipe)
}

export function postesParFamille(famille: PosteFamille): PostePersonnelDef[] {
  return POSTES_PERSONNEL.filter((p) => p.famille === famille)
}

/** Métiers terrain utilisés pour classer un OT (CVC, frigoriste…). */
export function secteursOt(): PostePersonnelDef[] {
  return postesParFamille('terrain')
}

export function isSecteurOt(id: unknown): boolean {
  return isPosteTerrain(id)
}

/** Badge court : CVC, Frigo, Multi… */
export function labelSecteurCourt(id: unknown): string {
  const parsed = parsePostePersonnel(id)
  if (parsed === 'tech_cvc') return 'CVC'
  if (parsed === 'tech_frigoriste') return 'Frigo'
  if (parsed === 'tech_multitechnique') return 'Multi'
  if (parsed === 'plombier') return 'Plombier'
  if (parsed === 'electricien') return 'Élec'
  return labelPostePersonnel(id)
}

/** Si le tech a un poste terrain, on peut préremplir le secteur de l’OT. */
export function secteurOtDepuisPoste(poste: unknown): PostePersonnelId | undefined {
  return isPosteTerrain(poste) ? parsePostePersonnel(poste) : undefined
}

export type ActiviteBureau = 'travaux' | 'maintenance' | 'les_deux'

export const ACTIVITE_BUREAU_LABELS: Record<ActiviteBureau, string> = {
  travaux: 'Travaux',
  maintenance: 'Maintenance',
  les_deux: 'Travaux + maintenance',
}

export function parseActiviteBureau(raw: unknown): ActiviteBureau | undefined {
  const v = String(raw || '').trim()
  if (v === 'travaux' || v === 'maintenance' || v === 'les_deux') return v
  return undefined
}

export function parseMetiersCouverts(raw: unknown): PostePersonnelId[] {
  if (!Array.isArray(raw)) return []
  const out: PostePersonnelId[] = []
  const seen = new Set<string>()
  for (const item of raw) {
    const id = parsePostePersonnel(item)
    if (!id || !isPosteTerrain(id) || seen.has(id)) continue
    seen.add(id)
    out.push(id)
  }
  return out
}

/** Couleur agenda : poste terrain, sinon 1er métier couvert (responsable). */
export function secteurCouleurMembre(opts: {
  poste?: unknown
  metiersCouverts?: unknown
}): PostePersonnelId | undefined {
  return secteurOtDepuisPoste(opts.poste) || parseMetiersCouverts(opts.metiersCouverts)[0]
}

/** Ligne compacte Équipe : « Jean Dupont · Tech CVC ». */
export function ligneNomPoste(opts: {
  nom: string
  poste?: unknown
  roleOwner?: boolean
}): string {
  const nom = (opts.nom || '').trim() || 'Membre'
  const poste = labelPostePersonnel(opts.poste)
  if (poste) return `${nom} · ${poste}`
  if (opts.roleOwner) return `${nom} · Gérant`
  return `${nom} · poste à définir`
}

/** Libellé d’option d’affectation OT. */
export function optionLabelAvecPoste(opts: {
  nom: string
  poste?: unknown
  roleOwner?: boolean
  inactif?: boolean
}): string {
  const bits = [ligneNomPoste({ nom: opts.nom, poste: opts.poste, roleOwner: opts.roleOwner })]
  if (posteCouvreTouteLEquipe(opts.poste)) bits.push('toute l’équipe')
  if (opts.inactif) bits.push('inactif')
  return bits.join(' · ')
}
