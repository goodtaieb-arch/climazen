/**
 * Validations humaines IA (Lola / assistant) —
 * notification au responsable du secteur de l’appel.
 */

import {
  parseMetiersCouverts,
  parsePostePersonnel,
  posteCouvreTouteLEquipe,
  type PostePersonnelId,
} from './postePersonnel'
import type { PersonnelDossier } from './rhDocuments'
import { matchAgenceFilter, agencesDuMembre } from './agences'

export type AiPendingSource = 'assistant' | 'phone' | 'voice' | 'system'

export type AiPendingKind =
  | 'ot'
  | 'devis'
  | 'commande'
  | 'piece'
  | 'agenda'
  | 'client'
  | 'autre'

export type AiPendingStatut = 'a_valider' | 'validee' | 'refusee' | 'expiree'

export type AiPendingValidation = {
  id: string
  createdAt: string
  updatedAt: string
  source: AiPendingSource
  kind: AiPendingKind
  /** Secteur métier de l’appel / OT (CVC, frigo…). */
  secteur?: PostePersonnelId
  agenceCode?: string
  title: string
  summary: string
  /** Texte brut appel / demande */
  callerHint?: string
  clientHint?: string
  siteHint?: string
  /** Responsable ciblé (secteur). */
  assigneeUserId?: string
  assigneeName?: string
  /** Fallback gérant / e-mail téléphonie. */
  notifyEmail?: string
  statut: AiPendingStatut
  decidedByUserId?: string
  decidedByName?: string
  decidedAt?: string
}

const SECTEUR_KEYWORDS: { re: RegExp; id: PostePersonnelId }[] = [
  { re: /\b(clim|cvc|pac|chauffage|vmc|cta|climatis)/i, id: 'tech_cvc' },
  { re: /\b(frigo|froid|chambre\s*froide|groupe\s*froid|r-?\d{2,4}|fluide)/i, id: 'tech_frigoriste' },
  { re: /\b(multi[\s-]?tech|multitechnique)/i, id: 'tech_multitechnique' },
  { re: /\bplomb/i, id: 'plombier' },
  { re: /\b[eé]lectri/i, id: 'electricien' },
]

/** Déduit le secteur depuis la phrase / synthèse d’appel. */
export function inferSecteurFromText(text: string): PostePersonnelId | undefined {
  const t = text || ''
  for (const { re, id } of SECTEUR_KEYWORDS) {
    if (re.test(t)) return id
  }
  return undefined
}

export function inferKindFromText(text: string): AiPendingKind {
  const n = (text || '').toLowerCase()
  if (/\bdevis\b/.test(n)) return 'devis'
  if (/\bcommande\b|\bpi[eè]ce\b/.test(n)) return 'commande'
  if (/\bagenda\b|\brdv\b|\brendez/.test(n)) return 'agenda'
  if (/\bclient\b/.test(n) && /cr[eé]e|nouveau/.test(n)) return 'client'
  if (/\bot\b|\bcerfa\b|\bd[eé]pann|\bintervention|\bentretien|\bmaintenance/.test(n)) return 'ot'
  return 'autre'
}

type ResolveOpts = {
  secteur?: PostePersonnelId
  agenceCode?: string
  /** Exclure comptes retirés */
  retiresUserIds?: string[]
}

/**
 * Choisit le responsable du secteur pour valider.
 * Priorité : responsable/pilote/directeur qui couvre le métier (+ agence),
 * sinon tout encadrant, sinon null (fallback e-mail gérant).
 */
