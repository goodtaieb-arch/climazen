/**
 * Lola / assistant — retrouver un OT par tech (sans déformer le nom) + guide décaler/déplacer.
 */

import type { AppData } from './types'
import {
  formatOtNumero,
  isOtCloture,
  techIdsOt,
  TYPE_OT_LABELS,
  type OrdreTravail,
} from './ordreTravail'
import { todayIsoLocal, addDaysToIso } from './agenda'

export type TeamMemberLite = {
  id: string
  fullName?: string
  email?: string
}

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

/** Corrige fautes fréquentes de date dictée. */
export function resolveRelativeDate(raw: string, today = todayIsoLocal()): string | null {
  const n = normalize(raw)
  if (!n) return null
  // aujourd'hui (fautes : aujourdhui, auauiujourdhui, auj…)
  if (/auj|aujour|auiujour|auauiujour/.test(n) || /\baujourd\s*hui\b/.test(n)) return today
  if (/\bdemain\b/.test(n)) return addDaysToIso(today, 1)
  if (/\bapres\s*demain\b/.test(n)) return addDaysToIso(today, 2)
  if (/\bhier\b/.test(n)) return addDaysToIso(today, -1)
  const iso = raw.match(/\b(20\d{2}-\d{2}-\d{2})\b/)
  if (iso) return iso[1]
  const fr = raw.match(/\b(\d{1,2})[./\-](\d{1,2})(?:[./\-](\d{2,4}))?\b/)
  if (fr) {
    let y = fr[3] ? Number(fr[3]) : Number(today.slice(0, 4))
    if (y < 100) y += 2000
    const m = String(Number(fr[2])).padStart(2, '0')
    const d = String(Number(fr[1])).padStart(2, '0')
    return `${y}-${m}-${d}`
  }
  return null
}

/**
 * Extrait le nom tech depuis « OT de Karim benali… », « pour Karim… ».
 * Ne « corrige » pas le nom — renvoie tel quel (hors stopwords).
 */
