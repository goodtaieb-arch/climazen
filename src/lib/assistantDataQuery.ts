/**
 * Accès GLOBAL aux données société pour l’assistant (toutes questions, pas cas par cas).
 *
 * Principe :
 * 1) Totaux de tous les domaines (OT, clients, devis, stock…)
 * 2) Recherche libre sur les mots de la question → hits pertinents
 * 3) OpenAI répond avec ce contexte — pas besoin d’un regex par exemple
 */

import type { AppData } from './types'
import { clientDisplayName, CONTENANT_TYPE_LABELS } from './types'
import {
  formatOtNumero,
  isOtCloture,
  STATUT_OT_LABELS,
  TYPE_OT_LABELS,
  type OrdreTravail,
  type StatutOt,
} from './ordreTravail'
import { todayIsoLocal, AGENDA_TYPE_LABELS } from './agenda'
import { scorePersonName, type TeamMemberLite } from './assistantOtLookup'
import { allEquipements } from './cerfaBatch'

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

/** Mots vides FR — ne servent pas à la recherche. */
const STOP = new Set(
  normalize(
    `a au aux avec ce ces cet cette de des du elle en et eux il ils je la le les leur ma me mes moi mon
     ne nos notre nous on ou par pas pour qu que qui sa se ses son sur ta te tes toi ton tu un une vos
     votre vous y d l n s c qu est sont ai as a ont etait ete etre faire fait comment combien quel quelle
     quels quelles le la les mon ma mes ton ta tes son sa ses notre nos votre vos leur leurs
     reste rester effectuer clôturer cloturer afin fin mois aujourd hui demain hier semaine
     ouverts ouvert ouverte ouvertes encore doit doivent`,
  ).split(' '),
)

export function normalizeOtTypos(raw: string): string {
  return String(raw || '').replace(
    /\b(or|ot|ots|o\.t\.?|odi|int|ints|i\.n\.t\.?|di|dis|d\.i\.?)\b/gi,
    'INT',
  )
}