export function resolveResponsableSecteur(
  dossiers: PersonnelDossier[] | undefined,
  opts: ResolveOpts,
): { userId: string; userName: string; telephone?: string } | null {
  const list = (dossiers || []).filter(
    (d) => d.userId && !(opts.retiresUserIds || []).includes(d.userId),
  )
  if (list.length === 0) return null

  const secteur = opts.secteur
  const encadrants = list.filter((d) => posteCouvreTouteLEquipe(d.poste))

  const score = (d: PersonnelDossier): number => {
    let s = 0
    const metiers = parseMetiersCouverts(d.metiersCouverts)
    if (secteur && metiers.includes(secteur)) s += 50
    if (secteur && parsePostePersonnel(d.poste) === secteur) s += 20
    if (posteCouvreTouteLEquipe(d.poste)) s += 10
    if (opts.agenceCode) {
      const ags = agencesDuMembre({
        agenceCode: d.agenceCode,
        agencesCouvertes: d.agencesCouvertes,
      })
      if (ags.length === 0 || matchAgenceFilter(opts.agenceCode, ags)) s += 30
    }
    if (d.poste === 'responsable') s += 5
    if (d.poste === 'pilote') s += 4
    if (d.poste === 'directeur') s += 3
    return s
  }

  const pool = encadrants.length > 0 ? encadrants : list
  const ranked = [...pool].sort((a, b) => score(b) - score(a))
  const best = ranked[0]
  if (!best || score(best) <= 0) {
    // Aucun score métier : prendre le 1er encadrant
    const fallback = encadrants[0] || null
    if (!fallback) return null
    return {
      userId: fallback.userId,
      userName: fallback.userName,
      telephone: fallback.telephone,
    }
  }
  return {
    userId: best.userId,
    userName: best.userName,
    telephone: best.telephone,
  }
}

export function buildAiPendingValidation(input: {
  source: AiPendingSource
  kind?: AiPendingKind
  title: string
  summary: string
  textForInfer?: string
  secteur?: PostePersonnelId
  agenceCode?: string
  callerHint?: string
  clientHint?: string
  siteHint?: string
  dossiers?: PersonnelDossier[]
  retiresUserIds?: string[]
  notifyEmailFallback?: string
  id?: string
  now?: string
}): AiPendingValidation {
  const now = input.now || new Date().toISOString()
  const text = [input.textForInfer, input.title, input.summary, input.callerHint]
    .filter(Boolean)
    .join(' ')
  const secteur = input.secteur || inferSecteurFromText(text)
  const kind = input.kind || inferKindFromText(text)
  const assignee = resolveResponsableSecteur(input.dossiers, {
    secteur,
    agenceCode: input.agenceCode,
    retiresUserIds: input.retiresUserIds,
  })
  return {
    id: input.id || crypto.randomUUID(),
    createdAt: now,
    updatedAt: now,
    source: input.source,
    kind,
    secteur,
    agenceCode: input.agenceCode,
    title: input.title.slice(0, 160),
    summary: input.summary.slice(0, 2000),
    callerHint: input.callerHint,
    clientHint: input.clientHint,
    siteHint: input.siteHint,
    assigneeUserId: assignee?.userId,
    assigneeName: assignee?.userName,
    notifyEmail: input.notifyEmailFallback,
    statut: 'a_valider',
  }
}

export function pendingValidationsForUser(
  list: AiPendingValidation[] | undefined,
  userId: string | undefined,
  opts?: { includeUnassigned?: boolean; isOwner?: boolean },
): AiPendingValidation[] {
  const items = (list || []).filter((x) => x.statut === 'a_valider')
  if (!userId) return []
  return items.filter((x) => {
    if (x.assigneeUserId === userId) return true
    if (opts?.isOwner && (!x.assigneeUserId || opts.includeUnassigned)) return true
    if (opts?.includeUnassigned && !x.assigneeUserId) return true
    return false
  })
}

export function labelAiPendingKind(kind: AiPendingKind): string {
  switch (kind) {
    case 'ot':
      return 'Intervention'
    case 'devis':
      return 'Devis'
    case 'commande':
      return 'Commande'
    case 'piece':
      return 'Pièce'
    case 'agenda':
      return 'Agenda'
    case 'client':
      return 'Client'
    default:
      return 'Action IA'
  }
}

export function labelAiPendingSource(source: AiPendingSource): string {
  switch (source) {
    case 'phone':
      return 'Lola téléphone'
    case 'assistant':
      return 'Assistant site'
    case 'voice':
      return 'Voix app'
    default:
      return 'Système'
  }
}