export function extractTechNameQuery(raw: string): string {
  const t = String(raw || '').trim()
  const patterns = [
    /(?:ot|ordre|intervention)\s+(?:de|du|pour)\s+([A-Za-zÀ-ÿ'’\-]+(?:\s+[A-Za-zÀ-ÿ'’\-]+){0,3})/i,
    /(?:decaler|d[eé]caler|deplacer|d[eé]placer|retire|retirer|enleve|enlever)\s+(?:l['’])?(?:ot|ordre)?\s*(?:de|du|pour)?\s*([A-Za-zÀ-ÿ'’\-]+(?:\s+[A-Za-zÀ-ÿ'’\-]+){0,3})/i,
    /(?:tech|technicien)\s+([A-Za-zÀ-ÿ'’\-]+(?:\s+[A-Za-zÀ-ÿ'’\-]+){0,3})/i,
  ]
  for (const re of patterns) {
    const m = t.match(re)
    if (!m?.[1]) continue
    let name = m[1]
      .replace(
        /\b(de|du|des|la|le|les|a|au|aux|aujourd|aujourdhui|demain|hier|decale|decaler|deplace|deplacer|ot|ordre)\b/gi,
        ' ',
      )
      .replace(/\s+/g, ' ')
      .trim()
    // Couper avant date / verbe
    name = name.split(/\b(?:de\s+auj|auj|demain|hier|decale|deplace|vers|a\s+\d)/i)[0].trim()
    if (name.length >= 3) return name
  }
  return ''
}

export function scorePersonName(candidate: string, query: string): number {
  const c = normalize(candidate)
  const q = normalize(query)
  if (!c || !q) return 0
  if (c === q) return 100
  if (c.includes(q) || q.includes(c)) return 90
  const cq = c.split(' ').filter(Boolean)
  const qq = q.split(' ').filter(Boolean)
  if (!qq.length) return 0
  // Chaque token query doit matcher un token candidat (préfixe OK : benali ~ ben)
  let hits = 0
  for (const token of qq) {
    if (token.length < 2) continue
    const ok = cq.some(
      (ct) => ct === token || ct.startsWith(token) || token.startsWith(ct) || levenshtein(ct, token) <= 1,
    )
    if (ok) hits += 1
  }
  const ratio = hits / qq.length
  if (ratio >= 1) return 85
  if (ratio >= 0.66) return 70
  if (ratio >= 0.5 && qq.length >= 2) return 55
  return Math.round(ratio * 50)
}

function levenshtein(a: string, b: string): number {
  if (a === b) return 0
  if (!a.length) return b.length
  if (!b.length) return a.length
  const row = Array.from({ length: b.length + 1 }, (_, i) => i)
  for (let i = 0; i < a.length; i++) {
    let prev = i + 1
    for (let j = 0; j < b.length; j++) {
      const cur = a[i] === b[j] ? row[j] : 1 + Math.min(row[j], row[j + 1], prev)
      row[j] = prev
      prev = cur
    }
    row[b.length] = prev
  }
  return row[b.length]
}

export function matchTechInTeam(
  query: string,
  team: TeamMemberLite[] | undefined,
): { member: TeamMemberLite; score: number }[] {
  const q = query.trim()
  if (!q) return []
  return (team || [])
    .map((m) => ({
      member: m,
      score: Math.max(
        scorePersonName(m.fullName || '', q),
        scorePersonName((m.fullName || '').split(/\s+/).slice(-2).join(' '), q),
        scorePersonName(m.email || '', q),
      ),
    }))
    .filter((x) => x.score >= 55)
    .sort((a, b) => b.score - a.score)
}

/** Techs cités sur les OT (nom stocké) en plus de l’équipe. */
export function techsFromOts(data: AppData): TeamMemberLite[] {
  const map = new Map<string, TeamMemberLite>()
  for (const o of data.ordresTravail || []) {
    for (const id of techIdsOt(o)) {
      if (!map.has(id)) {
        map.set(id, {
          id,
          fullName: o.technicienUserId === id ? o.technicien : undefined,
        })
      }
    }
    if (o.technicienUserId && o.technicien) {
      const cur = map.get(o.technicienUserId)
      if (cur && !cur.fullName) cur.fullName = o.technicien
    }
  }
  return [...map.values()]
}

export function findOtsForTechOnDate(
  data: AppData,
  opts: {
    techUserId?: string
    techNameQuery?: string
    dateIso?: string
    includeClotures?: boolean
  },
): OrdreTravail[] {
  const day = (opts.dateIso || '').slice(0, 10)
  const nameQ = normalize(opts.techNameQuery || '')
  return (data.ordresTravail || []).filter((o) => {
    if (!opts.includeClotures && isOtCloture(o.statut)) return false
    if (day && String(o.date || '').slice(0, 10) !== day) return false
    if (opts.techUserId) {
      return techIdsOt(o).includes(opts.techUserId)
    }
    if (nameQ) {
      const label = normalize(o.technicien || '')
      if (scorePersonName(label, nameQ) >= 55) return true
      return false
    }
    return false
  })
}

export function wantsOtDeplacerOuDecaler(raw: string): boolean {
  const n = normalize(raw)
  if (!n) return false
  const move =
    /\b(decal|deplac|retirer?\s+(?:l )?ot|enlev|boug|replan|remet)\w*\b/.test(n) ||
    /\bot\b.*\b(decal|deplac|vers|a )\b/.test(n) ||
    /\bde\s+\d{1,2}\s*[h:.]?\s*\d{0,2}\s*(?:a|vers)\s+\d{1,2}/.test(n)
  if (!move) return false
  return (
    /\b(ot|ordre|intervention|planning|agenda)\b/.test(n) ||
    /\b(de|du|pour)\s+[a-z]/.test(n) ||
    Boolean(extractTechNameQuery(raw)) ||
    Boolean(extractDecalerHeures(raw).to)
  )
}

/** Parse 7h / 7h00 / 07:00 / 7.00 → HH:mm */
export function parseHeureToken(h: string, m?: string): string {
  const hh = Math.min(23, Math.max(0, Number(h) || 0))
  const mm = m != null && m !== '' ? Math.min(59, Math.max(0, Number(m) || 0)) : 0
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`
}

/**
 * « de 7h à 9h », « de 7:00 a 09:00 », « à 9h », « vers 9h30 ».
 */
export function extractDecalerHeures(raw: string): { from?: string; to?: string } {
  const t = String(raw || '')
  const range = t.match(
    /\bde\s+(\d{1,2})\s*[h:.]?\s*(\d{2})?\s*(?:à|a|vers)\s+(\d{1,2})\s*[h:.]?\s*(\d{2})?/i,
  )
  if (range) {
    return {
      from: parseHeureToken(range[1], range[2]),
      to: parseHeureToken(range[3], range[4]),
    }
  }
  const toOnly = t.match(
    /\b(?:passe[rz]?|mets?|mettre|remets?|remettre|pose[rz]?)\s+(?:l['’])?(?:ot|ordre)?\s*(?:a|à|vers)\s+(\d{1,2})\s*[h:.]?\s*(\d{2})?/i,
  ) || t.match(/\b(?:a|à|vers)\s+(\d{1,2})\s*[h:.]?\s*(\d{2})?\b/i)
  if (toOnly) {
    return { to: parseHeureToken(toOnly[1], toOnly[2]) }
  }
  return {}
}

export function extractOtNumeroQuery(raw: string): string {
  const m =
    String(raw || '').match(/\bot\s*[-#:]?\s*(\d{6,})\b/i) ||
    String(raw || '').match(/\b(\d{8})\b/)
  return m?.[1] || ''
}

function heureMatches(otHeure: string | undefined, wanted: string): boolean {
  const a = (otHeure || '').slice(0, 5)
  const b = wanted.slice(0, 5)
  if (!a || !b) return false
  return a === b
}

export type DecalerOtProposal =
  | {
      ok: true
      action: {
        kind: 'decaler_ot'
        otId: string
        otNumero: string
        heureFrom: string
        heureTo: string
        date: string
        summary: string
      }
    }
  | { ok: false; message: string }

/**
 * Propose un décalage d’heure d’OT (validation « oui » ensuite).
 * Ne navigue PAS vers le formulaire OT — uniquement Agenda après confirmation.
 */
export function proposeDecalerOt(
  data: AppData,
  raw: string,
  team: TeamMemberLite[] | undefined,
): DecalerOtProposal {
  const heures = extractDecalerHeures(raw)
  if (!heures.to) {
    return {
      ok: false,
      message: [
        `Pour décaler un OT, indiquez l’heure cible (ex. « décale l’OT de 7h à 9h » ou « OT de Karim à 9h »).`,
        `Puis répondez « oui » — je change l’heure sur l’Agenda, sans ouvrir la fiche OT.`,
      ].join('\n'),
    }
  }

  const dateIso = resolveRelativeDate(raw) || todayIsoLocal()
  const dateLabel =
    dateIso === todayIsoLocal()
      ? 'aujourd’hui'
      : dateIso === addDaysToIso(todayIsoLocal(), 1)
        ? 'demain'
        : dateIso
  const numeroQ = extractOtNumeroQuery(raw)
  const nameQuery = extractTechNameQuery(raw)

  let candidates = (data.ordresTravail || []).filter((o) => !isOtCloture(o.statut))

  if (numeroQ) {
    candidates = candidates.filter(
      (o) =>
        String(o.numero || '').includes(numeroQ) ||
        formatOtNumero(o.numero).replace(/\s/g, '').includes(numeroQ),
    )
  } else {
    candidates = candidates.filter((o) => String(o.date || '').slice(0, 10) === dateIso)
  }

  if (heures.from) {
    const atFrom = candidates.filter((o) => heureMatches(o.heure, heures.from!))
    if (atFrom.length) candidates = atFrom
  }

  if (nameQuery) {
    const roster = [...(team || []), ...techsFromOts(data)]
    const byId = new Map<string, TeamMemberLite>()
    for (const m of roster) {
      if (!m.id) continue
      const prev = byId.get(m.id)
      byId.set(m.id, {
        id: m.id,
        fullName: m.fullName || prev?.fullName,
        email: m.email || prev?.email,
      })
    }
    const matches = matchTechInTeam(nameQuery, [...byId.values()])
    if (matches.length) {
      const techId = matches[0].member.id
      const byTech = candidates.filter((o) => techIdsOt(o).includes(techId))
      if (byTech.length) candidates = byTech
      else {
        const byName = candidates.filter(
          (o) => scorePersonName(o.technicien || '', nameQuery) >= 55,
        )
        if (byName.length) candidates = byName
      }
    }
  }

  // Si pas de « de Xh » mais un seul OT du tech/jour → on le prend
  if (!heures.from && candidates.length > 1 && nameQuery) {
    // garder tous — ambigu
  }

  if (!candidates.length) {
    return {
      ok: false,
      message: [
        `Aucun OT ouvert trouvé${heures.from ? ` à ${heures.from}` : ''} pour ${dateLabel}${
          nameQuery ? ` (${nameQuery})` : ''
        }.`,
        `Ex. : « décale l’OT de 7h à 9h » ou « OT de Karim Benali de 7h à 9h ».`,
      ].join('\n'),
    }
  }

  if (candidates.length > 1) {
    const lines = [
      `Plusieurs OT possibles — précisez le n° ou le tech :`,
      ``,
      ...candidates.slice(0, 6).map((o) => formatOtLine(o, data.chantiers, data.clients)),
      ``,
      `Ex. : « décale OT${candidates[0].numero} à ${heures.to} ».`,
    ]
    return { ok: false, message: lines.join('\n') }
  }

  const ot = candidates[0]
  const heureFrom = (ot.heure || '').slice(0, 5) || heures.from || '—'
  if (heureFrom === heures.to) {
    return {
      ok: false,
      message: `${formatOtNumero(ot.numero)} est déjà à ${heures.to}.`,
    }
  }

  const site = data.chantiers?.find((s) => s.id === ot.chantierId)
  const summary = [
    `Je propose de décaler l’heure (pas d’ouverture de fiche OT) :`,
    `• ${formatOtNumero(ot.numero)} — ${(ot.action || '').slice(0, 70)}`,
    site?.nom ? `• Site : ${site.nom}` : null,
    ot.technicien ? `• Tech : ${ot.technicien}` : null,
    `• ${heureFrom} → ${heures.to} (${dateLabel})`,
    ``,
    `Répondez « oui » pour appliquer sur l’Agenda, ou « non » pour annuler.`,
  ]
    .filter(Boolean)
    .join('\n')

  return {
    ok: true,
    action: {
      kind: 'decaler_ot',
      otId: ot.id,
      otNumero: ot.numero,
      heureFrom,
      heureTo: heures.to,
      date: String(ot.date || dateIso).slice(0, 10),
      summary,
    },
  }
}

export function wantsOtLookup(raw: string): boolean {
  const n = normalize(raw)
  if (!n) return false
  if (wantsOtDeplacerOuDecaler(raw)) return true
  return (
    /\b(ot|ordre)\b/.test(n) &&
    (/\b(de|du|pour)\s+[a-z]/.test(n) || /\btrouve|cherche|quel|montre|affiche\b/.test(n))
  )
}

function formatOtLine(
  o: OrdreTravail,
  sites: AppData['chantiers'],
  clients: AppData['clients'],
): string {
  const site = sites?.find((s) => s.id === o.chantierId)
  const client = clients?.find((c) => c.id === o.clientId)
  const where = [client?.raisonSociale || client?.nom, site?.nom].filter(Boolean).join(' · ')
  const type = TYPE_OT_LABELS[o.typeOt] || o.typeOt
  const heure = (o.heure || '').slice(0, 5)
  return `• ${formatOtNumero(o.numero)} — ${type}${heure ? ` · ${heure}` : ''} — ${(o.action || '').slice(0, 80)}${
    where ? ` · ${where}` : ''
  }`
}

/**
 * Réponse locale intelligente : retrouve le tech EXACT dans l’équipe,
 * liste ses OT du jour, explique comment décaler (sans inventer de nom).
 */
export function answerOtLookupOuDeplacer(
  data: AppData,
  raw: string,
  team: TeamMemberLite[] | undefined,
): string {
  const nameQuery = extractTechNameQuery(raw)
  const dateIso = resolveRelativeDate(raw) || todayIsoLocal()
  const dateLabel =
    dateIso === todayIsoLocal()
      ? 'aujourd’hui'
      : dateIso === addDaysToIso(todayIsoLocal(), 1)
        ? 'demain'
        : dateIso

  const roster = [...(team || []), ...techsFromOts(data)]
  // dédoublonnage id
  const byId = new Map<string, TeamMemberLite>()
  for (const m of roster) {
    if (!m.id) continue
    const prev = byId.get(m.id)
    byId.set(m.id, {
      id: m.id,
      fullName: m.fullName || prev?.fullName,
      email: m.email || prev?.email,
    })
  }
  const merged = [...byId.values()]

  if (!nameQuery) {
    return [
      `Pour décaler / retrouver un OT, donnez le tech tel qu’il est dans l’équipe (ex. « OT de Karim Benali aujourd’hui »).`,
      `Je ne change jamais un nom : je cherche uniquement dans l’équipe et les OT.`,
      ``,
      `Sur l’Agenda : recliquer le bloc = déplacer ; croix rouge = retirer du tech.`,
    ].join('\n')
  }

  const matches = matchTechInTeam(nameQuery, merged)
  if (!matches.length) {
    const suggestions = merged
      .map((m) => m.fullName || '')
      .filter(Boolean)
      .slice(0, 8)
    return [
      `Je ne trouve personne correspondant à « ${nameQuery} » dans l’équipe (je n’ai pas modifié ce nom).`,
      suggestions.length ? `Techs connus : ${suggestions.join(', ')}` : `Aucun tech listé pour l’instant.`,
      `Réessayez avec le nom exact de l’Agenda / Équipe.`,
    ].join('\n')
  }

  const best = matches[0]
  // Toujours renvoyer le nom OFFICIEL du catalogue — jamais une « correction » inventée
  const officialName = (best.member.fullName || nameQuery).trim()
  const ots = findOtsForTechOnDate(data, {
    techUserId: best.member.id,
    dateIso,
  })
  // Aussi chercher sans filtre date si vide (OT planifié autre jour)
  const otsAny =
    ots.length > 0
      ? ots
      : findOtsForTechOnDate(data, { techUserId: best.member.id }).slice(0, 5)

  const wantsMove = wantsOtDeplacerOuDecaler(raw)
  const lines: string[] = []

  if (normalize(officialName) !== normalize(nameQuery)) {
    lines.push(`Tech reconnu dans l’équipe : ${officialName} (vous avez dit « ${nameQuery} » — je garde le nom officiel).`)
  } else {
    lines.push(`Tech : ${officialName}`)
  }

  if (ots.length) {
    lines.push(``, `OT de ${officialName} pour ${dateLabel} :`)
    for (const o of ots) lines.push(formatOtLine(o, data.chantiers, data.clients))
  } else if (otsAny.length) {
    lines.push(
      ``,
      `Aucun OT pour ${dateLabel}. OT ouverts de ${officialName} (autres jours) :`,
    )
    for (const o of otsAny) {
      lines.push(
        `${formatOtLine(o, data.chantiers, data.clients)} · date ${String(o.date || '').slice(0, 10)}`,
      )
    }
  } else {
    lines.push(``, `Aucun OT ouvert trouvé pour ${officialName}.`)
  }

  if (wantsMove) {
    const heures = extractDecalerHeures(raw)
    if (heures.to) {
      lines.push(
        ``,
        `Indiquez clairement « de ${heures.from || 'Xh'} à ${heures.to} » avec le tech ou le n° OT — je proposerai le décalage, puis « oui » applique l’heure sur l’Agenda (sans ouvrir la fiche).`,
      )
    } else {
      lines.push(
        ``,
        `Pour décaler sans perdre de temps : « décale l’OT de ${officialName} de 7h à 9h » → je propose, vous dites « oui », l’heure change sur l’Agenda.`,
        `Croix rouge Agenda = retirer du tech (pas supprimer l’OT).`,
      )
    }
  }

  if (matches.length > 1) {
    lines.push(
      ``,
      `Autres correspondances : ${matches
        .slice(1, 4)
        .map((m) => m.member.fullName)
        .filter(Boolean)
        .join(', ')}`,
    )
  }

  return lines.join('\n')
}

/** Bloc contexte techs + OT du jour pour OpenAI. */
export function buildOtTeamCatalog(
  data: AppData,
  team: TeamMemberLite[] | undefined,
  max = 30,
): string {
  const today = todayIsoLocal()
  const names = (team || [])
    .map((m) => (m.fullName || '').trim())
    .filter(Boolean)
    .slice(0, max)
  const ots = (data.ordresTravail || [])
    .filter((o) => !isOtCloture(o.statut) && String(o.date || '').slice(0, 10) === today)
    .slice(0, max)
  const lines = [
    'RÈGLE NOMS : ne jamais inventer ni déformer un nom. Copier EXACTEMENT depuis cette liste ou le message utilisateur.',
    `Équipe (noms officiels) : ${names.length ? names.join(' · ') : '(vide)'}`,
    `OT ouverts aujourd’hui (${today}) :`,
  ]
  if (!ots.length) lines.push('• (aucun)')
  for (const o of ots) {
    lines.push(
      `• ${formatOtNumero(o.numero)} · tech=${o.technicien || techIdsOt(o).join(',') || '—'} · ${(o.action || '').slice(0, 60)} · ${o.heure || 'sans heure'}`,
    )
  }
  return lines.join('\n')
}
