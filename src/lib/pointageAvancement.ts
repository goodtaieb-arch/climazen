/**
 * Avancement réel des techs vs planning bureau (agenda / OT horodatés).
 */

import {
  dureeMinutesEffectif,
  dureeMinutesOt,
  JOUR_PLANNING_DEBUT_H,
  JOUR_PLANNING_FIN_H,
  JOUR_PLANNING_SPAN_MIN,
  parseHeureToMinutes,
} from './agendaPlanning'
import { isOtCloture, techIdsOt, type OrdreTravail } from './ordreTravail'
import {
  calculerJournee,
  eventsDuJour,
  formatMinutesHhMm,
  normaliserAction,
  POINTAGE_ACTION_LABELS,
  type JourneePointage,
  type PointageEvent,
  type PointageRegles,
} from './pointage'

export type StatutLiveOt =
  | 'planifie'
  | 'en_deplacement'
  | 'en_cours'
  | 'termine'
  | 'en_retard'

export const STATUT_LIVE_OT_LABELS: Record<StatutLiveOt, string> = {
  planifie: 'Planifié',
  en_deplacement: 'En déplacement',
  en_cours: 'En cours',
  termine: 'Terminé',
  en_retard: 'En retard',
}

export const STATUT_LIVE_OT_CLASS: Record<StatutLiveOt, string> = {
  planifie: 'bg-slate-200 text-slate-800',
  en_deplacement: 'bg-violet-200 text-violet-950',
  en_cours: 'bg-emerald-200 text-emerald-950',
  termine: 'bg-sky-200 text-sky-950',
  en_retard: 'bg-amber-200 text-amber-950',
}

export type BlocPlanifie = {
  otId: string
  heure?: string
  dureeMinutes?: number
  title?: string
  numero?: string
}

export function isoToMinutesLocal(iso?: string): number | null {
  if (!iso) return null
  const d = new Date(iso)
  if (!Number.isFinite(d.getTime())) return null
  return d.getHours() * 60 + d.getMinutes()
}

/** Position % du « maintenant » sur la frise 7h–19h. Null si autre jour. */
export function nowMarkerPct(date: string, now?: Date): number | null {
  const n = now || new Date()
  const y = n.getFullYear()
  const m = String(n.getMonth() + 1).padStart(2, '0')
  const d = String(n.getDate()).padStart(2, '0')
  if (date.slice(0, 10) !== `${y}-${m}-${d}`) return null
  const min = n.getHours() * 60 + n.getMinutes()
  const start = JOUR_PLANNING_DEBUT_H * 60
  const span = JOUR_PLANNING_SPAN_MIN
  if (min <= start) return 0
  if (min >= JOUR_PLANNING_FIN_H * 60) return 100
  return ((min - start) / span) * 100
}

export function blocsPlanifiesDuTech(
  ots: Pick<
    OrdreTravail,
    | 'id'
    | 'date'
    | 'heure'
    | 'dureeMinutes'
    | 'visiteNiveau'
    | 'technicienUserId'
    | 'technicienUserIds'
    | 'statut'
    | 'action'
    | 'numero'
  >[],
  opts: { userId: string; date: string },
): BlocPlanifie[] {
  const date = opts.date.slice(0, 10)
  return ots
    .filter((o) => (o.date || '').slice(0, 10) === date)
    .filter((o) => !isOtCloture(o.statut))
    .filter((o) => techIdsOt(o).includes(opts.userId))
    .filter((o) => Boolean((o.heure || '').trim()))
    .map((o) => ({
      otId: o.id,
      heure: o.heure,
      dureeMinutes: dureeMinutesOt(o),
      title: o.action,
      numero: o.numero,
    }))
}

export function planifieMinutes(blocs: BlocPlanifie[]): number {
  return blocs.reduce((s, b) => s + dureeMinutesEffectif(b.dureeMinutes), 0)
}

function lastEventPourOt(
  events: PointageEvent[],
  opts: { userId: string; date: string; otId: string },
): PointageEvent | undefined {
  const list = eventsDuJour(events, { userId: opts.userId, date: opts.date }).filter(
    (e) => e.otId === opts.otId,
  )
  return list[list.length - 1]
}

export type LiveOtInfo = {
  statut: StatutLiveOt
  label: string
  pctRempli: number
}

