/**
 * Demandes d’absence / congés / RTT — feuille numérique tech → validation direction.
 * Une fois validée, pose l’indispo agenda (blocage planning OT).
 */

import {
  AGENDA_INDISPO_TYPES,
  AGENDA_TYPE_LABELS,
  type AgendaEvent,
  type AgendaEventType,
  isIndispoType,
} from './agenda'
import type { PersonnelDossier } from './rhDocuments'

/** Même clés que l’agenda « Absent » + « autre » (demande libre). */
export type AbsenceType =
  | 'vacances'
  | 'conge'
  | 'rtt'
  | 'maladie'
  | 'paternite'
  | 'maternite'
  | 'sans_solde'
  | 'formation'
  | 'autre'

export type AbsenceStatut =
  | 'brouillon'
  | 'en_attente'
  | 'validee'
  | 'refusee'
  | 'annulee'

export type AbsenceSource = 'formulaire' | 'assistant' | 'bureau'

/** Motifs déroulants — alignés agenda (ordre d’affichage). */
export const ABSENCE_MOTIF_OPTIONS: AbsenceType[] = [
  ...(AGENDA_INDISPO_TYPES as AbsenceType[]),
  'autre',
]

export const ABSENCE_TYPE_LABELS: Record<AbsenceType, string> = {
  vacances: AGENDA_TYPE_LABELS.vacances,
  conge: AGENDA_TYPE_LABELS.conge,
  rtt: AGENDA_TYPE_LABELS.rtt,
  maladie: AGENDA_TYPE_LABELS.maladie,
  paternite: AGENDA_TYPE_LABELS.paternite,
  maternite: AGENDA_TYPE_LABELS.maternite,
  sans_solde: AGENDA_TYPE_LABELS.sans_solde,
  formation: AGENDA_TYPE_LABELS.formation,
  autre: 'Autre absence',
}

export const ABSENCE_STATUT_LABELS: Record<AbsenceStatut, string> = {
  brouillon: 'Brouillon',
  en_attente: 'En attente direction',
  validee: 'Validée',
  refusee: 'Refusée',
  annulee: 'Annulée',
}

export interface DemandeAbsence {
  id: string
  type: AbsenceType
  dateDebut: string
  dateFin: string
  /** Jours calendaires inclusifs (ou ouvrés si renseigné ainsi). */
  joursDemandes: number
  motif?: string
  notes?: string
  technicienUserId: string
  technicienName?: string
  statut: AbsenceStatut
  source?: AbsenceSource
  createdByUserId?: string
  createdByName?: string
  submittedAt?: string
  decidedByUserId?: string
  decidedByName?: string
  decidedAt?: string
  motifRefus?: string
  /** Événement agenda créé à la validation. */
  agendaEventId?: string
  createdAt: string
  updatedAt: string
}

export function parseAbsenceType(raw: unknown): AbsenceType {
  const t = String(raw || '').trim().toLowerCase().replace(/-/g, '_')
  if (
    t === 'vacances' ||
    t === 'conge' ||
    t === 'rtt' ||
    t === 'maladie' ||
    t === 'paternite' ||
    t === 'maternite' ||
    t === 'sans_solde' ||
    t === 'formation' ||
    t === 'autre'
  ) {
    return t
  }
  if (t === 'paternité' || t === 'conge_paternite' || t === 'conge_paternité') return 'paternite'
  if (t === 'maternité' || t === 'conge_maternite' || t === 'conge_maternité') return 'maternite'
  if (isIndispoType(t)) return t as AbsenceType
  return 'conge'
}

export function absenceTypeToAgenda(type: AbsenceType): AgendaEventType {
  if (type === 'autre') return 'conge'
  if ((AGENDA_INDISPO_TYPES as string[]).includes(type)) return type as AgendaEventType
  return 'conge'
}

/** Jours calendaires inclusifs entre deux ISO (YYYY-MM-DD). */
export function compterJoursCalendaires(debut: string, fin: string): number {
  const a = String(debut || '').slice(0, 10)
  const b = String(fin || '').slice(0, 10)
  if (!a || !b) return 0
  const lo = a <= b ? a : b
  const hi = a <= b ? b : a
  const t0 = Date.parse(`${lo}T12:00:00`)
  const t1 = Date.parse(`${hi}T12:00:00`)
  if (!Number.isFinite(t0) || !Number.isFinite(t1)) return 0
  return Math.floor((t1 - t0) / 86400000) + 1
}

/** Jours ouvrés (lun–ven) inclusifs. */
export function compterJoursOuvres(debut: string, fin: string): number {
  const a = String(debut || '').slice(0, 10)
  const b = String(fin || '').slice(0, 10)
  if (!a || !b) return 0
  const lo = a <= b ? a : b
  const hi = a <= b ? b : a
  let n = 0
  const cur = new Date(`${lo}T12:00:00`)
  const end = new Date(`${hi}T12:00:00`)
  while (cur.getTime() <= end.getTime()) {
    const day = cur.getDay()
    if (day !== 0 && day !== 6) n += 1
    cur.setDate(cur.getDate() + 1)
  }
  return n
}

