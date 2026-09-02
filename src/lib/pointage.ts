/**
 * Pointeuse légale — horodatage + GPS ponctuel, enchaînement lié à l’OT.
 * Le tech ne saisit pas les heures : une action ferme la précédente et ouvre la suivante.
 */

import { todayIsoLocal } from './agenda'

/** Actions métier (2026+) — liées à l’OT quand pertinent. */
export const POINTAGE_ACTIONS = [
  'deplacement',
  'intervention_en_cours',
  'fin_intervention',
  'fournisseur',
  'bureau',
  'pause',
  'fin_journee',
] as const

/** Anciennes actions — toujours lues pour l’historique. */
export const LEGACY_POINTAGE_ACTIONS = [
  'prise_vehicule',
  'trajet',
  'arrivee_chantier',
  'retour',
] as const

export type PointageActionCanon = (typeof POINTAGE_ACTIONS)[number]
export type PointageActionLegacy = (typeof LEGACY_POINTAGE_ACTIONS)[number]
export type PointageAction = PointageActionCanon | PointageActionLegacy

export type PointageCible = 'ot' | 'fournisseur' | 'bureau'

export const POINTAGE_ACTION_LABELS: Record<PointageAction, string> = {
  deplacement: 'Déplacement en cours',
  intervention_en_cours: 'Intervention en cours',
  fin_intervention: 'Fin d’intervention',
  fournisseur: 'Fournisseur',
  bureau: 'Bureau',
  pause: 'Pause',
  fin_journee: 'Fin de journée',
  prise_vehicule: 'Prise du véhicule',
  trajet: 'Trajet',
  arrivee_chantier: 'Arrivée chantier / OT',
  retour: 'Retour',
}

export const POINTAGE_ACTION_HINTS: Record<PointageActionCanon, string> = {
  deplacement: 'En route vers l’OT, le fournisseur ou le bureau',
  intervention_en_cours: 'Sur le site — OT en cours',
  fin_intervention: 'Intervention terminée sur cet OT',
  fournisseur: 'Chez le fournisseur (pièces, gaz…)',
  bureau: 'Au bureau / atelier',
  pause: 'Pause repas ou personnelle',
  fin_journee: 'Fin de tournée — les heures sont calculées',
}

export type PointageSegmentKind =
  | 'deplacement'
  | 'intervention'
  | 'fournisseur'
  | 'bureau'
  | 'pause'

export const POINTAGE_SEGMENT_LABELS: Record<PointageSegmentKind, string> = {
  deplacement: 'Déplacement',
  intervention: 'Intervention (OT)',
  fournisseur: 'Fournisseur',
  bureau: 'Bureau',
  pause: 'Pause',
}

export const POINTAGE_CNIL_NOTICE =
  'Horodatage et position uniquement au moment du pointage. Aucun suivi GPS continu. Temps calculé automatiquement entre chaque action, rattaché à l’OT quand applicable.'

export type PointageGeo = {
  lat: number
  lng: number
  accuracyM?: number
  capturedAt: string
}

export type PointageEvent = {
  id: string
  userId: string
  userName: string
  action: PointageAction
  at: string
  date: string
  geo?: PointageGeo
  geoRefused?: boolean
  geoError?: string
  /** OT concerné (obligatoire déplacement → site, intervention, fin). */
  otId?: string
  chantierId?: string
  /** Vers quoi part le déplacement (OT, fournisseur, bureau). */
  cible?: PointageCible
  voitureId?: string
  note?: string
  annule?: boolean
  annuleMotif?: string
  createdAt: string
}

export type PointageRegles = {
  active: boolean
  heuresJour: number
  heuresSemaine: number
  pauseNonPayee: boolean
  arrondiMinutes: number
  geoObligatoire: boolean
  cnilAcceptee: boolean
  debutJournee: string
  finJournee: string
  pauseAutoMinutes: number
  notePaie?: string
  configuredAt?: string
  configuredByUserId?: string
  updatedAt?: string
}

const ALL_ACTIONS = new Set<string>([...POINTAGE_ACTIONS, ...LEGACY_POINTAGE_ACTIONS])

