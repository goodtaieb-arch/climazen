/**
 * Jours fériés français (métropole) — même traitement agenda que le week-end :
 * jour non ouvré, à planifier seulement en astreinte / urgence.
 */

import { isWeekendIso } from './agenda'

/** Pâques (dimanche) — algorithme de Meeus/Jones/Butcher (calendrier grégorien). */
export function paquesIso(year: number): string {
  const a = year % 19
  const b = Math.floor(year / 100)
  const c = year % 100
  const d = Math.floor(b / 4)
  const e = b % 4
  const f = Math.floor((b + 8) / 25)
  const g = Math.floor((b - f + 1) / 3)
  const h = (19 * a + b - d - g + 15) % 30
  const i = Math.floor(c / 4)
  const k = c % 4
  const l = (32 + 2 * e + 2 * i - h - k) % 7
  const m = Math.floor((a + 11 * h + 22 * l) / 451)
  const month = Math.floor((h + l - 7 * m + 114) / 31)
  const day = ((h + l - 7 * m + 114) % 31) + 1
  return isoYmd(year, month, day)
}

function isoYmd(year: number, month1: number, day: number): string {
  return `${year}-${String(month1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

function addDaysIsoLocal(iso: string, days: number): string {
  const d = new Date(`${iso.slice(0, 10)}T12:00:00`)
  d.setDate(d.getDate() + days)
  const y = d.getFullYear()
  const m = d.getMonth() + 1
  const day = d.getDate()
  return isoYmd(y, m, day)
}

export type JourFerie = { date: string; nom: string }

/** 11 jours fériés métropole pour une année civile. */
export function joursFeriesFrance(year: number): JourFerie[] {
  const paques = paquesIso(year)
  return [
    { date: isoYmd(year, 1, 1), nom: 'Jour de l’an' },
    { date: addDaysIsoLocal(paques, 1), nom: 'Lundi de Pâques' },
    { date: isoYmd(year, 5, 1), nom: 'Fête du travail' },
    { date: isoYmd(year, 5, 8), nom: 'Victoire 1945' },
    { date: addDaysIsoLocal(paques, 39), nom: 'Ascension' },
    { date: addDaysIsoLocal(paques, 50), nom: 'Lundi de Pentecôte' },
    { date: isoYmd(year, 7, 14), nom: 'Fête nationale' },
    { date: isoYmd(year, 8, 15), nom: 'Assomption' },
    { date: isoYmd(year, 11, 1), nom: 'Toussaint' },
    { date: isoYmd(year, 11, 11), nom: 'Armistice' },
    { date: isoYmd(year, 12, 25), nom: 'Noël' },
  ]
}

const cacheParAn = new Map<number, Map<string, string>>()

function indexAnnee(year: number): Map<string, string> {
  let idx = cacheParAn.get(year)
  if (!idx) {
    idx = new Map(joursFeriesFrance(year).map((j) => [j.date, j.nom]))
    cacheParAn.set(year, idx)
  }
  return idx
}

export function nomJourFerie(iso: string | undefined): string | null {
  const date = String(iso || '').slice(0, 10)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null
  const year = Number(date.slice(0, 4))
  if (!Number.isFinite(year)) return null
  return indexAnnee(year).get(date) || null
}

export function isJourFerieIso(iso: string | undefined): boolean {
  return Boolean(nomJourFerie(iso))
}

/** Week-end ou férié — même traitement planning. */
export function isJourNonOuvreIso(iso: string | undefined): boolean {
  return isWeekendIso(iso) || isJourFerieIso(iso)
}

export type JourNonOuvreInfo = {
  nonOuvre: boolean
  weekend: boolean
  ferie: boolean
  /** Pastille courte : Week-end / Férié. */
  badge: string | null
  nomFerie: string | null
  hint: string | null
}

export function infoJourNonOuvre(iso: string | undefined): JourNonOuvreInfo {
  const weekend = isWeekendIso(iso)
  const nomFerie = nomJourFerie(iso)
  const ferie = Boolean(nomFerie)
  const nonOuvre = weekend || ferie
  if (!nonOuvre) {
    return { nonOuvre: false, weekend: false, ferie: false, badge: null, nomFerie: null, hint: null }
  }
  const badge = ferie ? 'Férié' : 'Week-end'
  const hint = ferie
    ? `Jour férié (${nomFerie}${weekend ? ' · week-end' : ''}) — à planifier seulement si astreinte / urgence.`
    : 'Jour non ouvré (week-end) — à planifier seulement si astreinte / urgence.'
  return { nonOuvre: true, weekend, ferie, badge, nomFerie, hint }
}
