/**
 * Planning agenda : vue tech vs bureau, couleurs par métier (CVC, frigo…), hors OT.
 */

import type { AgendaEvent, AgendaEventType } from './agenda'
import {
  AGENDA_TYPE_LABELS,
  agendaCouvreDate,
  formatHeure,
  isIndispoType,
} from './agenda'
import type { OrdreTravail } from './ordreTravail'
import { isOtCloture, techIdsOt } from './ordreTravail'
import { isPosteBureau, isPosteTerrain, parsePostePersonnel } from './postePersonnel'

/** Fenêtre jour affichée sur la frise (7h → 19h). */
export const JOUR_PLANNING_DEBUT_H = 7
export const JOUR_PLANNING_FIN_H = 19
export const JOUR_PLANNING_SPAN_MIN = (JOUR_PLANNING_FIN_H - JOUR_PLANNING_DEBUT_H) * 60
export const DUREE_PLANNING_DEFAUT = 60

/** Presets durée (OT / agenda) — minutes. Inclut 2 h, demi-journée (6 h), journée (12 h). */
export const DUREES_PLANNING_PRESETS = [30, 60, 90, 120, 180, 240, 360, 720] as const

export function parseHeureToMinutes(h?: string): number | null {
  const v = formatHeure(h)
  if (!v) return null
  const m = /^(\d{1,2}):(\d{2})$/.exec(v)
  if (!m) return null
  const hh = Number(m[1])
  const mm = Number(m[2])
  if (!Number.isFinite(hh) || !Number.isFinite(mm)) return null
  if (hh < 0 || hh > 23 || mm < 0 || mm > 59) return null
  return hh * 60 + mm
}

export function dureeMinutesEffectif(d?: number | null): number {
  const n = Math.round(Number(d) || 0)
  if (!Number.isFinite(n) || n <= 0) return DUREE_PLANNING_DEFAUT
  return Math.min(12 * 60, Math.max(15, n))
}

export function labelDureeMinutes(d?: number | null): string {
  const n = dureeMinutesEffectif(d)
  if (n >= 720) return '1 jour'
  if (n >= 360) return '½ jour'
  if (n < 60) return `${n} min`
  if (n % 60 === 0) return `${n / 60} h`
  return `${Math.floor(n / 60)} h ${n % 60}`
}

export type TimelinePlacement = {
  leftPct: number
  widthPct: number
  startMin: number
  endMin: number
  /** Début hors fenêtre (bloc collé au bord gauche). */
  clippedStart: boolean
  clippedEnd: boolean
}

/** Position % sur la frise 7h–19h. Retourne null si pas d’heure. */
export function timelinePlacement(
  heure?: string,
  dureeMinutes?: number | null,
): TimelinePlacement | null {
  const startAbs = parseHeureToMinutes(heure)
  if (startAbs == null) return null
  const duree = dureeMinutesEffectif(dureeMinutes)
  const dayStart = JOUR_PLANNING_DEBUT_H * 60
  const dayEnd = JOUR_PLANNING_FIN_H * 60
  const endAbs = startAbs + duree
  const clippedStart = startAbs < dayStart
  const clippedEnd = endAbs > dayEnd
  const start = Math.max(dayStart, Math.min(dayEnd - 15, startAbs))
  const end = Math.max(start + 15, Math.min(dayEnd, endAbs))
  const leftPct = ((start - dayStart) / JOUR_PLANNING_SPAN_MIN) * 100
  const widthPct = ((end - start) / JOUR_PLANNING_SPAN_MIN) * 100
  return {
    leftPct: Math.max(0, Math.min(100, leftPct)),
    widthPct: Math.max(2.5, Math.min(100 - leftPct, widthPct)),
    startMin: startAbs,
    endMin: endAbs,
    clippedStart,
    clippedEnd,
  }
}

/**
 * Première heure pile où poser un OT sur une ligne tech (évite de recouvrir un bloc).
 * Préfère 8 h ; si occupé, avance ; sinon reprend dès 7 h.
 */