export function blankPointageRegles(): PointageRegles {
  return {
    active: false,
    heuresJour: 7,
    heuresSemaine: 35,
    pauseNonPayee: true,
    arrondiMinutes: 0,
    geoObligatoire: true,
    cnilAcceptee: false,
    debutJournee: '08:00',
    finJournee: '17:00',
    pauseAutoMinutes: 0,
  }
}

export function parsePointageAction(raw: unknown): PointageAction | undefined {
  const v = String(raw || '').trim()
  return ALL_ACTIONS.has(v) ? (v as PointageAction) : undefined
}

/** Normalise anciennes actions pour calcul & enchaînement. */
export function normaliserAction(action: PointageAction): PointageActionCanon | 'fin_intervention' {
  switch (action) {
    case 'trajet':
    case 'prise_vehicule':
      return 'deplacement'
    case 'arrivee_chantier':
      return 'intervention_en_cours'
    case 'retour':
      return 'fin_journee'
    case 'fin_intervention':
      return 'fin_intervention'
    default:
      return action as PointageActionCanon
  }
}

/** Actions qui démarrent un créneau horodaté (jusqu’à l’action suivante). */
export function actionDemarreSegment(action: PointageAction): boolean {
  const n = normaliserAction(action)
  return n !== 'fin_intervention' && n !== 'fin_journee'
}

export function otIdObligatoire(action: PointageAction, cible?: PointageCible): boolean {
  const n = normaliserAction(action)
  if (n === 'intervention_en_cours' || n === 'fin_intervention') return true
  if (n === 'deplacement') return (cible || 'ot') === 'ot'
  return false
}

function parseHeureHm(raw: unknown, fallback: string): string {
  const v = String(raw || '').trim()
  if (/^\d{1,2}:\d{2}$/.test(v)) {
    const [h, m] = v.split(':').map(Number)
    if (h >= 0 && h <= 23 && m >= 0 && m <= 59) {
      return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
    }
  }
  return fallback
}

function clampInt(raw: unknown, min: number, max: number, fallback: number): number {
  const n = Math.round(Number(raw))
  if (!Number.isFinite(n)) return fallback
  return Math.min(max, Math.max(min, n))
}

function clampHours(raw: unknown, min: number, max: number, fallback: number): number {
  const n = Number(raw)
  if (!Number.isFinite(n)) return fallback
  return Math.min(max, Math.max(min, Math.round(n * 2) / 2))
}

export function parsePointageRegles(raw: unknown): PointageRegles {
  const base = blankPointageRegles()
  if (!raw || typeof raw !== 'object') return base
  const r = raw as Partial<PointageRegles>
  return {
    active: r.active === true,
    heuresJour: clampHours(r.heuresJour, 1, 16, base.heuresJour),
    heuresSemaine: clampHours(r.heuresSemaine, 1, 60, base.heuresSemaine),
    pauseNonPayee: r.pauseNonPayee !== false,
    arrondiMinutes: [0, 5, 10, 15].includes(Number(r.arrondiMinutes))
      ? Number(r.arrondiMinutes)
      : 0,
    geoObligatoire: r.geoObligatoire !== false,
    cnilAcceptee: r.cnilAcceptee === true,
    debutJournee: parseHeureHm(r.debutJournee, base.debutJournee),
    finJournee: parseHeureHm(r.finJournee, base.finJournee),
    pauseAutoMinutes: clampInt(r.pauseAutoMinutes, 0, 180, 0),
    notePaie: String(r.notePaie || '').trim() || undefined,
    configuredAt: r.configuredAt,
    configuredByUserId: r.configuredByUserId,
    updatedAt: r.updatedAt,
  }
}

function parseCible(raw: unknown): PointageCible | undefined {
  const v = String(raw || '').trim()
  return v === 'ot' || v === 'fournisseur' || v === 'bureau' ? v : undefined
}

