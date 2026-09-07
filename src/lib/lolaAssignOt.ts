/**
 * Lola — affecter des INT aux techs (planning agenda).
 * Un lot complet, sans « oui » à chaque ligne : validation humaine sur Accueil
 * (bouton par tech + par INT). Chaque tech reste dans son secteur.
 */

import type { AppData } from './types'
import { clientDisplayName } from './types'
import {
  compareOtPrioritePlanning,
  formatOtNumero,
  isOtCloture,
  syncTechsOt,
  techIdsOt,
  TYPE_OT_LABELS,
  type OrdreTravail,
} from './ordreTravail'
import {
  dureeMinutesOt,
  otSansCreneau,
  premiereHeureLibre,
  techEstIndispo,
} from './agendaPlanning'
import { resolveRelativeDate } from './assistantOtLookup'
import { todayIsoLocal } from './agenda'
import {
  dossierForUser,
  type PersonnelDossier,
} from './rhDocuments'
import {
  isPosteTerrain,
  labelSecteurCourt,
  parsePostePersonnel,
  secteurOtDepuisPoste,
  type PostePersonnelId,
} from './postePersonnel'
import type { TeamMemberLite } from './assistantOtLookup'

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

export type AiAssignOtSlot = {
  otId: string
  otNumero: string
  otAction: string
  typeOt?: string
  clientLabel?: string
  siteLabel?: string
  techUserId: string
  techName: string
  secteur?: PostePersonnelId
  date: string
  heure: string
  dureeMinutes: number
}

export type AssignOtsIntent = {
  perTech: number
  dateIso: string
  /** Toujours true sauf demande explicite d’ignorer le métier. */
  keepSecteur: boolean
}

export type AssignOtsPlan = {
  ok: true
  intent: AssignOtsIntent
  slots: AiAssignOtSlot[]
  /** Techs terrain sans créneau (indispo, pas d’INT du secteur…). */
  skippedTechs: { techName: string; reason: string }[]
  leftoverOtCount: number
  summary: string
}

export type AssignOtsFail = {
  ok: false
  message: string
}

/**
 * « Affecte 2 INT à chaque tech », « pose 2 inter par technicien »,
 * « répartis les interventions, sans bouger le tech de son secteur ».
 */
export function wantsAssignOts(raw: string): boolean {
  const n = normalize(raw)
  if (!n) return false
  const ints = /\b(int|inter|intervention|interventions|ot|ordre)\b/.test(n)
  if (!ints) return false
  const parTech =
    /\b(chaque\s+tech|chaque\s+technicien|par\s+tech|par\s+technicien|tous\s+les\s+techs|a\s+chaque)\b/.test(
      n,
    )
  const verb =
    /\b(affecte|affecter|attribue|attribuer|reparti|repartir|repartis|repartit|pose|poser|planifie|planifier|donne|donner)\b/.test(
      n,
    )
  if (parTech && (verb || /\b\d+\b/.test(n))) return true
  if (verb && /\b(tech|technicien)/.test(n) && ints) return true
  return false
}

export function parseAssignOtsIntent(
  raw: string,
  today = todayIsoLocal(),
): AssignOtsIntent | null {
  if (!wantsAssignOts(raw)) return null
  const n = normalize(raw)
  let perTech = 2
  const m =
    n.match(/\b(\d{1,2})\s*(?:int|inter|intervention)/) ||
    n.match(/\b(\d{1,2})\s*(?:par|a chaque|pour chaque)\s*(?:tech|technicien)/) ||
    n.match(/(?:chaque|par)\s*(?:tech|technicien)\s*(\d{1,2})/)
  if (m) perTech = Math.min(12, Math.max(1, Number(m[1])))
  const ignoreSecteur = /\b(n.?importe\s+quel\s+secteur|ignore\s+le\s+secteur|tous\s+secteurs)\b/.test(
    n,
  )
  return {
    perTech,
    dateIso: resolveRelativeDate(raw, today) || today,
    keepSecteur: !ignoreSecteur,
  }
}

function secteurOfTech(
  dossiers: PersonnelDossier[] | undefined,
  techId: string,
): PostePersonnelId | undefined {
  const poste = dossierForUser(dossiers, techId)?.poste
  return secteurOtDepuisPoste(poste)
}

function secteurOfOt(
  ot: OrdreTravail,
  dossiers: PersonnelDossier[] | undefined,
): PostePersonnelId | undefined {
  if (ot.secteur && isPosteTerrain(ot.secteur)) return parsePostePersonnel(ot.secteur)
  const fromTech = secteurOtDepuisPoste(
    dossierForUser(dossiers, ot.technicienUserId)?.poste,
  )
  return fromTech
}