export function premiereHeureLibre(opts: {
  occupied: Array<{ heure?: string; dureeMinutes?: number | null }>
  dureeMinutes?: number | null
  preferH?: number
}): number {
  const duree = dureeMinutesEffectif(opts.dureeMinutes)
  const ranges: { start: number; end: number }[] = []
  for (const o of opts.occupied) {
    const start = parseHeureToMinutes(o.heure)
    if (start == null) continue
    ranges.push({ start, end: start + dureeMinutesEffectif(o.dureeMinutes) })
  }
  const prefer = opts.preferH ?? 8
  const fits = (h: number) => {
    const start = h * 60
    const end = start + duree
    if (end > JOUR_PLANNING_FIN_H * 60) return false
    return !ranges.some((r) => start < r.end && end > r.start)
  }
  for (let h = prefer; h < JOUR_PLANNING_FIN_H; h++) {
    if (fits(h)) return h
  }
  for (let h = JOUR_PLANNING_DEBUT_H; h < prefer; h++) {
    if (fits(h)) return h
  }
  return prefer
}

/** Graduations horaires de la frise (7 … 18). */
export function heuresFriseJour(): number[] {
  const out: number[] = []
  for (let h = JOUR_PLANNING_DEBUT_H; h < JOUR_PLANNING_FIN_H; h++) out.push(h)
  return out
}

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
  'vacances',
  'conge',
  'rtt',
  'maladie',
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
  if (isIndispoType(type)) return 'Absent'
  if (type === 'hors_ot_libre' || type === 'rdv' || type === 'autre') return ''
  return AGENDA_TYPE_LABELS[type] || ''
}

/** OT pas encore calé à une heure — visible « sans planning ». */
export function otSansCreneau(ot: Pick<OrdreTravail, 'statut' | 'heure'>): boolean {
  if (isOtCloture(ot.statut)) return false
  return !(ot.heure || '').trim()
}

export function estPourTech(
  item: {
    technicienUserId?: string
    technicienUserIds?: string[]
    createdByUserId?: string
  },
  userId?: string | null,
): boolean {
  const uid = String(userId || '').trim()
  if (!uid) return false
  if (item.createdByUserId === uid) return true
  return techIdsOt(item).includes(uid)
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
  vacances: {
    key: 'vac',
    bg: 'bg-amber-50',
    border: 'border-amber-500',
    badge: 'bg-amber-700 text-white',
    text: 'text-amber-950',
    row: 'border-amber-400 bg-amber-50',
    dot: 'bg-amber-600',
  },
  conge: {
    key: 'conge',
    bg: 'bg-orange-50',
    border: 'border-orange-400',
    badge: 'bg-orange-700 text-white',
    text: 'text-orange-950',
    row: 'border-orange-300 bg-orange-50',
    dot: 'bg-orange-600',
  },
  rtt: {
    key: 'rtt',
    bg: 'bg-orange-50',
    border: 'border-orange-400',
    badge: 'bg-orange-700 text-white',
    text: 'text-orange-950',
    row: 'border-orange-300 bg-orange-50',
    dot: 'bg-orange-600',
  },
  maladie: {
    key: 'mal',
    bg: 'bg-rose-50',
    border: 'border-rose-400',
    badge: 'bg-rose-700 text-white',
    text: 'text-rose-950',
    row: 'border-rose-300 bg-rose-50',
    dot: 'bg-rose-600',
  },
}

/** Une couleur par métier terrain — CVC, frigo, plombier… */
export const COULEURS_METIER: Record<string, CouleurSecteur> = {
  tech_cvc: {
    key: 'cvc',
    bg: 'bg-sky-50',
    border: 'border-sky-400',
    badge: 'bg-sky-700 text-white',
    text: 'text-sky-950',
    row: 'border-sky-300 bg-sky-50',
    dot: 'bg-sky-600',
  },
  tech_frigoriste: {
    key: 'frigo',
    bg: 'bg-violet-50',
    border: 'border-violet-400',
    badge: 'bg-violet-700 text-white',
    text: 'text-violet-950',
    row: 'border-violet-300 bg-violet-50',
    dot: 'bg-violet-600',
  },
  tech_multitechnique: {
    key: 'multi',
    bg: 'bg-emerald-50',
    border: 'border-emerald-400',
    badge: 'bg-emerald-800 text-white',
    text: 'text-emerald-950',
    row: 'border-emerald-300 bg-emerald-50',
    dot: 'bg-emerald-600',
  },
  plombier: {
    key: 'plomb',
    bg: 'bg-amber-50',
    border: 'border-amber-400',
    badge: 'bg-amber-800 text-white',
    text: 'text-amber-950',
    row: 'border-amber-300 bg-amber-50',
    dot: 'bg-amber-500',
  },
  electricien: {
    key: 'elec',
    bg: 'bg-orange-50',
    border: 'border-orange-400',
    badge: 'bg-orange-700 text-white',
    text: 'text-orange-950',
    row: 'border-orange-300 bg-orange-50',
    dot: 'bg-orange-500',
  },
}