export function parsePointageEvents(raw: unknown): PointageEvent[] {
  if (!Array.isArray(raw)) return []
  const out: PointageEvent[] = []
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue
    const e = item as Partial<PointageEvent>
    const action = parsePointageAction(e.action)
    const id = String(e.id || '').trim()
    const userId = String(e.userId || '').trim()
    const at = String(e.at || '').trim()
    if (!action || !id || !userId || !at) continue
    const geo =
      e.geo && typeof e.geo.lat === 'number' && typeof e.geo.lng === 'number'
        ? {
            lat: e.geo.lat,
            lng: e.geo.lng,
            accuracyM:
              typeof e.geo.accuracyM === 'number' ? e.geo.accuracyM : undefined,
            capturedAt: e.geo.capturedAt || at,
          }
        : undefined
    out.push({
      id,
      userId,
      userName: String(e.userName || '').trim() || 'Technicien',
      action,
      at,
      date: (e.date || at).slice(0, 10),
      geo,
      geoRefused: e.geoRefused === true,
      geoError: e.geoError ? String(e.geoError) : undefined,
      otId: e.otId ? String(e.otId) : undefined,
      chantierId: e.chantierId ? String(e.chantierId) : undefined,
      cible: parseCible(e.cible),
      voitureId: e.voitureId ? String(e.voitureId) : undefined,
      note: e.note ? String(e.note) : undefined,
      annule: e.annule === true,
      annuleMotif: e.annuleMotif ? String(e.annuleMotif) : undefined,
      createdAt: e.createdAt || at,
    })
  }
  return out
}

export function motifsReglesIncompletes(regles?: PointageRegles | null): string[] {
  const r = parsePointageRegles(regles)
  const missing: string[] = []
  if (!(r.heuresJour > 0)) missing.push('Heures / jour')
  if (!(r.heuresSemaine > 0)) missing.push('Heures / semaine')
  if (!r.debutJournee) missing.push('Début de journée théorique')
  if (!r.finJournee) missing.push('Fin de journée théorique')
  if (!r.cnilAcceptee) missing.push('Acceptation information CNIL')
  return missing
}

export function pointageReglesCompletes(regles?: PointageRegles | null): boolean {
  return motifsReglesIncompletes(regles).length === 0
}

export function peutActiverPointage(regles?: PointageRegles | null): boolean {
  return pointageReglesCompletes(regles)
}

export function pointageEstActif(regles?: PointageRegles | null): boolean {
  const r = parsePointageRegles(regles)
  return r.active === true && pointageReglesCompletes(r)
}

export function preparerActivation(
  regles: PointageRegles,
  opts: { userId?: string; now?: string },
): { ok: true; regles: PointageRegles } | { ok: false; erreurs: string[] } {
  const next = parsePointageRegles(regles)
  const erreurs = motifsReglesIncompletes(next)
  if (erreurs.length) return { ok: false, erreurs }
  const now = opts.now || new Date().toISOString()
  return {
    ok: true,
    regles: {
      ...next,
      active: true,
      configuredAt: next.configuredAt || now,
      configuredByUserId: next.configuredByUserId || opts.userId,
      updatedAt: now,
    },
  }
}

export function mergePointageRegles(
  a?: PointageRegles | null,
  b?: PointageRegles | null,
): PointageRegles {
  const pa = a ? parsePointageRegles(a) : undefined
  const pb = b ? parsePointageRegles(b) : undefined
  if (!pa) return pb || blankPointageRegles()
  if (!pb) return pa
  const da = pa.updatedAt || pa.configuredAt || ''
  const db = pb.updatedAt || pb.configuredAt || ''
  return da >= db ? pa : pb
}

export function eventsActifs(events: PointageEvent[]): PointageEvent[] {
  return events.filter((e) => !e.annule)
}

export function eventsDuJour(
  events: PointageEvent[],
  opts: { userId?: string; date: string },
): PointageEvent[] {
  const date = opts.date.slice(0, 10)
  return eventsActifs(events)
    .filter((e) => e.date === date && (!opts.userId || e.userId === opts.userId))
    .sort((a, b) => a.at.localeCompare(b.at))
}

export function dernierPointage(
  events: PointageEvent[],
  opts: { userId: string; date: string },
): PointageEvent | undefined {
  const list = eventsDuJour(events, opts)
  return list[list.length - 1]
}

function dernierEtat(last?: PointageEvent): PointageActionCanon | 'fin_intervention' | undefined {
  if (!last) return undefined
  return normaliserAction(last.action)
}