function isTerrainTech(
  member: TeamMemberLite,
  dossiers: PersonnelDossier[] | undefined,
): boolean {
  return isPosteTerrain(dossierForUser(dossiers, member.id)?.poste)
}

function otDisponiblePourTech(
  ot: OrdreTravail,
  techId: string,
  techSecteur: PostePersonnelId | undefined,
  keepSecteur: boolean,
  dossiers: PersonnelDossier[] | undefined,
): boolean {
  if (isOtCloture(ot.statut)) return false
  if (!otSansCreneau(ot)) return false
  const assigned = techIdsOt(ot)
  if (assigned.length > 0 && !assigned.includes(techId)) return false
  if (keepSecteur && techSecteur) {
    const otSec = secteurOfOt(ot, dossiers)
    if (otSec && otSec !== techSecteur) return false
  }
  return true
}

function heureLibrePourTech(opts: {
  data: AppData
  techId: string
  dateIso: string
  dureeMinutes: number
  reserved: AiAssignOtSlot[]
}): string {
  const day = opts.dateIso.slice(0, 10)
  const occupied: Array<{ heure?: string; dureeMinutes?: number | null }> = []
  for (const o of opts.data.ordresTravail || []) {
    if (isOtCloture(o.statut)) continue
    if (String(o.date || '').slice(0, 10) !== day) continue
    if (!techIdsOt(o).includes(opts.techId)) continue
    if (!(o.heure || '').trim()) continue
    occupied.push({ heure: o.heure, dureeMinutes: dureeMinutesOt(o) })
  }
  for (const s of opts.reserved) {
    if (s.techUserId !== opts.techId) continue
    if (s.date !== day) continue
    occupied.push({ heure: s.heure, dureeMinutes: s.dureeMinutes })
  }
  const h = premiereHeureLibre({
    occupied,
    dureeMinutes: opts.dureeMinutes,
    preferH: 8,
  })
  return `${String(h).padStart(2, '0')}:00`
}

