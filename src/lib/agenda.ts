/** Agenda terrain — rappels maintenance / contrôles pour contacter les clients. */

import type { PeriodiciteContrat, ContratMaintenance } from './contratMaintenance'
import { isContratActif } from './contratMaintenance'
import { addMonthsIso } from './siteParc'

export type AgendaEventType =
  | 'maintenance'
  | 'controle_etancheite'
  | 'rdv'
  | 'rappel_appel'
  | 'autre'
  | 'deplacement_hors_ot'
  | 'bureau_atelier'
  | 'fournisseur'
  | 'pause_repas'
  | 'formation'
  | 'rdv_garage'
  | 'hors_ot_libre'

export const AGENDA_TYPE_LABELS: Record<AgendaEventType, string> = {
  maintenance: 'Maintenance',
  controle_etancheite: 'Contrôle étanchéité',
  rdv: 'Intervention / RDV',
  rappel_appel: 'Rappel appel client',
  autre: 'Autre',
  deplacement_hors_ot: 'Déplacement hors OT',
  bureau_atelier: 'Bureau / atelier',
  fournisseur: 'Fournisseur',
  pause_repas: 'Pause repas',
  formation: 'Formation',
  rdv_garage: 'RDV garage',
  hors_ot_libre: 'Hors OT (libre)',
}

export type AgendaStatut = 'a_faire' | 'contacte' | 'rdv_pris' | 'fait' | 'annule'

export const AGENDA_STATUT_LABELS: Record<AgendaStatut, string> = {
  a_faire: 'À faire',
  contacte: 'Client contacté',
  rdv_pris: 'RDV pris',
  fait: 'Fait',
  annule: 'Annulé',
}

export interface AgendaEvent {
  id: string
  title: string
  /** Jour de l’échéance / visite prévue */
  date: string
  /**
   * Jour où il faut appeler le client pour prendre RDV (souvent avant `date`).
   * Si absent = même jour que `date`.
   */
  dateRappel?: string
  /** Heure de début prévue (HH:mm) — programme jour / semaine */
  heure?: string
  type: AgendaEventType
  clientId?: string
  chantierId?: string
  contratId?: string
  notes?: string
  statut: AgendaStatut
  /** Compte du tech concerné (planning équipe). */
  technicienUserId?: string
  technicien?: string
  createdByUserId?: string
  /** Généré auto depuis contrat / site (ne pas dupliquer) */
  autoKey?: string
  createdAt: string
  updatedAt: string
}

export function monthsForPeriodicite(p: PeriodiciteContrat): number {
  if (p === 'mensuelle') return 1
  if (p === 'trimestrielle') return 3
  if (p === 'semestrielle') return 6
  return 12
}

function todayIso() {
  return new Date().toISOString().slice(0, 10)
}

