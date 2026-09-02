/**
 * Pointeuse légale — horodatage + géolocalisation ponctuelle à chaque action.
 * Pas de tracking GPS continu (CNIL / RGPD).
 */

import { todayIsoLocal } from './agenda'

export const POINTAGE_ACTIONS = [
  'prise_vehicule',
  'trajet',
  'arrivee_chantier',
  'pause',
  'retour',
] as const

export type PointageAction = (typeof POINTAGE_ACTIONS)[number]

export const POINTAGE_ACTION_LABELS: Record<PointageAction, string> = {
  prise_vehicule: 'Prise du véhicule',
  trajet: 'Trajet',
  arrivee_chantier: 'Arrivée chantier / OT',
  pause: 'Pause',
  retour: 'Retour',
}

export const POINTAGE_ACTION_HINTS: Record<PointageAction, string> = {
  prise_vehicule: 'Début de journée — véhicule pris',
  trajet: 'En route (dépôt → site ou site → site)',
  arrivee_chantier: 'Sur place, temps chantier',
  pause: 'Pause / repas (hors temps chantier)',
  retour: 'Retour dépôt / fin de tournée',
}

export type PointageSegmentKind = 'vehicule' | 'trajet' | 'chantier' | 'pause' | 'retour'

export const POINTAGE_SEGMENT_LABELS: Record<PointageSegmentKind, string> = {
  vehicule: 'Véhicule',
  trajet: 'Trajet',
  chantier: 'Chantier',
  pause: 'Pause',
  retour: 'Retour',
}

export const POINTAGE_CNIL_NOTICE =
  'Horodatage et position uniquement au moment du pointage. Aucun suivi GPS continu. Données destinées à la paie et à la facturation, accessibles au bureau, conservées dans le dossier société.'

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
  otId?: string
  chantierId?: string
  voitureId?: string
  note?: string
  annule?: boolean
  annuleMotif?: string
  createdAt: string
}

export type PointageRegles = {
  /** Activation seulement si les règles sont complètes. */
  active: boolean
  heuresJour: number
  heuresSemaine: number
  /** Pause réelle non comptée dans le temps payé. */
  pauseNonPayee: boolean
  /** Arrondi de l’horodatage (0 = exact). */
  arrondiMinutes: number
  geoObligatoire: boolean
  cnilAcceptee: boolean
  debutJournee: string
  finJournee: string
  /** Pause forfaitaire déduite si aucune pause n’est pointée (0 = aucune). */
  pauseAutoMinutes: number
  notePaie?: string
  configuredAt?: string
  configuredByUserId?: string
  updatedAt?: string
}

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
  return (POINTAGE_ACTIONS as readonly string[]).includes(v)
    ? (v as PointageAction)
    : undefined
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

/** Activation interdite tant que les règles ne sont pas paramétrées. */
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

export function actionsSuivantes(last?: PointageAction): PointageAction[] {
  if (!last || last === 'retour') {
    return ['prise_vehicule', 'trajet', 'arrivee_chantier']
  }
  if (last === 'prise_vehicule') {
    return ['trajet', 'arrivee_chantier', 'pause', 'retour']
  }
  if (last === 'trajet') {
    return ['arrivee_chantier', 'pause', 'retour']
  }
  if (last === 'arrivee_chantier') {
    return ['pause', 'trajet', 'arrivee_chantier', 'retour']
  }
  if (last === 'pause') {
    return ['trajet', 'arrivee_chantier', 'retour']
  }
  return ['prise_vehicule', 'trajet', 'arrivee_chantier']
}

export function actionAutorisee(last: PointageAction | undefined, next: PointageAction): boolean {
  return actionsSuivantes(last).includes(next)
}

export function segmentDepuisAction(action: PointageAction): PointageSegmentKind {
  if (action === 'prise_vehicule') return 'vehicule'
  if (action === 'trajet') return 'trajet'
  if (action === 'arrivee_chantier') return 'chantier'
  if (action === 'pause') return 'pause'
  return 'retour'
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
}

