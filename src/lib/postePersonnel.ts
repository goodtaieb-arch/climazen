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