function addDaysIso(iso: string, days: number): string {
  const d = new Date(iso + 'T12:00:00')
  if (Number.isNaN(d.getTime())) return iso
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

/** Occurrences de visite à partir d’une date de début, jusqu’à horizon. */
export function occurrenceDates(
  startIso: string,
  stepMonths: number,
  horizonMonths = 14,
): string[] {
  const start = startIso.slice(0, 10)
  const today = todayIso()
  const horizon = addMonthsIso(today, horizonMonths) || today
  const pastFloor = addMonthsIso(today, -1) || today
  const out: string[] = []
  let cur = start
  let guard = 0
  while (cur < today && guard < 120) {
    const next = addMonthsIso(cur, stepMonths)
    if (!next || next <= cur) break
    cur = next
    guard += 1
  }
  guard = 0
  while (cur <= horizon && guard < 40) {
    if (cur >= pastFloor) out.push(cur)
    const next = addMonthsIso(cur, stepMonths)
    if (!next || next <= cur) break
    cur = next
    guard += 1
  }
  return out
}

export type AgendaGenInput = {
  contrats: ContratMaintenance[]
  sites: { id: string; clientId: string; nom: string; prochaineControleEtancheite?: string }[]
  /** Jours avant la visite pour rappeler d’appeler le client */
  joursAvantRappel?: number
}

/** Événements à créer / synchroniser depuis contrats signés + contrôles site. */
export function buildAutoAgendaEvents(input: AgendaGenInput): Omit<
  AgendaEvent,
  'id' | 'createdAt' | 'updatedAt'
>[] {
  const jours = input.joursAvantRappel ?? 14
  const events: Omit<AgendaEvent, 'id' | 'createdAt' | 'updatedAt'>[] = []

  for (const c of input.contrats) {
    if (!isContratActif(c)) continue
    const step = monthsForPeriodicite(c.periodicite)
    const dates = occurrenceDates(c.dateDebut || todayIso(), step)
    const siteIds =
      c.chantierIds && c.chantierIds.length > 0
        ? c.chantierIds
        : input.sites.filter((s) => s.clientId === c.clientId).map((s) => s.id)

    for (const date of dates) {
      const dateRappel = addDaysIso(date, -jours)
      const siteId = siteIds[0]
      const siteNom = siteId
        ? input.sites.find((s) => s.id === siteId)?.nom
        : undefined
      events.push({
        title: `Maintenance ${c.periodicite} — prendre RDV`,
        date,
        dateRappel,
        type: 'rappel_appel',
        clientId: c.clientId,
        chantierId: siteId,
        contratId: c.id,
        notes: [
          c.titre,
          c.numero,
          siteNom ? `Site : ${siteNom}` : siteIds.length > 1 ? `${siteIds.length} sites` : '',
          `Échéance visite : ${date}`,
          `Appeler ~${jours} j avant pour caler le RDV.`,
        ]
          .filter(Boolean)
          .join('\n'),
        statut: 'a_faire',
        autoKey: `contrat:${c.id}:${date}`,
      })
    }
  }

  for (const s of input.sites) {
    const ctrl = s.prochaineControleEtancheite?.slice(0, 10)
    if (!ctrl) continue
    const dateRappel = addDaysIso(ctrl, -jours)
    events.push({
      title: `Contrôle étanchéité — ${s.nom}`,
      date: ctrl,
      dateRappel,
      type: 'controle_etancheite',
      clientId: s.clientId,
      chantierId: s.id,
      notes: `Prochain contrôle d’étanchéité prévu le ${ctrl}. Contacter le client pour RDV.`,
      statut: 'a_faire',
      autoKey: `site-ctrl:${s.id}:${ctrl}`,
    })
  }

  return events
}

export function blankAgendaEvent(): Omit<AgendaEvent, 'id' | 'createdAt' | 'updatedAt'> {
  return {
    title: '',
    date: todayIso(),
    dateRappel: todayIso(),
    heure: '',
    type: 'rdv',
    statut: 'a_faire',
    notes: '',
  }
}

/** Date effective pour tri / affichage « à contacter ». */
export function agendaSortDate(e: Pick<AgendaEvent, 'date' | 'dateRappel'>): string {
  return (e.dateRappel || e.date || '').slice(0, 10)
}

export function isAgendaOverdue(e: AgendaEvent, today = todayIso()): boolean {
  if (e.statut === 'fait' || e.statut === 'annule' || e.statut === 'rdv_pris') return false
  return agendaSortDate(e) < today
}

export function isAgendaDueSoon(e: AgendaEvent, withinDays = 14, today = todayIso()): boolean {
  if (e.statut === 'fait' || e.statut === 'annule') return false
  const d = agendaSortDate(e)
  const limit = addDaysIso(today, withinDays)
  return d >= today && d <= limit
}

export function telHref(raw?: string): string | null {
  const n = (raw || '').replace(/[\s.()/-]/g, '')
  if (!n) return null
  return `tel:${n}`
}

export function mailtoHref(email?: string, subject?: string, body?: string): string | null {
  const e = (email || '').trim()
  if (!e) return null
  const q = new URLSearchParams()
  if (subject) q.set('subject', subject)
  if (body) q.set('body', body)
  const qs = q.toString()
  return qs ? `mailto:${e}?${qs}` : `mailto:${e}`
}

export function todayIsoLocal(): string {
  return todayIso()
}

export function addDaysToIso(iso: string, days: number): string {
  return addDaysIso(iso, days)
}

/** Lundi de la semaine (ISO, Europe) pour une date aaaa-mm-jj. */
export function startOfWeekMonday(iso: string): string {
  const d = new Date(iso.slice(0, 10) + 'T12:00:00')
  if (Number.isNaN(d.getTime())) return iso.slice(0, 10)
  const day = d.getDay() // 0 dim … 6 sam
  const diff = day === 0 ? -6 : 1 - day
  d.setDate(d.getDate() + diff)
  return d.toISOString().slice(0, 10)
}

export function weekDatesFrom(iso: string): string[] {
  const start = startOfWeekMonday(iso)
  return Array.from({ length: 7 }, (_, i) => addDaysIso(start, i))
}

const JOUR_LABELS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'] as const

export function formatJourCourt(iso: string): string {
  const d = new Date(iso.slice(0, 10) + 'T12:00:00')
  if (Number.isNaN(d.getTime())) return iso
  const wd = (d.getDay() + 6) % 7 // lun=0
  const jj = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  return `${JOUR_LABELS[wd]} ${jj}/${mm}`
}

export function formatHeure(h?: string): string {
  const v = (h || '').trim()
  if (!v) return ''
  return v.slice(0, 5)
}

/** Tri programme du jour : heure puis titre. */
export function compareProgrammeHeure(
  a: { heure?: string; title?: string },
  b: { heure?: string; title?: string },
): number {
  const ha = formatHeure(a.heure) || '99:99'
  const hb = formatHeure(b.heure) || '99:99'
  if (ha !== hb) return ha.localeCompare(hb)
  return (a.title || '').localeCompare(b.title || '')
}
