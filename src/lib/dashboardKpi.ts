/**
 * Indicateurs Accueil — préventif vs curatif + photo d’activité société.
 * Pas de lib de charts : agrégats purs, l’UI dessine barres / donut CSS.
 */

import type { AgendaEvent } from './agenda'
import {
  addDaysToIso,
  isAgendaDueSoon,
  isAgendaOverdue,
  startOfWeekMonday,
  todayIsoLocal,
} from './agenda'
import { inferOrigineOt } from './chaineCommerciale'
import { isContratActif } from './contratMaintenance'
import { isOtCloture, otAvancementPct, type OrdreTravail } from './ordreTravail'
import { alertesEtalonnage } from './outillageEtalonnage'
import { alertesEquipe } from './rhDocuments'
import { resolveModeGestion } from './siteParc'
import { isBouteilleRetournee, type AppData } from './types'

export type OtBucket = 'preventif' | 'curatif' | 'autre'

export type WeekBar = {
  weekStart: string
  label: string
  preventif: number
  curatif: number
  autre: number
  total: number
}

export type ChargeTech = {
  key: string
  name: string
  ouverts: number
}

export type DashboardKpi = {
  scope: 'societe' | 'moi'
  preventif: number
  curatif: number
  autre: number
  totalClasses: number
  preventifPct: number
  curatifPct: number
  visitesFait30j: number
  visitesDue30j: number
  visitesRetard: number
  preventifAvancementPct: number
  otOuverts: number
  otEnRetard: number
  otCloturesSemaine: number
  otCloturesMois: number
  avgAvancementOuverts: number
  contratsActifs: number
  sitesSousContrat: number
  cerfaBrouillons: number
  stockKg: number
  etalonnageAlertes: number
  rhAlertes: number
  weeks: WeekBar[]
  chargeParTech: ChargeTech[]
}

const PREVENTIF_TYPES = new Set(['maintenance', 'entretien', 'controle_etancheite'])

/** Classifie un OT : contrat / maintenance = préventif, dépannage = curatif. */
export function bucketOt(
  o: Pick<OrdreTravail, 'typeOt' | 'contratId' | 'lienCommandeType' | 'origineOt'>,
): OtBucket {
  const origine = inferOrigineOt(o)
  if (origine === 'maintenance_contrat' || o.contratId || o.lienCommandeType === 'contrat') {
    return 'preventif'
  }
  if (PREVENTIF_TYPES.has(o.typeOt)) return 'preventif'
  if (o.typeOt === 'installation' || o.typeOt === 'demantelement' || o.typeOt === 'devis') return 'autre'
  if (o.typeOt === 'depanage' || origine === 'depannage_urgence') return 'curatif'
  return 'autre'
}

export function pct(part: number, whole: number): number {
  if (whole <= 0) return 0
  return Math.round((100 * part) / whole)
}

function isoDay(raw?: string): string {
  return (raw || '').slice(0, 10)
}

function inRange(day: string, from: string, to: string): boolean {
  return day >= from && day <= to
}

function formatWeekLabel(weekStart: string): string {
  const d = weekStart.slice(8, 10)
  const m = weekStart.slice(5, 7)
  if (!d || !m) return weekStart
  return `${d}/${m}`
}

function otMatchesTech(o: OrdreTravail, userId?: string): boolean {
  if (!userId) return true
  if (o.technicienUserId) return o.technicienUserId === userId
  return o.createdByUserId === userId
}

