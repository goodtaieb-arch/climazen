/**
 * Correction d’un oubli « en cours d’intervention ».
 * Le tech ne retouche jamais l’horodatage : bureau (téléphone) ou IA site (GPS obligatoire).
 */

import { formatOtNumero } from './ordreTravail'
import {
  dateLocaleFromInstant,
  datePointageLocale,
  eventsDuJour,
  formatHeureIso,
  hmVersIsoLocal,
  normaliserAction,
  type PointageEvent,
  type PointageGeo,
} from './pointage'
import type { AppData } from './types'

export function gpsPointageValide(geo?: PointageGeo | null): boolean {
  if (!geo) return false
  return Number.isFinite(geo.lat) && Number.isFinite(geo.lng)
}

export function wantsCorrigerPointageArrivee(raw: string): boolean {
  const n = String(raw || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/['’]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  if (!n) return false
  const oubli = /\boubli/.test(n)
  const corrige = /\bcorrig/.test(n)
  const pointer =
    /\bpoint(er|age|e)\b/.test(n) ||
    /\ben cours\b/.test(n) ||
    /\barriv/.test(n) ||
    /\binter(vention)?\b/.test(n)
  if ((oubli || corrige) && pointer) return true
  if (/oublie.*pointer|pointer.*oublie/.test(n)) return true
  if (/corrige.*pointage|pointage.*corrige/.test(n)) return true
  return false
}

export type CorrigerArriveeOpts = {
  events: PointageEvent[]
  userId: string
  userName: string
  otId: string
  chantierId?: string
  arriveeAt: string
  now?: string
  geo?: PointageGeo
  geoRequired?: boolean
  corrigePar: 'bureau' | 'ia'
  motif?: string
}

export type CorrigerArriveeOk = {
  ok: true
  mode: 'insert' | 'update'
  insert?: Omit<PointageEvent, 'id' | 'createdAt'>
  update?: { id: string; patch: Partial<PointageEvent> }
}

export type CorrigerArriveeErr = { ok: false; error: string }

function instantMs(iso: string): number {
  const t = new Date(iso).getTime()
  return Number.isFinite(t) ? t : NaN
}

function noteCorrection(opts: CorrigerArriveeOpts): string {
  const qui = opts.corrigePar === 'ia' ? 'IA site (GPS)' : 'bureau'
  const motif = (opts.motif || '').trim()
  return motif
    ? `Correction ${qui} — ${motif}`
    : `Correction ${qui} — oubli de pointer l’arrivée sur site`
}

export function corrigerArriveeSite(
  opts: CorrigerArriveeOpts,
): CorrigerArriveeOk | CorrigerArriveeErr {
  if (opts.geoRequired && !gpsPointageValide(opts.geo)) {
    return {
      ok: false,
      error:
        'GPS obligatoire pour que l’IA corrige le pointage. Autorisez la position (une fois), ou demandez au bureau.',
    }
  }
  const arriveeAt = String(opts.arriveeAt || '').trim()
  if (!arriveeAt) {
    return { ok: false, error: 'Heure d’arrivée manquante.' }
  }
  const now = opts.now || new Date().toISOString()
  const nowMs = instantMs(now)
  const arriveeMs = instantMs(arriveeAt)
  if (!Number.isFinite(arriveeMs)) {
    return { ok: false, error: 'Heure d’arrivée invalide.' }
  }
  if (Number.isFinite(nowMs) && arriveeMs > nowMs) {
    return { ok: false, error: 'L’heure d’arrivée ne peut pas être dans le futur.' }
  }
  const date = dateLocaleFromInstant(arriveeAt) || datePointageLocale()
  const list = eventsDuJour(opts.events, { userId: opts.userId, date })
  const enCours = [...list]
    .reverse()
    .find(
      (e) =>
        normaliserAction(e.action) === 'intervention_en_cours' && e.otId === opts.otId,
    )
  const deplacement = [...list]
    .reverse()
    .find(
      (e) =>
        normaliserAction(e.action) === 'deplacement' &&
        e.otId === opts.otId &&
        (e.cible || 'ot') === 'ot',
    )

  if (deplacement && arriveeMs < instantMs(deplacement.at)) {
    return {
      ok: false,
      error: `L’arrivée (${formatHeureIso(arriveeAt)}) est avant le départ vers le site (${formatHeureIso(deplacement.at)}).`,
    }
  }

  const corrigeAt = now
  const geo = gpsPointageValide(opts.geo) ? opts.geo : undefined
  const common = {
    corrigePar: opts.corrigePar,
    corrigeMotif: opts.motif || 'Oubli de pointer l’arrivée sur site',
    corrigeAt,
    note: noteCorrection(opts),
    geo,
    geoRefused: false,
    geoError: undefined as string | undefined,
  }

  if (enCours) {
    const idx = list.findIndex((e) => e.id === enCours.id)
    const next = idx >= 0 ? list[idx + 1] : undefined
    if (next && arriveeMs > instantMs(next.at)) {
      return {
        ok: false,
        error: `L’arrivée (${formatHeureIso(arriveeAt)}) est après l’action suivante (${formatHeureIso(next.at)}).`,
      }
    }
    return {
      ok: true,
      mode: 'update',
      update: {
        id: enCours.id,
        patch: {
          at: arriveeAt,
          date,
          otId: opts.otId,
          chantierId: opts.chantierId || enCours.chantierId,
          ...common,
        },
      },
    }
  }

  return {
    ok: true,
    mode: 'insert',
    insert: {
      userId: opts.userId,
      userName: opts.userName,
      action: 'intervention_en_cours',
      at: arriveeAt,
      date,
      otId: opts.otId,
      chantierId: opts.chantierId,
      cible: 'ot',
      ...common,
    },
  }
}

export type PropositionCorrigerPointage = {
  userId: string
  userName: string
  otId: string
  otNumero: string
  chantierId?: string
  date: string
  heure?: string
  summary: string
}

function normalize(s: string): string {
  return (s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/['’]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/** 14h / 14h30 / 14:30 → HH:mm */
export function parseHeureCorriger(text: string): string | undefined {
  const m =
    text.match(/\b(\d{1,2})\s*[h:]\s*(\d{2})\b/i) ||
    text.match(/\b(\d{1,2})\s*h\b/i) ||
    text.match(/\ba\s+(\d{1,2})\s*h(?:\s*(\d{2}))?\b/i)
  if (!m) return undefined
  const h = Math.min(23, Math.max(0, Number(m[1])))
  const min = m[2] != null ? Math.min(59, Math.max(0, Number(m[2]))) : 0
  return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`
}

export function proposerCorrigerPointageArrivee(opts: {
  text: string
  data: AppData
  userId?: string
  userName?: string
  team?: { id: string; fullName?: string; email?: string }[]
}): { ok: true; proposition: PropositionCorrigerPointage } | { ok: false; error: string } {
  const raw = opts.text.trim()
  if (!wantsCorrigerPointageArrivee(raw)) {
    return { ok: false, error: 'Pas une demande de correction de pointage.' }
  }
  const heure = parseHeureCorriger(raw)
  const date = datePointageLocale()
  const events = Array.isArray(opts.data.pointageEvents)
    ? (opts.data.pointageEvents as PointageEvent[])
    : []

  let userId = opts.userId || ''
  let userName = opts.userName || 'Technicien'
  const named =
    raw.match(
      /(?:tech(?:nicien)?|pour|de)\s+([A-Za-zÀ-ÿ'’\-]+(?:\s+[A-Za-zÀ-ÿ'’\-]+){0,2})/i,
    )?.[1] || ''
  if (named.trim().length >= 2 && opts.team?.length) {
    const q = normalize(named)
    const hit = opts.team.find((m) => {
      const nom = normalize(m.fullName || '')
      const mail = normalize(m.email || '')
      return (nom && (nom.includes(q) || q.includes(nom.split(' ')[0] || ''))) || mail.includes(q)
    })
    if (hit?.id) {
      userId = hit.id
      userName = hit.fullName || hit.email || userName
    }
  }
  if (!userId) {
    return {
      ok: false,
      error: 'Je ne sais pas pour quel technicien corriger. Dites votre nom, ou ouvrez Aide IA connecté.',
    }
  }

  const jour = eventsDuJour(events, { userId, date })
  const lastDep = [...jour]
    .reverse()
    .find(
      (e) =>
        normaliserAction(e.action) === 'deplacement' &&
        e.otId &&
        (e.cible || 'ot') === 'ot',
    )
  const lastEnCours = [...jour]
    .reverse()
    .find((e) => normaliserAction(e.action) === 'intervention_en_cours' && e.otId)
  const otId = lastDep?.otId || lastEnCours?.otId || ''
  if (!otId) {
    return {
      ok: false,
      error:
        'Aucun déplacement vers une INT aujourd’hui pour ce tech. Le bureau peut quand même corriger sur Pointeuse.',
    }
  }
  const ot = (opts.data.ordresTravail || []).find((o) => o.id === otId)
  const otNumero = ot ? formatOtNumero(ot.numero) : otId.slice(0, 8)
  const chantierId = lastDep?.chantierId || lastEnCours?.chantierId || ot?.chantierId

  const heureLabel = heure
    ? heure
    : 'heure GPS au moment de la validation (vous êtes sur site)'
  return {
    ok: true,
    proposition: {
      userId,
      userName,
      otId,
      otNumero,
      chantierId,
      date,
      heure,
      summary: [
        `⚠️ Validation humaine obligatoire — rien n’est écrit tant que vous ne dites pas « oui ».`,
        ``,
        `Oubli « en cours d’intervention » — je peux corriger le pointage :`,
        `• Tech : ${userName}`,
        `• INT : ${otNumero}`,
        `• Arrivée : ${heureLabel}`,
        `• GPS : l’IA vérifie la position au moment du « oui » (preuve sur site).`,
        ``,
        `Le technicien ne peut pas modifier les heures lui-même. Répondez « oui » pour appliquer, ou « non » pour annuler (le bureau peut aussi corriger sur Pointeuse).`,
      ].join('\n'),
    },
  }
}

export function isoArriveePourCorrection(opts: {
  date: string
  heure?: string
  geo?: PointageGeo
}): string {
  if (opts.heure) return hmVersIsoLocal(opts.date, opts.heure)
  if (opts.geo?.capturedAt) return opts.geo.capturedAt
  return new Date().toISOString()
}