export function blankDemandeAbsence(opts: {
  technicienUserId: string
  technicienName?: string
  type?: AbsenceType
  dateDebut?: string
  dateFin?: string
  source?: AbsenceSource
  createdByUserId?: string
  createdByName?: string
}): Omit<DemandeAbsence, 'id' | 'createdAt' | 'updatedAt'> {
  const today = new Date().toISOString().slice(0, 10)
  const dateDebut = opts.dateDebut || today
  const dateFin = opts.dateFin || dateDebut
  return {
    type: opts.type || 'conge',
    dateDebut,
    dateFin,
    joursDemandes: compterJoursOuvres(dateDebut, dateFin),
    motif: undefined,
    notes: undefined,
    technicienUserId: opts.technicienUserId,
    technicienName: opts.technicienName,
    statut: 'brouillon',
    source: opts.source || 'formulaire',
    createdByUserId: opts.createdByUserId,
    createdByName: opts.createdByName,
  }
}

export function titreDemandeAbsence(d: Pick<DemandeAbsence, 'type' | 'technicienName' | 'dateDebut' | 'dateFin'>): string {
  const type = ABSENCE_TYPE_LABELS[d.type] || d.type
  const who = d.technicienName ? ` — ${d.technicienName}` : ''
  const fin = d.dateFin && d.dateFin !== d.dateDebut ? ` → ${d.dateFin}` : ''
  return `${type}${who} · ${d.dateDebut}${fin}`
}

export function resumeDemandeAbsence(d: DemandeAbsence): string {
  const lines = [
    `${ABSENCE_TYPE_LABELS[d.type]} · ${d.joursDemandes} j`,
    `Du ${d.dateDebut} au ${d.dateFin}`,
    d.motif ? `Motif : ${d.motif}` : null,
  ]
  return lines.filter(Boolean).join('\n')
}

/** Types qui consomment un solde (CP ou RTT). */
export function absenceConsommeSolde(type: AbsenceType): 'conges' | 'rtt' | null {
  if (type === 'vacances' || type === 'conge') return 'conges'
  if (type === 'rtt') return 'rtt'
  return null
}

export function soldeCongesOf(d?: PersonnelDossier | null): number | undefined {
  const n = Number(d?.soldeCongesJours)
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : undefined
}

export function soldeRttOf(d?: PersonnelDossier | null): number | undefined {
  const n = Number(d?.soldeRttJours)
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : undefined
}

export function demandesEnAttente(list: DemandeAbsence[] | undefined): DemandeAbsence[] {
  return (list || [])
    .filter((d) => d.statut === 'en_attente')
    .sort((a, b) => (b.submittedAt || b.updatedAt || '').localeCompare(a.submittedAt || a.updatedAt || ''))
}

export function demandesPourTech(
  list: DemandeAbsence[] | undefined,
  userId: string | undefined | null,
): DemandeAbsence[] {
  if (!userId) return []
  return (list || [])
    .filter((d) => d.technicienUserId === userId)
    .sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''))
}

export function buildAgendaFromDemande(
  d: DemandeAbsence,
): Omit<AgendaEvent, 'id' | 'createdAt' | 'updatedAt'> {
  const type = absenceTypeToAgenda(d.type)
  const label = AGENDA_TYPE_LABELS[type] || ABSENCE_TYPE_LABELS[d.type]
  const title = d.technicienName ? `${label} — ${d.technicienName}` : label
  return {
    title,
    date: d.dateDebut,
    dateFin: d.dateFin !== d.dateDebut ? d.dateFin : undefined,
    type,
    notes: [d.motif, d.notes].filter(Boolean).join(' · ') || undefined,
    statut: 'a_faire',
    technicienUserId: d.technicienUserId,
    technicien: d.technicienName,
    createdByUserId: d.createdByUserId,
  }
}

/** Parse « du 10/08/2026 au 20/08/2026 » / « du 10/08 au 20/08 ». */
export function parseAbsenceDateRange(text: string): { debut: string; fin: string } | null {
  const raw = text || ''
  const m = raw.match(
    /\bdu\s+(\d{1,2}[./\-]\d{1,2}(?:[./\-]\d{2,4})?)\s+au\s+(\d{1,2}[./\-]\d{1,2}(?:[./\-]\d{2,4})?)/i,
  )
  if (!m) return null
  const debut = completeFrDate(m[1])
  const fin = completeFrDate(m[2], debut)
  if (!debut || !fin) return null
  return { debut, fin }
}

function completeFrDate(fr: string, refYearFrom?: string | null): string | null {
  const t = (fr || '').trim()
  const full = t.match(/^(\d{1,2})[./\-](\d{1,2})[./\-](\d{2,4})$/)
  if (full) {
    let y = Number(full[3])
    if (y < 100) y += 2000
    return `${y}-${String(Number(full[2])).padStart(2, '0')}-${String(Number(full[1])).padStart(2, '0')}`
  }
  const short = t.match(/^(\d{1,2})[./\-](\d{1,2})$/)
  if (!short) return null
  const year = refYearFrom
    ? Number(String(refYearFrom).slice(0, 4))
    : new Date().getFullYear()
  return `${year}-${String(Number(short[2])).padStart(2, '0')}-${String(Number(short[1])).padStart(2, '0')}`
}

export function detectAbsenceTypeFromText(text: string): AbsenceType {
  const n = (text || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
  if (/\brtt\b/.test(n)) return 'rtt'
  if (/\bmaladie\b|\barret\b/.test(n)) return 'maladie'
  if (/\bpaternite\b/.test(n)) return 'paternite'
  if (/\bmaternite\b/.test(n)) return 'maternite'
  if (/\bsans[\s_]?solde\b/.test(n)) return 'sans_solde'
  if (/\bformation\b/.test(n)) return 'formation'
  if (/\bvacances\b/.test(n)) return 'vacances'
  if (/\bconges?\b|\babsent/.test(n)) return 'conge'
  return 'conge'
}