export function computeDashboardKpi(opts: {
  data: AppData
  today?: string
  /** Filtre tech : ses OT / alertes. Gérant = undefined. */
  userId?: string
  isOwner?: boolean
  weekCount?: number
}): DashboardKpi {
  const today = isoDay(opts.today) || todayIsoLocal()
  const isOwner = Boolean(opts.isOwner)
  const scopeUserId = isOwner ? undefined : opts.userId
  const weekCount = opts.weekCount ?? 8
  const from30 = addDaysToIso(today, -30)
  const weekStartToday = startOfWeekMonday(today)
  const monthKey = today.slice(0, 7)

  const allOt = (opts.data.ordresTravail || []).filter((o) => otMatchesTech(o, scopeUserId))

  let preventif = 0
  let curatif = 0
  let autre = 0
  let otOuverts = 0
  let otEnRetard = 0
  let otCloturesSemaine = 0
  let otCloturesMois = 0
  let visitesFait30j = 0
  let avancementSum = 0
  let preventifOpenSum = 0
  let preventifOpenN = 0

  const chargeMap = new Map<string, ChargeTech>()

  for (const o of allOt) {
    const bucket = bucketOt(o)
    if (bucket === 'preventif') preventif += 1
    else if (bucket === 'curatif') curatif += 1
    else autre += 1

    const day = isoDay(o.date) || isoDay(o.createdAt)
    const closed = isOtCloture(o.statut)

    if (!closed) {
      otOuverts += 1
      avancementSum += otAvancementPct(o)
      if (day && day < today) otEnRetard += 1
      else if (o.statut === 'en_attente_piece') otEnRetard += 1
      if (bucket === 'preventif') {
        preventifOpenSum += otAvancementPct(o)
        preventifOpenN += 1
      }
      const name = (o.technicien || '').trim() || 'Non assigné'
      const key = o.technicienUserId || name
      const row = chargeMap.get(key) || { key, name, ouverts: 0 }
      row.ouverts += 1
      chargeMap.set(key, row)
    } else {
      if (day && day >= weekStartToday && day <= today) otCloturesSemaine += 1
      if (day && day.startsWith(monthKey)) otCloturesMois += 1
      if (bucket === 'preventif' && day && inRange(day, from30, today)) visitesFait30j += 1
    }
  }

  const splitWhole = preventif + curatif
  const oldestWeek = startOfWeekMonday(addDaysToIso(today, -(weekCount - 1) * 7))
  const weeks: WeekBar[] = []
  for (let i = 0; i < weekCount; i += 1) {
    const weekStart = startOfWeekMonday(addDaysToIso(oldestWeek, i * 7))
    const weekEnd = addDaysToIso(weekStart, 6)
    const bar: WeekBar = {
      weekStart,
      label: formatWeekLabel(weekStart),
      preventif: 0,
      curatif: 0,
      autre: 0,
      total: 0,
    }
    for (const o of allOt) {
      const day = isoDay(o.date) || isoDay(o.createdAt)
      if (!day || !inRange(day, weekStart, weekEnd)) continue
      const b = bucketOt(o)
      bar[b] += 1
      bar.total += 1
    }
    weeks.push(bar)
  }

  const agenda = opts.data.agendaEvents || []
  const contratAgenda = (e: AgendaEvent) => Boolean(e.contratId)
  const visitesDue30j = isOwner
    ? agenda.filter((e) => contratAgenda(e) && isAgendaDueSoon(e, 30, today)).length
    : 0
  const visitesRetard = isOwner
    ? agenda.filter((e) => contratAgenda(e) && isAgendaOverdue(e, today)).length
    : 0

  const preventifPlan = visitesFait30j + visitesDue30j + visitesRetard
  const preventifAvancementPct =
    preventifPlan > 0
      ? pct(visitesFait30j, preventifPlan)
      : preventifOpenN > 0
        ? Math.round(preventifOpenSum / preventifOpenN)
        : 0

  const interventions = opts.data.interventions || []
  const cerfaBrouillons = scopeUserId
    ? interventions.filter(
        (i) =>
          i.status === 'brouillon' &&
          (i.createdByUserId === scopeUserId ||
            allOt.some((o) => o.id === i.ordreTravailId || o.interventionId === i.id)),
      ).length
    : interventions.filter((i) => i.status === 'brouillon').length

  const stockKg = Math.round(
    (opts.data.stock || [])
      .filter((s) => !isBouteilleRetournee(s))
      .reduce((sum, s) => sum + (Number(s.quantiteKg) || 0), 0) * 10,
  ) / 10

  const etalonnageAlertes = alertesEtalonnage(opts.data.outillages, {
    userId: scopeUserId,
  }).length

  const retired = new Set(opts.data.personnelRetiresUserIds || [])
  const rhAlertes = alertesEquipe(opts.data.personnelDossiers, {
    userId: isOwner ? undefined : opts.userId,
  }).filter((a) => !retired.has(a.userId) && (a.statut === 'expire' || a.statut === 'bientot')).length

  const contratsActifs = isOwner
    ? (opts.data.contratsMaintenance || []).filter(isContratActif).length
    : 0
  const sitesSousContrat = isOwner
    ? (opts.data.chantiers || []).filter(
        (c) => c.statut === 'actif' && resolveModeGestion(c) === 'contrat',
      ).length
    : 0

  const chargeParTech = isOwner
    ? [...chargeMap.values()].sort((a, b) => b.ouverts - a.ouverts).slice(0, 6)
    : []

  return {
    scope: isOwner ? 'societe' : 'moi',
    preventif,
    curatif,
    autre,
    totalClasses: preventif + curatif + autre,
    preventifPct: pct(preventif, splitWhole),
    curatifPct: pct(curatif, splitWhole),
    visitesFait30j,
    visitesDue30j,
    visitesRetard,
    preventifAvancementPct,
    otOuverts,
    otEnRetard,
    otCloturesSemaine,
    otCloturesMois,
    avgAvancementOuverts: otOuverts > 0 ? Math.round(avancementSum / otOuverts) : 0,
    contratsActifs,
    sitesSousContrat,
    cerfaBrouillons,
    stockKg,
    etalonnageAlertes,
    rhAlertes,
    weeks,
    chargeParTech,
  }
}

/** CSS conic-gradient pour le donut préventif / curatif. */
export function preventifCuratifConic(kpi: Pick<DashboardKpi, 'preventifPct' | 'curatifPct'>): string {
  const p = Math.max(0, Math.min(100, kpi.preventifPct))
  if (p <= 0 && kpi.curatifPct <= 0) return 'conic-gradient(#d7e4e7 0 100%)'
  if (p >= 100) return 'conic-gradient(#1aa896 0 100%)'
  if (p <= 0) return 'conic-gradient(#ea580c 0 100%)'
  return `conic-gradient(#1aa896 0 ${p}%, #ea580c ${p}% 100%)`
}