export function planAssignOts(opts: {
  data: AppData
  team: TeamMemberLite[]
  intent: AssignOtsIntent
}): AssignOtsPlan | AssignOtsFail {
  const dossiers = opts.data.personnelDossiers
  const retired = new Set(opts.data.personnelRetiresUserIds || [])
  const techs = (opts.team || []).filter(
    (t) => t.id && !retired.has(t.id) && isTerrainTech(t, dossiers),
  )
  if (techs.length === 0) {
    return {
      ok: false,
      message:
        'Aucun technicien terrain (poste CVC / frigo / multi…) dans Équipe. Renseignez les postes, puis redemandez.',
    }
  }

  const pool = [...(opts.data.ordresTravail || [])]
    .filter((o) => !isOtCloture(o.statut) && otSansCreneau(o))
    .sort(compareOtPrioritePlanning)
  if (pool.length === 0) {
    return {
      ok: false,
      message:
        'Aucune INT à poser (sans créneau) dans l’agenda. Créez des interventions ou retirez l’heure d’une INT (croix rouge).',
    }
  }

  const usedOt = new Set<string>()
  const slots: AiAssignOtSlot[] = []
  const skippedTechs: { techName: string; reason: string }[] = []
  const clients = opts.data.clients || []
  const sites = opts.data.chantiers || []

  for (const tech of techs) {
    const techName = (tech.fullName || tech.email || 'Technicien').trim()
    const techSecteur = secteurOfTech(dossiers, tech.id)
    if (opts.intent.keepSecteur && !techSecteur) {
      skippedTechs.push({
        techName,
        reason: 'pas de poste terrain (secteur) dans Équipe',
      })
      continue
    }
    if (techEstIndispo(opts.data.agendaEvents, tech.id, opts.intent.dateIso)) {
      skippedTechs.push({
        techName,
        reason: 'absent / indisponible ce jour',
      })
      continue
    }

    let taken = 0
    for (const ot of pool) {
      if (taken >= opts.intent.perTech) break
      if (usedOt.has(ot.id)) continue
      if (
        !otDisponiblePourTech(
          ot,
          tech.id,
          techSecteur,
          opts.intent.keepSecteur,
          dossiers,
        )
      ) {
        continue
      }
      const date = (ot.date || '').slice(0, 10) || opts.intent.dateIso
      if (techEstIndispo(opts.data.agendaEvents, tech.id, date)) continue
      const duree = dureeMinutesOt(ot)
      const heure = heureLibrePourTech({
        data: opts.data,
        techId: tech.id,
        dateIso: date,
        dureeMinutes: duree,
        reserved: slots,
      })
      const client = clients.find((c) => c.id === ot.clientId)
      const site = sites.find((s) => s.id === ot.chantierId)
      slots.push({
        otId: ot.id,
        otNumero: ot.numero,
        otAction: (ot.action || TYPE_OT_LABELS[ot.typeOt] || 'INT').slice(0, 120),
        typeOt: ot.typeOt,
        clientLabel: client ? clientDisplayName(client) : undefined,
        siteLabel: site?.nom,
        techUserId: tech.id,
        techName,
        secteur: techSecteur || secteurOfOt(ot, dossiers),
        date,
        heure,
        dureeMinutes: duree,
      })
      usedOt.add(ot.id)
      taken += 1
    }
    if (taken === 0) {
      skippedTechs.push({
        techName,
        reason: techSecteur
          ? `pas d’INT à poser dans le secteur ${labelSecteurCourt(techSecteur)}`
          : 'pas d’INT à poser',
      })
    }
  }

  if (slots.length === 0) {
    const why = skippedTechs.map((s) => `${s.techName} (${s.reason})`).join(' · ')
    return {
      ok: false,
      message: why
        ? `Impossible d’affecter : ${why}. Je ne déplace pas un tech hors de son secteur.`
        : 'Impossible d’affecter des INT (secteur / indispo).',
    }
  }

  const leftoverOtCount = pool.filter((o) => !usedOt.has(o.id)).length
  const byTech = new Map<string, AiAssignOtSlot[]>()
  for (const s of slots) {
    const list = byTech.get(s.techUserId) || []
    list.push(s)
    byTech.set(s.techUserId, list)
  }
  const lines = [
    `J’ai préparé ${slots.length} INT pour ${byTech.size} tech${byTech.size > 1 ? 's' : ''} (${opts.intent.perTech} par tech, chacun reste dans son secteur).`,
    `Rien n’est encore écrit sur l’agenda — validez sur Accueil : un bouton par tech et un bouton par INT.`,
    '',
  ]
  for (const group of byTech.values()) {
    const t = group[0]
    const sec = t.secteur ? ` · ${labelSecteurCourt(t.secteur)}` : ''
    lines.push(`• ${t.techName}${sec}`)
    for (const s of group) {
      lines.push(
        `  — ${formatOtNumero(s.otNumero)} ${s.otAction} · ${s.date} ${s.heure}${
          s.siteLabel ? ` · ${s.siteLabel}` : ''
        }`,
      )
    }
  }
  if (skippedTechs.length) {
    lines.push('', 'Non servis :')
    for (const s of skippedTechs) lines.push(`• ${s.techName} — ${s.reason}`)
  }
  if (leftoverOtCount) {
    lines.push('', `${leftoverOtCount} INT restent à poser (autre secteur ou plus de créneau).`)
  }

  return {
    ok: true,
    intent: opts.intent,
    slots,
    skippedTechs,
    leftoverOtCount,
    summary: lines.join('\n'),
  }
}

/** Applique un créneau si l’INT n’est pas déjà calée sur un autre tech. */
export function applyAssignOtSlot(
  ot: OrdreTravail,
  slot: AiAssignOtSlot,
): OrdreTravail {
  const assigned = techIdsOt(ot)
  if ((ot.heure || '').trim() && assigned.length && !assigned.includes(slot.techUserId)) {
    return ot
  }
  const synced = syncTechsOt({
    technicienUserIds: [slot.techUserId],
    noms: { [slot.techUserId]: slot.techName },
    technicien: slot.techName,
  })
  return {
    ...ot,
    date: slot.date,
    heure: slot.heure,
    dureeMinutes: slot.dureeMinutes,
    secteur: slot.secteur || ot.secteur,
    ...synced,
  }
}

export function applyAssignOtSlots(
  ots: OrdreTravail[] | undefined,
  slots: AiAssignOtSlot[],
): { ots: OrdreTravail[]; applied: number } {
  const byId = new Map(slots.map((s) => [s.otId, s]))
  let applied = 0
  const next = (ots || []).map((ot) => {
    const slot = byId.get(ot.id)
    if (!slot) return ot
    const patched = applyAssignOtSlot(ot, slot)
    if (patched !== ot && patched.heure === slot.heure && patched.technicienUserId === slot.techUserId) {
      applied += 1
    }
    return patched
  })
  return { ots: next, applied }
}

export function summarizeAssignSlotsForInbox(slots: AiAssignOtSlot[]): string {
  return slots
    .map(
      (s) =>
        `${formatOtNumero(s.otNumero)} → ${s.techName} · ${s.date} ${s.heure}${
          s.secteur ? ` · ${labelSecteurCourt(s.secteur)}` : ''
        }`,
    )
    .join('\n')
}
