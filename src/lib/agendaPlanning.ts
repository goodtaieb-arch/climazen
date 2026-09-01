/**
 * Planning agenda : vue tech vs bureau, couleurs par secteur (tech), hors OT.
 */

import type { AgendaEvent, AgendaEventType } from './agenda'
import { AGENDA_TYPE_LABELS } from './agenda'
import type { OrdreTravail } from './ordreTravail'
import { isOtCloture } from './ordreTravail'

export const HORS_OT_TECH: AgendaEventType[] = [
  'deplacement_hors_ot',
  'bureau_atelier',
  'fournisseur',
  'pause_repas',
]

export const HORS_OT_BUREAU: AgendaEventType[] = [
  'formation',
  'rdv_garage',
  'hors_ot_libre',
]

export const HORS_OT_ALL: AgendaEventType[] = [...HORS_OT_TECH, ...HORS_OT_BUREAU]

export function isHorsOtType(t: string | undefined): boolean {
  return Boolean(t && (HORS_OT_ALL as string[]).includes(t))
}

export function typesAgendaPourSaisie(opts: { bureau: boolean }): AgendaEventType[] {
  if (opts.bureau) {
    return [
      'rdv',
      'maintenance',
      'controle_etancheite',
      'rappel_appel',
      ...HORS_OT_BUREAU,
      ...HORS_OT_TECH,
      'autre',
    ]
  }
  return [...HORS_OT_TECH, 'rdv', 'autre']
}

export function titreDefautHorsOt(type: AgendaEventType): string {
  if (type === 'hors_ot_libre' || type === 'rdv' || type === 'autre') return ''
  return AGENDA_TYPE_LABELS[type] || ''
}

/** OT pas encore calé à une heure — visible « sans planning ». */
export function otSansCreneau(ot: Pick<OrdreTravail, 'statut' | 'heure'>): boolean {
  if (isOtCloture(ot.statut)) return false
  return !(ot.heure || '').trim()
}

export function estPourTech(
  item: { technicienUserId?: string; createdByUserId?: string },
  userId?: string | null,
): boolean {
  const uid = String(userId || '').trim()
  if (!uid) return false
  return item.technicienUserId === uid || item.createdByUserId === uid
}

export type CouleurSecteur = {
  key: string
  bg: string
  border: string
  badge: string
  text: string
  row: string
  dot: string
}

/** Une couleur stable par tech = un secteur, pour lire vite qui / quand. */
export const PALETTE_SECTEUR: CouleurSecteur[] = [
  {
    key: 'sky',
    bg: 'bg-sky-50',
    border: 'border-sky-400',
    badge: 'bg-sky-700 text-white',
    text: 'text-sky-950',
    row: 'border-sky-300 bg-sky-50',
    dot: 'bg-sky-600',
  },
  {
    key: 'violet',
    bg: 'bg-violet-50',
    border: 'border-violet-400',
    badge: 'bg-violet-700 text-white',
    text: 'text-violet-950',
    row: 'border-violet-300 bg-violet-50',
    dot: 'bg-violet-600',
  },
  {
    key: 'rose',
    bg: 'bg-rose-50',
    border: 'border-rose-400',
    badge: 'bg-rose-700 text-white',
    text: 'text-rose-950',
    row: 'border-rose-300 bg-rose-50',
    dot: 'bg-rose-600',
  },
  {
    key: 'amber',
    bg: 'bg-amber-50',
    border: 'border-amber-400',
    badge: 'bg-amber-800 text-white',
    text: 'text-amber-950',
    row: 'border-amber-300 bg-amber-50',
    dot: 'bg-amber-500',
  },
  {
    key: 'emerald',
    bg: 'bg-emerald-50',
    border: 'border-emerald-400',
    badge: 'bg-emerald-800 text-white',
    text: 'text-emerald-950',
    row: 'border-emerald-300 bg-emerald-50',
    dot: 'bg-emerald-600',
  },
  {
    key: 'indigo',
    bg: 'bg-indigo-50',
    border: 'border-indigo-400',
    badge: 'bg-indigo-700 text-white',
    text: 'text-indigo-950',
    row: 'border-indigo-300 bg-indigo-50',
    dot: 'bg-indigo-600',
  },
  {
    key: 'orange',
    bg: 'bg-orange-50',
    border: 'border-orange-400',
    badge: 'bg-orange-700 text-white',
    text: 'text-orange-950',
    row: 'border-orange-300 bg-orange-50',
    dot: 'bg-orange-500',
  },
  {
    key: 'cyan',
    bg: 'bg-cyan-50',
    border: 'border-cyan-400',
    badge: 'bg-cyan-800 text-white',
    text: 'text-cyan-950',
    row: 'border-cyan-300 bg-cyan-50',
    dot: 'bg-cyan-600',
  },
]

