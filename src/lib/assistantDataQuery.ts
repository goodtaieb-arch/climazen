/**
 * Lecture factuelle de TOUTES les données app (OT, clients, sites…) pour l’assistant.
 * Pas de RAG : on interroge AppData en mémoire (source de vérité org_data).
 * Corrige le cas où OpenAI ne voyait qu’un extrait (40 clients / OT du jour).
 */

import type { AppData } from './types'
import { clientDisplayName } from './types'
import {
  formatOtNumero,
  isOtCloture,
  STATUT_OT_LABELS,
  TYPE_OT_LABELS,
  type OrdreTravail,
  type StatutOt,
} from './ordreTravail'
import { todayIsoLocal } from './agenda'
import { scorePersonName, type TeamMemberLite } from './assistantOtLookup'

function normalize(s: string): string {
  return String(s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/['’]/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/** « or » dicté/tapé à la place de « ot », « ordre », etc. */
export function normalizeOtTypos(raw: string): string {
  return String(raw || '')
    .replace(/\b(or|ots|o\.t\.?|odi|ordres?)\b/gi, (m) => {
      const n = normalize(m)
      if (n === 'or' || n === 'ots' || n === 'ot' || n === 'o t' || n === 'odi') return 'OT'
      if (n.startsWith('ordre')) return m
      return 'OT'
    })
}

function monthPrefix(iso = todayIsoLocal()): string {
  return iso.slice(0, 7) // YYYY-MM
}

function monthLabelFr(ym: string): string {
  const [y, m] = ym.split('-').map(Number)
  const names = [
    'janvier',
    'février',
    'mars',
    'avril',
    'mai',
    'juin',
    'juillet',
    'août',
    'septembre',
    'octobre',
    'novembre',
    'décembre',
  ]
  return `${names[(m || 1) - 1] || m} ${y}`
}

function resolvePeriod(raw: string, today = todayIsoLocal()): {
  kind: 'today' | 'month' | 'week' | 'all_open' | 'date'
  label: string
  dateIso?: string
  monthYm?: string
} {
  const n = normalize(raw)
  if (/\b(ce\s+mois|fin\s+de\s+mois|du\s+mois|mois\s+en\s+cours|ce\s+mois[- ]?ci)\b/.test(n)) {
    const ym = monthPrefix(today)
    return { kind: 'month', label: monthLabelFr(ym), monthYm: ym }
  }
  if (/\b(cette\s+semaine|semaine\s+en\s+cours)\b/.test(n)) {
    return { kind: 'week', label: 'cette semaine' }
  }
  if (/\b(aujourd|auj)\w*\b/.test(n) || /\baujourd\s*hui\b/.test(n)) {
    return { kind: 'today', label: 'aujourd’hui', dateIso: today }
  }
  if (/\bdemain\b/.test(n)) {
    const d = new Date(today + 'T12:00:00')
    d.setDate(d.getDate() + 1)
    const iso = d.toISOString().slice(0, 10)
    return { kind: 'date', label: 'demain', dateIso: iso }
  }
  const fr = raw.match(/\b(\d{1,2})[./\-](\d{1,2})(?:[./\-](\d{2,4}))?\b/)
  if (fr) {
    let y = fr[3] ? Number(fr[3]) : Number(today.slice(0, 4))
    if (y < 100) y += 2000
    const m = String(Number(fr[2])).padStart(2, '0')
    const d = String(Number(fr[1])).padStart(2, '0')
    const iso = `${y}-${m}-${d}`
    return { kind: 'date', label: iso, dateIso: iso }
  }
  // défaut pour « combien d’OT à clôturer / reste à faire » → mois en cours
  if (/\b(clotur|rester?|reste|effectuer|finir|a\s+faire|ouverts?)\b/.test(n)) {
    const ym = monthPrefix(today)
    return { kind: 'month', label: monthLabelFr(ym), monthYm: ym }
  }
  return { kind: 'all_open', label: 'tous les OT ouverts' }
}

function otDate(o: OrdreTravail): string {
  return String(o.date || '').slice(0, 10)
}

function startOfWeekMonday(iso: string): string {
  const d = new Date(iso.slice(0, 10) + 'T12:00:00')
  const day = d.getDay()
  const diff = day === 0 ? -6 : 1 - day
  d.setDate(d.getDate() + diff)
  return d.toISOString().slice(0, 10)
}

function inWeek(iso: string, today: string): boolean {
  const start = startOfWeekMonday(today)
  const end = new Date(start + 'T12:00:00')
  end.setDate(end.getDate() + 6)
  const endIso = end.toISOString().slice(0, 10)
  return iso >= start && iso <= endIso
}

export function filterOtsByPeriod(
  ots: OrdreTravail[],
  period: ReturnType<typeof resolvePeriod>,
  today = todayIsoLocal(),
): OrdreTravail[] {
  return ots.filter((o) => {
    const d = otDate(o)
    if (!d) return period.kind === 'all_open'
    if (period.kind === 'today' || period.kind === 'date') return d === (period.dateIso || today)
    if (period.kind === 'month') return d.startsWith(period.monthYm || monthPrefix(today))
    if (period.kind === 'week') return inWeek(d, today)
    return true
  })
}

function formatOtBrief(
  o: OrdreTravail,
  data: AppData,
): string {
  const site = data.chantiers?.find((s) => s.id === o.chantierId)
  const client = data.clients?.find((c) => c.id === o.clientId)
  const where = [client ? clientDisplayName(client) : '', site?.nom].filter(Boolean).join(' · ')
  const type = TYPE_OT_LABELS[o.typeOt] || o.typeOt
  const st = STATUT_OT_LABELS[o.statut as StatutOt] || o.statut || '—'
  const heure = (o.heure || '').slice(0, 5)
  return `• ${formatOtNumero(o.numero)} — ${type} · ${st}${heure ? ` · ${heure}` : ''} · ${otDate(o)}${
    o.technicien ? ` · ${o.technicien}` : ''
  }${where ? ` · ${where}` : ''} — ${(o.action || '').slice(0, 70)}`
}

/**
 * Questions de lecture métier : comptes OT, reste à clôturer, liste, stats.
 * Inclut fautes « or » / « o.t » et formulations orales fin de mois.
 */
export function wantsDataQuery(raw: string): boolean {
  const fixed = normalizeOtTypos(raw)
  const n = normalize(fixed)
  if (!n) return false

  const mentionsOt =
    /\b(ot|ordre|ordres|intervention|interventions)\b/.test(n) ||
    /\b(or|ots)\b/.test(normalize(raw)) // typo brute avant normalisation

  const asksCount =
    /\b(combien|nombre|reste|rester|restent|encore|a\s+faire|effectuer|clotur|finir|statistique|bilan|synthese|synth[eè]se)\b/.test(
      n,
    ) || /\b(ouverts?|non\s+clotur|pas\s+clotur|en\s+cours)\b/.test(n)

  const asksList =
    /\b(liste|lister|montre|affiche|quels?|quelles?|donne[- ]moi|voir)\b/.test(n) && mentionsOt

  const periodHint =
    /\b(ce\s+mois|fin\s+de\s+mois|aujourd|auj|demain|cette\s+semaine|mois)\b/.test(n)

  if (mentionsOt && (asksCount || asksList)) return true
  if (mentionsOt && periodHint && /\b(reste|clotur|effectuer|ouverts?|a\s+faire)\b/.test(n)) {
    return true
  }
  // « combien reste à faire ce mois » même sans « OT » explicite si contexte clôture
  if (asksCount && periodHint && /\b(clotur|effectuer|intervention|travail)\b/.test(n)) {
    return true
  }
  return false
}

export type OtStats = {
  total: number
  open: number
  closed: number
  byStatut: Record<string, number>
  openList: OrdreTravail[]
  closedList: OrdreTravail[]
}

export function computeOtStats(
  data: AppData,
  opts?: { period?: ReturnType<typeof resolvePeriod>; includeAllStatuses?: boolean },
): OtStats {
  const all = data.ordresTravail || []
  const period = opts?.period || { kind: 'all_open' as const, label: 'tous' }
  const scoped = filterOtsByPeriod(all, period)
  const openList = scoped.filter((o) => !isOtCloture(o.statut))
  const closedList = scoped.filter((o) => isOtCloture(o.statut))
  const byStatut: Record<string, number> = {}
  for (const o of scoped) {
    const k = String(o.statut || 'inconnu')
    byStatut[k] = (byStatut[k] || 0) + 1
  }
  return {
    total: scoped.length,
    open: openList.length,
    closed: closedList.length,
    byStatut,
    openList,
    closedList,
  }
}

/**
 * Réponse locale authoritative — chiffres réels depuis AppData.
 */
export function answerDataQuery(
  data: AppData,
  raw: string,
  _team?: TeamMemberLite[],
): string {
  const period = resolvePeriod(raw)
  const stats = computeOtStats(data, { period })
  const wantsClosedOnly = /\b(clotur[eé]s?|termin[eé]s?|finis?|sign[eé]s?)\b/.test(
    normalize(raw),
  ) && !/\b(a\s+clotur|rester?|reste|effectuer|ouverts?|non\s+clotur)\b/.test(normalize(raw))

  const lines: string[] = []

  if (wantsClosedOnly) {
    lines.push(
      `Sur ${period.label} : ${stats.closed} OT clôturé${stats.closed > 1 ? 's' : ''} / terminé${stats.closed > 1 ? 's' : ''} (sur ${stats.total} OT au total).`,
    )
    if (stats.closedList.length) {
      lines.push('', 'Derniers clôturés :')
      for (const o of stats.closedList.slice(0, 12)) lines.push(formatOtBrief(o, data))
      if (stats.closedList.length > 12) {
        lines.push(`… et ${stats.closedList.length - 12} autre(s).`)
      }
    }
    return lines.join('\n')
  }

  // Cas principal : reste à effectuer / à clôturer
  lines.push(
    `Sur ${period.label} : ${stats.open} OT encore ouvert${stats.open > 1 ? 's' : ''} à effectuer / clôturer` +
      (stats.total
        ? ` (sur ${stats.total} OT au total, dont ${stats.closed} déjà clôturé${stats.closed > 1 ? 's' : ''})`
        : '') +
      '.',
  )

  if (stats.open === 0) {
    lines.push(
      '',
      stats.total === 0
        ? `Aucun OT planifié pour ${period.label} dans vos données.`
        : `Tous les OT de ${period.label} sont déjà clôturés ou terminés.`,
    )
    // Aide : montrer les ouverts hors période s’il y en a
    const allOpen = (data.ordresTravail || []).filter((o) => !isOtCloture(o.statut))
    if (allOpen.length && period.kind !== 'all_open') {
      lines.push(
        '',
        `Note : il reste ${allOpen.length} OT ouvert${allOpen.length > 1 ? 's' : ''} sur d’autres dates (hors ${period.label}).`,
      )
      for (const o of allOpen.slice(0, 8)) lines.push(formatOtBrief(o, data))
      if (allOpen.length > 8) lines.push(`… et ${allOpen.length - 8} autre(s).`)
    }
    return lines.join('\n')
  }

  lines.push('', 'OT ouverts :')
  const sorted = [...stats.openList].sort((a, b) => otDate(a).localeCompare(otDate(b)))
  for (const o of sorted.slice(0, 20)) lines.push(formatOtBrief(o, data))
  if (sorted.length > 20) lines.push(`… et ${sorted.length - 20} autre(s).`)

  // Répartition par statut
  const statutParts = Object.entries(stats.byStatut)
    .filter(([st]) => !isOtCloture(st))
    .map(([st, n]) => `${STATUT_OT_LABELS[st as StatutOt] || st}: ${n}`)
  if (statutParts.length) {
    lines.push('', `Répartition : ${statutParts.join(' · ')}`)
  }

  lines.push(
    '',
    'Pour clôturer un OT : ouvrez-le depuis l’Agenda ou OT, signez, puis Clôturer (action humaine — l’IA ne clôture pas).',
  )

  return lines.join('\n')
}

/**
 * Snapshot dense pour OpenAI : stats mois + OT ouverts (pas seulement aujourd’hui)
 * + clients/sites scorés selon la question.
 */
export function buildLiveDataSnapshot(
  data: AppData,
  opts?: {
    team?: TeamMemberLite[]
    userQuery?: string
    maxClients?: number
    maxOpenOts?: number
  },
): string {
  const today = todayIsoLocal()
  const ym = monthPrefix(today)
  const monthStats = computeOtStats(data, {
    period: { kind: 'month', label: monthLabelFr(ym), monthYm: ym },
  })
  const todayStats = computeOtStats(data, {
    period: { kind: 'today', label: 'aujourd’hui', dateIso: today },
  })
  const allOpen = (data.ordresTravail || []).filter((o) => !isOtCloture(o.statut))

  const lines: string[] = [
    '=== DONNÉES RÉELLES DE LA SOCIÉTÉ (source de vérité — ne pas inventer) ===',
    `Date du jour : ${today}`,
    `OT ${monthLabelFr(ym)} : ${monthStats.open} ouverts à clôturer / ${monthStats.closed} clôturés / ${monthStats.total} au total`,
    `OT aujourd’hui : ${todayStats.open} ouverts / ${todayStats.total} au total`,
    `OT ouverts (toutes dates) : ${allOpen.length}`,
    `Clients : ${(data.clients || []).length} · Sites : ${(data.chantiers || []).length} · Pièces stock : ${(data.piecesDetachees || []).length}`,
  ]

  const names = (opts?.team || [])
    .map((m) => (m.fullName || '').trim())
    .filter(Boolean)
    .slice(0, 40)
  if (names.length) lines.push(`Équipe : ${names.join(' · ')}`)

  const maxOts = opts?.maxOpenOts ?? 40
  const openForPrompt = [...allOpen]
    .sort((a, b) => otDate(a).localeCompare(otDate(b)))
    .slice(0, maxOts)
  lines.push('', `OT ouverts (max ${maxOts}) :`)
  if (!openForPrompt.length) lines.push('• (aucun)')
  for (const o of openForPrompt) lines.push(formatOtBrief(o, data))
  if (allOpen.length > maxOts) {
    lines.push(`… +${allOpen.length - maxOts} OT ouverts non listés (demander un filtre tech/date).`)
  }

  // Clients pertinents selon la question, sinon les premiers
  const q = normalize(opts?.userQuery || '')
  const maxC = opts?.maxClients ?? 60
  const clients = data.clients || []
  let picked = clients.slice(0, maxC)
  if (q.length >= 3) {
    const scored = clients
      .map((c) => {
        const label = clientDisplayName(c)
        const score = Math.max(
          scorePersonName(label, q),
          ...normalize(label)
            .split(' ')
            .filter((t) => t.length > 2 && q.includes(t))
            .map(() => 70),
          normalize(label)
            .split(' ')
            .some((t) => t.length > 3 && q.includes(t))
            ? 60
            : 0,
        )
        // tokens de la query dans le nom
        const tokens = q.split(' ').filter((t) => t.length > 2)
        const hitTokens = tokens.filter((t) => normalize(label).includes(t)).length
        return { c, score: Math.max(score, hitTokens * 40) }
      })
      .filter((x) => x.score >= 40)
      .sort((a, b) => b.score - a.score)
      .map((x) => x.c)
    if (scored.length) {
      const ids = new Set(scored.map((c) => c.id))
      picked = [...scored, ...clients.filter((c) => !ids.has(c.id))].slice(0, maxC)
    }
  }

  lines.push('', `Clients / sites (jusqu’à ${maxC}) :`)
  if (!picked.length) lines.push('(aucun client)')
  for (const c of picked) {
    const sites = (data.chantiers || []).filter((s) => s.clientId === c.id).slice(0, 10)
    lines.push(`- « ${clientDisplayName(c)} »`)
    for (const s of sites) {
      lines.push(`  · Site « ${s.nom} »`)
    }
  }
  if (clients.length > picked.length) {
    lines.push(`… +${clients.length - picked.length} clients non listés — chercher par nom exact.`)
  }

  lines.push(
    '',
    'RÈGLE : pour un chiffre (combien d’OT, reste à clôturer…), utilise UNIQUEMENT ces totaux. Si la liste est tronquée, cite le total exact ci-dessus.',
  )

  return lines.join('\n')
}