export function actionsSuivantes(last?: PointageEvent): PointageActionCanon[] {
  const etat = dernierEtat(last)
  if (!etat || etat === 'fin_journee') {
    return ['deplacement']
  }
  if (etat === 'deplacement') {
    return ['intervention_en_cours', 'fournisseur', 'bureau']
  }
  if (etat === 'intervention_en_cours') {
    return ['fin_intervention', 'pause']
  }
  if (etat === 'fin_intervention') {
    return ['deplacement', 'fournisseur', 'bureau', 'fin_journee', 'pause']
  }
  if (etat === 'fournisseur') {
    return ['deplacement', 'bureau', 'fin_journee', 'pause']
  }
  if (etat === 'bureau') {
    return ['deplacement', 'fin_journee', 'pause']
  }
  if (etat === 'pause') {
    return ['deplacement', 'intervention_en_cours', 'fournisseur', 'bureau', 'fin_journee']
  }
  return ['deplacement']
}

export function actionAutorisee(last: PointageEvent | undefined, next: PointageAction): boolean {
  const canon = normaliserAction(next)
  if (canon === 'fin_intervention' && next === 'fin_intervention') {
    return dernierEtat(last) === 'intervention_en_cours'
  }
  return actionsSuivantes(last).includes(canon as PointageActionCanon)
}

export function segmentDepuisAction(action: PointageAction): PointageSegmentKind | null {
  const n = normaliserAction(action)
  if (n === 'fin_intervention' || n === 'fin_journee') return null
  if (n === 'deplacement') return 'deplacement'
  if (n === 'intervention_en_cours') return 'intervention'
  if (n === 'fournisseur') return 'fournisseur'
  if (n === 'bureau') return 'bureau'
  if (n === 'pause') return 'pause'
  return null
}

/** Index de fin de créneau pour l’événement i (heure de fin exclusive). */
function finCreaneau(list: PointageEvent[], i: number, ouvert: boolean, now: string): string {
  const cur = list[i]
  const curNorm = normaliserAction(cur.action)
  for (let j = i + 1; j < list.length; j++) {
    const next = list[j]
    const nextNorm = normaliserAction(next.action)
    if (nextNorm === 'fin_intervention' && curNorm === 'intervention_en_cours') {
      return next.at
    }
    if (nextNorm !== 'fin_intervention') {
      return next.at
    }
  }
  if (ouvert && i === list.length - 1) return now
  return ''
}

export function arrondirDate(date: Date, arrondiMinutes: number): Date {
  const step = Number(arrondiMinutes) || 0
  if (step <= 0) return new Date(date.getTime())
  const ms = date.getTime()
  const stepMs = step * 60_000
  return new Date(Math.round(ms / stepMs) * stepMs)
}

export function minutesEntre(fromIso: string, toIso: string): number {
  const a = new Date(fromIso).getTime()
  const b = new Date(toIso).getTime()
  if (!Number.isFinite(a) || !Number.isFinite(b) || b <= a) return 0
  return Math.round((b - a) / 60_000)
}

export function formatMinutesHhMm(min: number): string {
  const n = Math.max(0, Math.round(min))
  const h = Math.floor(n / 60)
  const m = n % 60
  return `${h}h${String(m).padStart(2, '0')}`
}

export type PointageSegment = {
  kind: PointageSegmentKind
  from: string
  to: string
  minutes: number
  otId?: string
  chantierId?: string
  cible?: PointageCible
}

export type JourneePointage = {
  date: string
  userId: string
  userName: string
  deplacementMin: number
  interventionMin: number
  fournisseurMin: number
  bureauMin: number
  pauseMin: number
  /** @deprecated compat export — = deplacementMin */
  trajetMin: number
  /** @deprecated compat export — = interventionMin */
  chantierMin: number
  vehiculeMin: number
  retourMin: number
  pauseAutoMin: number
  payeMin: number
  heuresJour: number
  heuresSupMin: number
  ouvert: boolean
  lastAction?: PointageAction
  otIdCourant?: string
  segments: PointageSegment[]
}

function addSegmentKind(
  acc: Pick<
    JourneePointage,
    'deplacementMin' | 'interventionMin' | 'fournisseurMin' | 'bureauMin' | 'pauseMin'
  >,
  kind: PointageSegmentKind,
  minutes: number,
) {
  if (kind === 'deplacement') acc.deplacementMin += minutes
  else if (kind === 'intervention') acc.interventionMin += minutes
  else if (kind === 'fournisseur') acc.fournisseurMin += minutes
  else if (kind === 'bureau') acc.bureauMin += minutes
  else acc.pauseMin += minutes
}