export const COULEUR_NON_AFFECTE: CouleurSecteur = {
  key: 'none',
  bg: 'bg-slate-50',
  border: 'border-slate-300',
  badge: 'bg-slate-500 text-white',
  text: 'text-slate-800',
  row: 'border-slate-200 bg-slate-50',
  dot: 'bg-slate-400',
}

export const COULEURS_HORS_OT: Record<string, CouleurSecteur> = {
  deplacement_hors_ot: {
    key: 'dep',
    bg: 'bg-cyan-50',
    border: 'border-cyan-400',
    badge: 'bg-cyan-800 text-white',
    text: 'text-cyan-950',
    row: 'border-cyan-300 bg-cyan-50',
    dot: 'bg-cyan-600',
  },
  bureau_atelier: {
    key: 'atelier',
    bg: 'bg-slate-100',
    border: 'border-slate-400',
    badge: 'bg-slate-700 text-white',
    text: 'text-slate-900',
    row: 'border-slate-300 bg-slate-100',
    dot: 'bg-slate-600',
  },
  fournisseur: {
    key: 'four',
    bg: 'bg-lime-50',
    border: 'border-lime-500',
    badge: 'bg-lime-800 text-white',
    text: 'text-lime-950',
    row: 'border-lime-300 bg-lime-50',
    dot: 'bg-lime-600',
  },
  pause_repas: {
    key: 'pause',
    bg: 'bg-stone-50',
    border: 'border-stone-400',
    badge: 'bg-stone-600 text-white',
    text: 'text-stone-900',
    row: 'border-stone-300 bg-stone-50',
    dot: 'bg-stone-500',
  },
  formation: {
    key: 'form',
    bg: 'bg-purple-50',
    border: 'border-purple-400',
    badge: 'bg-purple-800 text-white',
    text: 'text-purple-950',
    row: 'border-purple-300 bg-purple-50',
    dot: 'bg-purple-600',
  },
  rdv_garage: {
    key: 'garage',
    bg: 'bg-fuchsia-50',
    border: 'border-fuchsia-400',
    badge: 'bg-fuchsia-800 text-white',
    text: 'text-fuchsia-950',
    row: 'border-fuchsia-300 bg-fuchsia-50',
    dot: 'bg-fuchsia-600',
  },
  hors_ot_libre: {
    key: 'libre',
    bg: 'bg-pink-50',
    border: 'border-pink-400',
    badge: 'bg-pink-700 text-white',
    text: 'text-pink-950',
    row: 'border-pink-300 bg-pink-50',
    dot: 'bg-pink-600',
  },
}

export function hashStable(raw: string): number {
  let h = 0
  for (let i = 0; i < raw.length; i++) h = (h * 31 + raw.charCodeAt(i)) >>> 0
  return h
}

export function couleurSecteurTech(userId?: string | null): CouleurSecteur {
  const id = String(userId || '').trim()
  if (!id) return COULEUR_NON_AFFECTE
  return PALETTE_SECTEUR[hashStable(id) % PALETTE_SECTEUR.length]
}

export function couleurPlanning(opts: {
  horsOtType?: string
  technicienUserId?: string
}): CouleurSecteur {
  if (opts.horsOtType && isHorsOtType(opts.horsOtType)) {
    return COULEURS_HORS_OT[opts.horsOtType] || COULEUR_NON_AFFECTE
  }
  return couleurSecteurTech(opts.technicienUserId)
}

export function visibleAgendaPour(
  opts: {
    bureau: boolean
    userId?: string | null
    filterTechId?: string | null
  },
  item: { technicienUserId?: string; createdByUserId?: string },
): boolean {
  if (opts.bureau) {
    const f = String(opts.filterTechId || '').trim()
    if (!f || f === 'tous') return true
    return item.technicienUserId === f || item.createdByUserId === f
  }
  return estPourTech(item, opts.userId)
}

export function eventAgendaPourTech(e: AgendaEvent, userId?: string | null): boolean {
  return estPourTech(e, userId)
}