/** Couleurs stables par type d’activité OT (bande « à poser » + blocs frise). */
export const COULEURS_TYPE_OT: Record<string, CouleurSecteur> = {
  depanage: {
    key: 'ot-dep',
    bg: 'bg-sky-100',
    border: 'border-sky-500',
    badge: 'bg-sky-700 text-white',
    text: 'text-sky-950',
    row: 'border-sky-400 bg-sky-100',
    dot: 'bg-sky-600',
  },
  installation: {
    key: 'ot-inst',
    bg: 'bg-emerald-100',
    border: 'border-emerald-500',
    badge: 'bg-emerald-800 text-white',
    text: 'text-emerald-950',
    row: 'border-emerald-400 bg-emerald-100',
    dot: 'bg-emerald-600',
  },
  maintenance: {
    key: 'ot-maint',
    bg: 'bg-slate-100',
    border: 'border-slate-400',
    badge: 'bg-slate-600 text-white',
    text: 'text-slate-900',
    row: 'border-slate-300 bg-slate-100',
    dot: 'bg-slate-500',
  },
  entretien: {
    key: 'ot-entr',
    bg: 'bg-slate-100',
    border: 'border-slate-400',
    badge: 'bg-slate-600 text-white',
    text: 'text-slate-900',
    row: 'border-slate-300 bg-slate-100',
    dot: 'bg-slate-500',
  },
  controle_etancheite: {
    key: 'ot-ce',
    bg: 'bg-indigo-50',
    border: 'border-indigo-400',
    badge: 'bg-indigo-700 text-white',
    text: 'text-indigo-950',
    row: 'border-indigo-300 bg-indigo-50',
    dot: 'bg-indigo-600',
  },
  demantelement: {
    key: 'ot-dem',
    bg: 'bg-orange-50',
    border: 'border-orange-400',
    badge: 'bg-orange-700 text-white',
    text: 'text-orange-950',
    row: 'border-orange-300 bg-orange-50',
    dot: 'bg-orange-500',
  },
  devis: {
    key: 'ot-devis',
    bg: 'bg-teal-50',
    border: 'border-teal-400',
    badge: 'bg-teal-700 text-white',
    text: 'text-teal-950',
    row: 'border-teal-300 bg-teal-50',
    dot: 'bg-teal-600',
  },
}

export function couleurTypeOt(typeOt?: string | null): CouleurSecteur | undefined {
  const t = String(typeOt || '').trim()
  if (!t) return undefined
  return COULEURS_TYPE_OT[t]
}

export function couleurMetier(secteur?: string | null): CouleurSecteur | undefined {
  const id = parsePostePersonnel(secteur)
  if (!id) return undefined
  return COULEURS_METIER[id]
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
  /** Couleur d’activité OT (dépannage / install / maintenance…). Prioritaire sur le métier. */
  typeOt?: string | null
  secteur?: string | null
  technicienUserId?: string
}): CouleurSecteur {
  if (opts.horsOtType && isHorsOtType(opts.horsOtType)) {
    return COULEURS_HORS_OT[opts.horsOtType] || COULEUR_NON_AFFECTE
  }
  const byType = couleurTypeOt(opts.typeOt)
  if (byType) return byType
  const metier = couleurMetier(opts.secteur)
  if (metier) return metier
  return couleurSecteurTech(opts.technicienUserId)
}

export function dateDansSemaine(iso: string | undefined, weekDates: string[]): boolean {
  const d = (iso || '').slice(0, 10)
  if (!d) return true
  return weekDates.includes(d)
}