export function calculerJournee(opts: {
  events: PointageEvent[]
  userId: string
  date: string
  regles?: PointageRegles | null
  now?: string
}): JourneePointage {
  const r = parsePointageRegles(opts.regles)
  const list = eventsDuJour(opts.events, { userId: opts.userId, date: opts.date })
  const now = opts.now || new Date().toISOString()
  const totals = {
    deplacementMin: 0,
    interventionMin: 0,
    fournisseurMin: 0,
    bureauMin: 0,
    pauseMin: 0,
  }
  const segments: PointageSegment[] = []
  const last = list[list.length - 1]
  const lastNorm = last ? normaliserAction(last.action) : undefined
  const ouvert = Boolean(last && lastNorm !== 'fin_journee')

  for (let i = 0; i < list.length; i++) {
    const cur = list[i]
    const kind = segmentDepuisAction(cur.action)
    if (!kind) continue
    const nextAt = finCreaneau(list, i, ouvert, now)
    if (!nextAt) continue
    const minutes = minutesEntre(cur.at, nextAt)
    if (minutes <= 0) continue
    addSegmentKind(totals, kind, minutes)
    segments.push({
      kind,
      from: cur.at,
      to: nextAt,
      minutes,
      otId: cur.otId,
      chantierId: cur.chantierId,
      cible: cur.cible,
    })
  }

  let pauseAutoMin = 0
  if (
    r.pauseAutoMinutes > 0 &&
    totals.pauseMin === 0 &&
    (totals.interventionMin > 0 || !ouvert)
  ) {
    pauseAutoMin = r.pauseAutoMinutes
  }

  const brut =
    totals.deplacementMin +
    totals.interventionMin +
    totals.fournisseurMin +
    totals.bureauMin +
    totals.pauseMin
  const payeMin = Math.max(0, brut - (r.pauseNonPayee ? totals.pauseMin : 0) - pauseAutoMin)
  const quota = Math.round(r.heuresJour * 60)

  const otIdCourant =
    last?.otId ||
    [...list].reverse().find((e) => e.otId && normaliserAction(e.action) !== 'fin_journee')?.otId

  return {
    date: opts.date,
    userId: opts.userId,
    userName: last?.userName || list[0]?.userName || '',
    ...totals,
    trajetMin: totals.deplacementMin,
    chantierMin: totals.interventionMin,
    vehiculeMin: 0,
    retourMin: 0,
    pauseAutoMin,
    payeMin,
    heuresJour: r.heuresJour,
    heuresSupMin: Math.max(0, payeMin - quota),
    ouvert,
    lastAction: last?.action,
    otIdCourant,
    segments,
  }
}

export function lundiIso(date: string): string {
  const d = new Date(`${date.slice(0, 10)}T12:00:00`)
  const day = d.getDay()
  const diff = day === 0 ? -6 : 1 - day
  d.setDate(d.getDate() + diff)
  return d.toISOString().slice(0, 10)
}

export function datesSemaine(date: string): string[] {
  const start = lundiIso(date)
  const out: string[] = []
  const d = new Date(`${start}T12:00:00`)
  for (let i = 0; i < 7; i++) {
    const x = new Date(d)
    x.setDate(d.getDate() + i)
    out.push(x.toISOString().slice(0, 10))
  }
  return out
}

export function calculerSemaine(opts: {
  events: PointageEvent[]
  userId: string
  date: string
  regles?: PointageRegles | null
  now?: string
}): { jours: JourneePointage[]; payeMin: number; heuresSupMin: number; quotaMin: number } {
  const r = parsePointageRegles(opts.regles)
  const jours = datesSemaine(opts.date).map((day) =>
    calculerJournee({
      events: opts.events,
      userId: opts.userId,
      date: day,
      regles: r,
      now: opts.now,
    }),
  )
  const payeMin = jours.reduce((s, j) => s + j.payeMin, 0)
  const quotaMin = Math.round(r.heuresSemaine * 60)
  return {
    jours,
    payeMin,
    quotaMin,
    heuresSupMin: Math.max(0, payeMin - quotaMin),
  }
}