export function statutLiveOtPourTech(opts: {
  otId: string
  otStatut?: string
  heure?: string
  dureeMinutes?: number
  events: PointageEvent[]
  userId: string
  date: string
  now?: Date | string
  journee?: JourneePointage
}): LiveOtInfo {
  const nowDate =
    typeof opts.now === 'string' ? new Date(opts.now) : opts.now || new Date()
  const last = lastEventPourOt(opts.events, {
    userId: opts.userId,
    date: opts.date,
    otId: opts.otId,
  })
  const planned = dureeMinutesEffectif(opts.dureeMinutes)
  const interMin = (opts.journee?.segments || [])
    .filter((s) => s.kind === 'intervention' && s.otId === opts.otId)
    .reduce((s, x) => s + x.minutes, 0)
  const pctRempli = planned > 0 ? Math.max(0, Math.min(100, Math.round((interMin / planned) * 100))) : 0

  if (last) {
    const n = normaliserAction(last.action)
    if (n === 'deplacement' && (last.cible || 'ot') === 'ot') {
      return { statut: 'en_deplacement', label: STATUT_LIVE_OT_LABELS.en_deplacement, pctRempli }
    }
    if (n === 'intervention_en_cours') {
      return { statut: 'en_cours', label: STATUT_LIVE_OT_LABELS.en_cours, pctRempli }
    }
    if (n === 'fin_intervention') {
      return {
        statut: 'termine',
        label: STATUT_LIVE_OT_LABELS.termine,
        pctRempli: Math.max(pctRempli, 100),
      }
    }
  }

  if (opts.otStatut === 'en_deplacement') {
    return { statut: 'en_deplacement', label: STATUT_LIVE_OT_LABELS.en_deplacement, pctRempli }
  }
  if (opts.otStatut === 'en_cours' && last) {
    return { statut: 'en_cours', label: STATUT_LIVE_OT_LABELS.en_cours, pctRempli }
  }

  const startMin = parseHeureToMinutes(opts.heure)
  const todayIso = `${nowDate.getFullYear()}-${String(nowDate.getMonth() + 1).padStart(2, '0')}-${String(nowDate.getDate()).padStart(2, '0')}`
  if (
    opts.date.slice(0, 10) === todayIso &&
    startMin != null &&
    nowDate.getHours() * 60 + nowDate.getMinutes() > startMin + 10
  ) {
    return { statut: 'en_retard', label: STATUT_LIVE_OT_LABELS.en_retard, pctRempli: 0 }
  }

  return { statut: 'planifie', label: STATUT_LIVE_OT_LABELS.planifie, pctRempli: 0 }
}

export type TechAvancementJour = {
  userId: string
  planifieMin: number
  interventionMin: number
  deplacementMin: number
  porteAPorteMin: number
  pctOtFait: number
  statutLabel: string
  enRetard: boolean
  lastAction?: string
  ouvert: boolean
}

export function avancementTechVsPlanning(opts: {
  userId: string
  date: string
  events: PointageEvent[]
  blocs: BlocPlanifie[]
  regles?: PointageRegles | null
  now?: string
  journee?: JourneePointage
}): TechAvancementJour {
  const journee =
    opts.journee ||
    calculerJournee({
      events: opts.events,
      userId: opts.userId,
      date: opts.date,
      regles: opts.regles,
      now: opts.now,
    })
  const planifieMin = planifieMinutes(opts.blocs)
  const pctOtFait =
    planifieMin > 0
      ? Math.max(0, Math.min(200, Math.round((journee.interventionMin / planifieMin) * 100)))
      : journee.interventionMin > 0
        ? 100
        : 0
  const lastLabel = journee.lastAction
    ? POINTAGE_ACTION_LABELS[journee.lastAction]
    : planifieMin > 0
      ? 'Pas encore pointé'
      : 'Libre'
  const now = opts.now ? new Date(opts.now) : new Date()
  const firstStart = opts.blocs
    .map((b) => parseHeureToMinutes(b.heure))
    .filter((n): n is number => n != null)
    .sort((a, b) => a - b)[0]
  const todayIso = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
  const enRetard =
    opts.date.slice(0, 10) === todayIso &&
    firstStart != null &&
    now.getHours() * 60 + now.getMinutes() > firstStart + 10 &&
    !journee.lastAction

  return {
    userId: opts.userId,
    planifieMin,
    interventionMin: journee.interventionMin,
    deplacementMin: journee.deplacementMin,
    porteAPorteMin: journee.porteAPorteMin,
    pctOtFait,
    statutLabel: enRetard ? STATUT_LIVE_OT_LABELS.en_retard : lastLabel,
    enRetard,
    lastAction: journee.lastAction,
    ouvert: journee.ouvert,
  }
}

export function labelAvancementTech(av: TechAvancementJour): string {
  if (av.planifieMin <= 0 && av.porteAPorteMin <= 0) return 'Libre'
  const plan = av.planifieMin > 0 ? `Plan ${formatMinutesHhMm(av.planifieMin)}` : ''
  const reel =
    av.porteAPorteMin > 0
      ? `Réel ${formatMinutesHhMm(av.porteAPorteMin)}`
      : av.interventionMin > 0
        ? `OT ${formatMinutesHhMm(av.interventionMin)}`
        : ''
  const bits = [reel, plan].filter(Boolean)
  if (av.planifieMin > 0) bits.push(`${av.pctOtFait} %`)
  return bits.join(' · ') || 'Libre'
}