function monthPrefix(iso = todayIsoLocal()): string {
  return iso.slice(0, 7)
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

function otDate(o: OrdreTravail): string {
  return String(o.date || '').slice(0, 10)
}

function queryTokens(raw: string): string[] {
  const n = normalize(normalizeOtTypos(raw))
  return n
    .split(' ')
    .filter((t) => t.length >= 2 && !STOP.has(t) && !/^\d+$/.test(t))
}

function scoreText(haystack: string, tokens: string[]): number {
  const h = normalize(haystack)
  if (!h || !tokens.length) return 0
  let score = 0
  for (const t of tokens) {
    if (h === t) score += 100
    else if (h.includes(t)) score += 50
    else if (t.length >= 4 && h.split(' ').some((w) => w.startsWith(t) || t.startsWith(w))) score += 30
  }
  return score
}

export type OtStats = {
  total: number
  open: number
  closed: number
  byStatut: Record<string, number>
  openList: OrdreTravail[]
  closedList: OrdreTravail[]
}

function filterOtsMonth(ots: OrdreTravail[], ym: string): OrdreTravail[] {
  return ots.filter((o) => otDate(o).startsWith(ym))
}

export function computeOtStats(
  data: AppData,
  opts?: { monthYm?: string; dateIso?: string },
): OtStats {
  let scoped = data.ordresTravail || []
  if (opts?.monthYm) scoped = filterOtsMonth(scoped, opts.monthYm)
  if (opts?.dateIso) scoped = scoped.filter((o) => otDate(o) === opts.dateIso)
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

function formatOtBrief(o: OrdreTravail, data: AppData): string {
  const site = data.chantiers?.find((s) => s.id === o.chantierId)
  const client = data.clients?.find((c) => c.id === o.clientId)
  const where = [client ? clientDisplayName(client) : '', site?.nom].filter(Boolean).join(' · ')
  const type = TYPE_OT_LABELS[o.typeOt] || o.typeOt
  const st = STATUT_OT_LABELS[o.statut as StatutOt] || o.statut || '—'
  const heure = (o.heure || '').slice(0, 5)
  return `• ${formatOtNumero(o.numero)} — ${type}${o.astreinte ? ' · astreinte' : ''} · ${st}${heure ? ` · ${heure}` : ''} · ${otDate(o)}${
    o.technicien ? ` · ${o.technicien}` : ''
  }${where ? ` · ${where}` : ''} — ${(o.action || '').slice(0, 70)}`
}

export type SearchHit = { domain: string; score: number; line: string }

/**
 * Recherche libre multi-domaines : n’importe quels mots de la question.
 * C’est ça qui rend l’intelligence « ouverte » (pas un if par exemple).
 */
export function searchOrgData(
  data: AppData,
  raw: string,
  opts?: { team?: TeamMemberLite[]; max?: number },
): SearchHit[] {
  const tokens = queryTokens(raw)
  if (!tokens.length) return []
  const hits: SearchHit[] = []
  const push = (domain: string, score: number, line: string) => {
    if (score < 40) return
    hits.push({ domain, score, line })
  }

  for (const c of data.clients || []) {
    const label = clientDisplayName(c)
    const blob = `${label} ${c.ville || ''} ${c.telephone || ''} ${c.email || ''} ${c.siret || ''}`
    push('client', scoreText(blob, tokens), `Client « ${label} »${c.ville ? ` · ${c.ville}` : ''}`)
  }

  for (const s of data.chantiers || []) {
    const client = data.clients?.find((c) => c.id === s.clientId)
    const eqs = allEquipements(s)
      .slice(0, 6)
      .map((e) => e.nom || e.type || '')
      .filter(Boolean)
      .join(', ')
    const blob = `${s.nom} ${s.ville || ''} ${s.adresse || ''} ${eqs} ${client ? clientDisplayName(client) : ''}`
    push(
      'site',
      scoreText(blob, tokens),
      `Site « ${s.nom} »${client ? ` · client ${clientDisplayName(client)}` : ''}${eqs ? ` · éq. ${eqs}` : ''}`,
    )
  }

  for (const o of data.ordresTravail || []) {
    const site = data.chantiers?.find((s) => s.id === o.chantierId)
    const client = data.clients?.find((c) => c.id === o.clientId)
    const blob = [
      o.numero,
      o.action,
      o.technicien,
      o.typeOt,
      o.statut,
      site?.nom,
      client ? clientDisplayName(client) : '',
    ].join(' ')
    push('ot', scoreText(blob, tokens), formatOtBrief(o, data).replace(/^• /, 'INT '))
  }

  for (const p of data.piecesDetachees || []) {
    const blob = `${p.reference} ${p.designation} ${p.emplacement || ''}`
    push(
      'piece',
      scoreText(blob, tokens),
      `Pièce ${p.reference || '—'} — ${p.designation || ''} · stock ${p.quantite ?? 0}`,
    )
  }

  for (const cmd of data.commandesFournisseur || []) {
    const blob = `${cmd.libelle || ''} ${cmd.referencePiece || ''} ${cmd.fournisseur || ''} ${cmd.statut || ''}`
    push(
      'commande',
      scoreText(blob, tokens),
      `Commande « ${(cmd.libelle || cmd.referencePiece || '').slice(0, 60)} » · ${cmd.statut || '—'}`,
    )
  }

  for (const d of data.devis || []) {
    const client = data.clients?.find((c) => c.id === d.clientId)
    const blob = `${d.numero || ''} ${d.libelle || ''} ${d.statut || ''} ${client ? clientDisplayName(client) : ''}`
    push(
      'devis',
      scoreText(blob, tokens),
      `Devis ${d.numero || '—'} — ${(d.libelle || '').slice(0, 50)} · ${d.statut || '—'}`,
    )
  }

  for (const b of data.stock || []) {
    const blob = `${b.fluide} ${b.numeroContenant} ${b.surnom || ''} ${b.contenantType || ''}`
    const typeLabel = CONTENANT_TYPE_LABELS[b.contenantType] || b.contenantType
    push(
      'fluide',
      scoreText(blob, tokens),
      `Bouteille ${b.numeroContenant || b.surnom || '—'} · ${b.fluide} · ${typeLabel} · ${b.quantiteKg ?? 0} kg`,
    )
  }

  for (const ev of data.agendaEvents || []) {
    const blob = `${ev.title} ${ev.type} ${ev.technicien || ''} ${ev.notes || ''}`
    push(
      'agenda',
      scoreText(blob, tokens),
      `Agenda ${String(ev.date || '').slice(0, 10)} — ${AGENDA_TYPE_LABELS[ev.type] || ev.type} · ${ev.title}`,
    )
  }

  for (const det of data.detecteurs || []) {
    const blob = `${det.identification} ${det.assigneeName || ''}`
    push(
      'detecteur',
      scoreText(blob, tokens),
      `Détecteur ${det.identification}${det.assigneeName ? ` · ${det.assigneeName}` : ''}`,
    )
  }

  for (const m of opts?.team || []) {
    const blob = `${m.fullName || ''} ${m.email || ''}`
    const sc = Math.max(scoreText(blob, tokens), scorePersonName(m.fullName || '', tokens.join(' ')))
    push('tech', sc, `Tech « ${m.fullName || m.email || m.id} »`)
  }

  hits.sort((a, b) => b.score - a.score)
  const max = opts?.max ?? 35
  // dédoublonnage lignes
  const seen = new Set<string>()
  const out: SearchHit[] = []
  for (const h of hits) {
    if (seen.has(h.line)) continue
    seen.add(h.line)
    out.push(h)
    if (out.length >= max) break
  }
  return out
}

/**
 * Index GLOBAL injecté à chaque question OpenAI.
 * Totaux tous domaines + hits de recherche libre + listes utiles.
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
  const monthStats = computeOtStats(data, { monthYm: ym })
  const todayStats = computeOtStats(data, { dateIso: today })
  const allOpen = (data.ordresTravail || []).filter((o) => !isOtCloture(o.statut))
  const allOts = data.ordresTravail || []

  const lines: string[] = [
    '=== DONNÉES RÉELLES DE LA SOCIÉTÉ (accès TOTAL lecture — ne pas inventer) ===',
    `Date du jour : ${today}`,
    '',
    '— TOTAUX (tous domaines) —',
    `INT : ${allOts.length} au total · ${allOpen.length} ouvertes · ${monthStats.open} ouvertes en ${monthLabelFr(ym)} (${monthStats.closed} clôturées ce mois) · ${todayStats.open} ouvertes aujourd’hui`,
    `Clients : ${(data.clients || []).length} · Sites : ${(data.chantiers || []).length}`,
    `Devis : ${(data.devis || []).length} · Commandes fournisseur : ${(data.commandesFournisseur || []).length} · Factures : ${(data.factures || []).length}`,
    `Pièces détachées : ${(data.piecesDetachees || []).length} · Bouteilles fluide : ${(data.stock || []).length}`,
    `CERFA / interventions : ${(data.interventions || []).length} · Contrats : ${(data.contratsMaintenance || []).length}`,
    `Agenda : ${(data.agendaEvents || []).length} · Détecteurs : ${(data.detecteurs || []).length}`,
    `Fiches clim : ${(data.fichesMaintenanceClim || []).length} · Voitures : ${(data.voitures || []).length} · Outillages : ${(data.outillages || []).length}`,
  ]

  const names = (opts?.team || [])
    .map((m) => (m.fullName || '').trim())
    .filter(Boolean)
    .slice(0, 50)
  if (names.length) lines.push(`Équipe : ${names.join(' · ')}`)

  // Recherche libre selon la question → ouvre l’IA à N’IMPORTE quel exemple
  const q = (opts?.userQuery || '').trim()
  if (q) {
    const hits = searchOrgData(data, q, { team: opts?.team, max: 35 })
    lines.push('', `— RÉSULTATS RECHERCHE pour « ${q.slice(0, 120)} » —`)
    if (!hits.length) {
      lines.push('(aucun nom/réf. précis trouvé dans les libellés — s’appuyer sur les TOTAUX et listes ci-dessous)')
    } else {
      for (const h of hits) lines.push(`[${h.domain}] ${h.line}`)
    }
  }

  const maxOts = opts?.maxOpenOts ?? 50
  const openForPrompt = [...allOpen]
    .sort((a, b) => otDate(a).localeCompare(otDate(b)))
    .slice(0, maxOts)
  lines.push('', `— INT ouvertes (max ${maxOts}, total exact ${allOpen.length}) —`)
  if (!openForPrompt.length) lines.push('• (aucun)')
  for (const o of openForPrompt) lines.push(formatOtBrief(o, data))
  if (allOpen.length > maxOts) {
    lines.push(`… +${allOpen.length - maxOts} INT ouvertes non listées (filtrer par tech/date/client dans la recherche).`)
  }

  // Clients : si peu nombreux → tous ; sinon recherche + échantillon
  const maxC = opts?.maxClients ?? 80
  const clients = data.clients || []
  let picked = clients.slice(0, maxC)
  if (q && clients.length > maxC) {
    const tokens = queryTokens(q)
    const scored = clients
      .map((c) => ({ c, score: scoreText(clientDisplayName(c), tokens) }))
      .sort((a, b) => b.score - a.score)
    const top = scored.filter((x) => x.score >= 40).map((x) => x.c)
    const ids = new Set(top.map((c) => c.id))
    picked = [...top, ...clients.filter((c) => !ids.has(c.id))].slice(0, maxC)
  }

  lines.push('', `— Clients / sites (jusqu’à ${maxC} / ${clients.length}) —`)
  if (!picked.length) lines.push('(aucun client)')
  for (const c of picked) {
    const sites = (data.chantiers || []).filter((s) => s.clientId === c.id).slice(0, 12)
    lines.push(`- « ${clientDisplayName(c)} »`)
    for (const s of sites) lines.push(`  · Site « ${s.nom} »`)
  }
  if (clients.length > picked.length) {
    lines.push(`… +${clients.length - picked.length} clients — la RECHERCHE ci-dessus couvre les noms cités.`)
  }

  // Aperçu stock pièces (libellés) — le détail quantité vient aussi de la recherche
  const pieces = (data.piecesDetachees || []).slice(0, 25)
  if (pieces.length) {
    lines.push('', '— Stock pièces (aperçu) —')
    for (const p of pieces) {
      lines.push(`• ${p.reference || '—'} ${p.designation || ''} · qté ${p.quantite ?? 0}`)
    }
    if ((data.piecesDetachees || []).length > pieces.length) {
      lines.push(`… +${(data.piecesDetachees || []).length - pieces.length} pièces`)
    }
  }

  lines.push(
    '',
    'RÈGLES LECTURE :',
    '1) Tu as accès en lecture à TOUTES les données listées (totaux = exacts même si listes tronquées).',
    '2) Réponds à N’IMPORTE quelle question métier à partir de ce bloc + résultats recherche — pas besoin d’une formulation magique.',
    '3) « or » / « o.t » = INT. N’invente jamais un chiffre ni un nom absent.',
    '4) Écriture (créer/modifier) = proposition seulement, validation humaine « oui » obligatoire.',
  )

  return lines.join('\n')
}

/**
 * @deprecated Conservé pour tests / secours. Préférer OpenAI + buildLiveDataSnapshot (intelligence ouverte).
 */
export function wantsDataQuery(raw: string): boolean {
  const n = normalize(normalizeOtTypos(raw))
  if (!n) return false
  const mentionsOt = /\b(ot|int|ordre|ordres|intervention|interventions)\b/.test(n)
  const asksCount =
    /\b(combien|nombre|reste|rester|restent|encore|effectuer|clotur|finir|bilan|synthese|synth[eè]se)\b/.test(
      n,
    )
  return mentionsOt && asksCount
}

/** Secours local si OpenAI indisponible — bilan OT simple. */
export function answerDataQuery(data: AppData, raw: string, _team?: TeamMemberLite[]): string {
  const n = normalize(raw)
  const today = todayIsoLocal()
  const ym = monthPrefix(today)
  const wantMonth =
    /\b(mois|fin\s+de\s+mois)\b/.test(n) || /\b(clotur|reste|effectuer)\b/.test(n)
  const stats = wantMonth
    ? computeOtStats(data, { monthYm: ym })
    : computeOtStats(data, { dateIso: today })
  const label = wantMonth ? monthLabelFr(ym) : 'aujourd’hui'
  const lines = [
    `Sur ${label} : ${stats.open} INT encore ouverte${stats.open > 1 ? 's' : ''} à effectuer / clôturer` +
      (stats.total
        ? ` (sur ${stats.total} INT, dont ${stats.closed} déjà clôturée${stats.closed > 1 ? 's' : ''})`
        : '') +
      '.',
  ]
  if (stats.open) {
    lines.push('', 'INT ouvertes :')
    for (const o of stats.openList.slice(0, 20)) lines.push(formatOtBrief(o, data))
  }
  return lines.join('\n')
}