export function csvEscape(v: unknown): string {
  const s = String(v ?? '')
  if (/[;"\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`
  return s
}

export function exportJourneesCsv(jours: JourneePointage[]): string {
  const header = [
    'Date',
    'Technicien',
    'Déplacement (min)',
    'Intervention OT (min)',
    'Fournisseur (min)',
    'Bureau (min)',
    'Pause (min)',
    'Pause auto (min)',
    'Temps payé (min)',
    'Temps payé',
    'Heures sup (min)',
    'Journée ouverte',
    'OT en cours',
  ]
  const lines = [header.join(';')]
  for (const j of jours) {
    lines.push(
      [
        j.date,
        csvEscape(j.userName),
        j.deplacementMin,
        j.interventionMin,
        j.fournisseurMin,
        j.bureauMin,
        j.pauseMin,
        j.pauseAutoMin,
        j.payeMin,
        formatMinutesHhMm(j.payeMin),
        j.heuresSupMin,
        j.ouvert ? 'oui' : 'non',
        j.otIdCourant || '',
      ].join(';'),
    )
  }
  return `${lines.join('\n')}\n`
}

export function exportEvenementsCsv(events: PointageEvent[]): string {
  const header = [
    'Date',
    'Heure',
    'Technicien',
    'Action',
    'OT',
    'Cible',
    'Latitude',
    'Longitude',
    'Précision (m)',
    'GPS refusé',
    'Note',
    'Annulé',
  ]
  const lines = [header.join(';')]
  for (const e of eventsActifs(events)
    .concat(events.filter((x) => x.annule))
    .sort((a, b) => a.at.localeCompare(b.at))) {
    const hm = e.at.includes('T') ? e.at.slice(11, 16) : ''
    lines.push(
      [
        e.date,
        hm,
        csvEscape(e.userName),
        POINTAGE_ACTION_LABELS[e.action],
        e.otId || '',
        e.cible || '',
        e.geo?.lat ?? '',
        e.geo?.lng ?? '',
        e.geo?.accuracyM ?? '',
        e.geoRefused ? 'oui' : 'non',
        csvEscape(e.note || ''),
        e.annule ? csvEscape(e.annuleMotif || 'oui') : '',
      ].join(';'),
    )
  }
  return `${lines.join('\n')}\n`
}

export function telechargerCsv(filename: string, csv: string) {
  if (typeof document === 'undefined') return
  const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export type GeoPonctuelResult =
  | { ok: true; geo: PointageGeo }
  | { ok: false; refused: boolean; message: string }

export function capturerGeoPonctuel(): Promise<GeoPonctuelResult> {
  if (typeof navigator === 'undefined' || !navigator.geolocation) {
    return Promise.resolve({
      ok: false,
      refused: false,
      message: 'Géolocalisation indisponible sur cet appareil.',
    })
  }
  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        resolve({
          ok: true,
          geo: {
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            accuracyM:
              typeof pos.coords.accuracy === 'number' ? pos.coords.accuracy : undefined,
            capturedAt: new Date().toISOString(),
          },
        })
      },
      (err) => {
        resolve({
          ok: false,
          refused: err.code === 1,
          message:
            err.code === 1
              ? 'Position refusée. Autorisez la localisation une fois, uniquement pour ce pointage.'
              : 'Position introuvable (délai ou GPS).',
        })
      },
      { enableHighAccuracy: false, timeout: 12_000, maximumAge: 0 },
    )
  })
}

export function datePointageLocale(): string {
  return todayIsoLocal()
}

export function formatHeureIso(iso?: string): string {
  if (!iso) return '—'
  const m = /T(\d{2}:\d{2})/.exec(iso)
  if (m) return m[1]
  try {
    return new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
  } catch {
    return iso
  }
}

/** OT ouverts assignés au technicien (pour sélection pointage). */
export function otsPointablesPourTech(
  ordres: { id: string; statut?: string; technicienUserId?: string; technicienUserIds?: string[] }[],
  userId: string,
  isCloture: (s?: string) => boolean,
): string[] {
  return ordres
    .filter((o) => {
      if (isCloture(o.statut)) return false
      const ids = [o.technicienUserId, ...(o.technicienUserIds || [])].filter(Boolean)
      return !ids.length || ids.includes(userId)
    })
    .map((o) => o.id)
}