/** Lignes du jour : techs terrain (même vides). Filtre région = strict. */
export function techsLignesJour(opts: {
  team: { id: string; role?: string }[]
  posteOf: (id: string) => string | undefined
  taskTechIds: string[]
  filterTechId?: string | null
  filterSecteur?: string | null
  /**
   * Si renseigné : uniquement les techs de ces agences.
   * Pas de « renfort » d’une autre région (filtre strict).
   */
  filterAgenceCodes?: string[]
  agenceOf?: (id: string) => string | undefined
}): string[] {
  const order = new Map(opts.team.map((t, i) => [t.id, i]))
  const always: string[] = []
  const agences = (opts.filterAgenceCodes || []).filter(Boolean)
  for (const t of opts.team) {
    const poste = opts.posteOf(t.id)
    const isTerrain =
      isPosteTerrain(poste) || (!poste && t.role === 'operateur' && !isPosteBureau(poste))
    if (!isTerrain) continue
    if (agences.length) {
      const ag = opts.agenceOf?.(t.id)
      // Strict : pas d’agence ou mauvaise région → hors liste
      if (!ag || !agences.includes(ag)) continue
    }
    always.push(t.id)
  }
  // Sans filtre région : garder aussi les techs hors liste « always » qui ont une tâche
  const extra = agences.length
    ? []
    : (opts.taskTechIds || []).filter((id) => id && !always.includes(id))
  let ids = [...always, ...extra]
  const tech = String(opts.filterTechId || '').trim()
  if (tech && tech !== 'tous') ids = ids.filter((id) => id === tech)
  const secteur = parsePostePersonnel(opts.filterSecteur)
  if (secteur) ids = ids.filter((id) => opts.posteOf(id) === secteur)
  const seen = new Set<string>()
  const out: string[] = []
  for (const id of ids) {
    if (!id || seen.has(id)) continue
    seen.add(id)
    out.push(id)
  }
  return out.sort((a, b) => (order.get(a) ?? 99) - (order.get(b) ?? 99))
}

export function visibleAgendaPour(
  opts: {
    bureau: boolean
    userId?: string | null
    filterTechId?: string | null
  },
  item: {
    technicienUserId?: string
    technicienUserIds?: string[]
    createdByUserId?: string
  },
): boolean {
  if (opts.bureau) {
    const f = String(opts.filterTechId || '').trim()
    if (!f || f === 'tous') return true
    return estPourTech(item, f)
  }
  return estPourTech(item, opts.userId)
}

export function eventAgendaPourTech(e: AgendaEvent, userId?: string | null): boolean {
  return estPourTech(e, userId)
}

/** Absences qui bloquent la pose d’OT pour ce tech à cette date. */
export function indisposTechSurDate(
  events: AgendaEvent[] | undefined,
  techUserId: string,
  dateIso: string,
): AgendaEvent[] {
  const uid = String(techUserId || '').trim()
  const d = String(dateIso || '').slice(0, 10)
  if (!uid || !d) return []
  return (events || []).filter((e) => {
    if (!isIndispoType(e.type)) return false
    if (e.statut === 'annule') return false
    if (String(e.technicienUserId || '').trim() !== uid) return false
    return agendaCouvreDate(e, d)
  })
}

export function techEstIndispo(
  events: AgendaEvent[] | undefined,
  techUserId: string,
  dateIso: string,
): boolean {
  return indisposTechSurDate(events, techUserId, dateIso).length > 0
}

export function labelIndispoCourte(e: Pick<AgendaEvent, 'type' | 'title'>): string {
  if (e.title?.trim()) return e.title.trim()
  return AGENDA_TYPE_LABELS[e.type as AgendaEventType] || 'Indisponible'
}

/**
 * Premier tech bloqué (absence : vacances, RTT, maladie…) pour une date OT.
 * Retourne null si tous sont dispo ou si date / techs vides.
 */
export function premierTechIndispo(
  events: AgendaEvent[] | undefined,
  techUserIds: string[],
  dateIso: string,
): { techId: string; absence: AgendaEvent } | null {
  const d = String(dateIso || '').slice(0, 10)
  if (!d) return null
  for (const tid of techUserIds) {
    const abs = indisposTechSurDate(events, tid, d)[0]
    if (abs) return { techId: tid, absence: abs }
  }
  return null
}