export type JourneePointage = {
  date: string
  userId: string
  userName: string
  vehiculeMin: number
  trajetMin: number
  chantierMin: number
  pauseMin: number
  retourMin: number
  pauseAutoMin: number
  payeMin: number
  heuresJour: number
  heuresSupMin: number
  ouvert: boolean
  lastAction?: PointageAction
  segments: PointageSegment[]
}

function addKind(
  acc: Pick<
    JourneePointage,
    'vehiculeMin' | 'trajetMin' | 'chantierMin' | 'pauseMin' | 'retourMin'
  >,
  kind: PointageSegmentKind,
  minutes: number,
) {
  if (kind === 'vehicule') acc.vehiculeMin += minutes
  else if (kind === 'trajet') acc.trajetMin += minutes
  else if (kind === 'chantier') acc.chantierMin += minutes
  else if (kind === 'pause') acc.pauseMin += minutes
  else acc.retourMin += minutes
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
    vehiculeMin: 0,
    trajetMin: 0,
    chantierMin: 0,
    pauseMin: 0,
    retourMin: 0,
  }
  const segments: PointageSegment[] = []
  const last = list[list.length - 1]
  const ouvert = Boolean(last && last.action !== 'retour')

  for (let i = 0; i < list.length; i++) {
    const cur = list[i]
    const nextAt = list[i + 1]?.at || (ouvert && i === list.length - 1 ? now : '')
    if (!nextAt) continue
    const kind = segmentDepuisAction(cur.action)
    const minutes = minutesEntre(cur.at, nextAt)
    if (minutes <= 0) continue
    addKind(totals, kind, minutes)
    segments.push({
      kind,
      from: cur.at,
      to: nextAt,
      minutes,
      otId: cur.otId,
      chantierId: cur.chantierId,
    })
  }

  let pauseAutoMin = 0
  if (r.pauseAutoMinutes > 0 && totals.pauseMin === 0 && (totals.chantierMin > 0 || !ouvert)) {
    pauseAutoMin = r.pauseAutoMinutes
  }

  const brut =
    totals.vehiculeMin + totals.trajetMin + totals.chantierMin + totals.retourMin + totals.pauseMin
  const payeMin = Math.max(0, brut - (r.pauseNonPayee ? totals.pauseMin : 0) - pauseAutoMin)
  const quota = Math.round(r.heuresJour * 60)
  return {
    date: opts.date,
    userId: opts.userId,
    userName: last?.userName || list[0]?.userName || '',
    ...totals,
    pauseAutoMin,
    payeMin,
    heuresJour: r.heuresJour,
    heuresSupMin: Math.max(0, payeMin - quota),
    ouvert,
    lastAction: last?.action,
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
    'Véhicule (min)',
    'Trajet (min)',
    'Chantier (min)',
    'Pause (min)',
    'Retour (min)',
    'Pause auto (min)',
    'Temps payé (min)',
    'Temps payé',
    'Heures sup (min)',
    'Journée ouverte',
  ]
  const lines = [header.join(';')]
  for (const j of jours) {
    lines.push(
      [
        j.date,
        csvEscape(j.userName),
        j.vehiculeMin,
        j.trajetMin,
        j.chantierMin,
        j.pauseMin,
        j.retourMin,
        j.pauseAutoMin,
        j.payeMin,
        formatMinutesHhMm(j.payeMin),
        j.heuresSupMin,
        j.ouvert ? 'oui' : 'non',
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
    'Latitude',
    'Longitude',
    'Précision (m)',
    'GPS refusé',
    'Note',
    'Annulé',
  ]
  const lines = [header.join(';')]
  for (const e of eventsActifs(events).concat(events.filter((x) => x.annule)).sort((a, b) =>
    a.at.localeCompare(b.at),
  )) {
    const hm = e.at.includes('T') ? e.at.slice(11, 16) : ''
    lines.push(
      [
        e.date,
        hm,
        csvEscape(e.userName),
        POINTAGE_ACTION_LABELS[e.action],
        e.otId || '',
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

/** Un seul getCurrentPosition — jamais de watchPosition. */
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
