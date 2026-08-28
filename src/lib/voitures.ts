import type { AppData, Voiture, VoitureCarburant, VoitureDocumentId, VoitureEtatLieux } from './types'

export const VOITURE_DOCUMENTS: { id: VoitureDocumentId; label: string }[] = [
  { id: 'carte_grise', label: 'Carte grise (certificat d’immatriculation)' },
  { id: 'assurance_carte_verte', label: 'Attestation / carte verte d’assurance' },
  { id: 'controle_technique', label: 'Procès-verbal de contrôle technique' },
  { id: 'critair', label: 'Vignette Crit’Air' },
  { id: 'livret_entretien', label: 'Livret d’entretien' },
  { id: 'double_cles', label: 'Double des clés' },
  { id: 'carte_carburant', label: 'Carte carburant' },
  { id: 'badge_peage', label: 'Badge télépéage' },
  { id: 'kit_securite', label: 'Kit sécurité (triangle, gilet)' },
  { id: 'roue_secours', label: 'Roue de secours / kit anti-crevaison' },
  { id: 'autre', label: 'Autre (préciser)' },
]

export const VOITURE_CARBURANT_LABELS: Record<VoitureCarburant, string> = {
  vide: 'Vide',
  quart: '1/4',
  moitie: '1/2',
  trois_quarts: '3/4',
  plein: 'Plein',
}

export const VOITURE_CARROSSERIE_LABELS = {
  bon: 'Bon état',
  usure_normale: 'Usure normale',
  rayures: 'Rayures',
  chocs: 'Chocs / enfoncements',
} as const

export const VOITURE_INTERIEUR_LABELS = {
  bon: 'Propre / bon état',
  usure_normale: 'Usure normale',
  sale: 'Sale',
  abime: 'Abîmé',
} as const

export const VOITURE_PNEUS_LABELS = {
  bon: 'Bon état',
  a_surveiller: 'À surveiller',
  a_changer: 'À changer',
} as const

export function voitureDocumentLabel(id: VoitureDocumentId) {
  return VOITURE_DOCUMENTS.find((d) => d.id === id)?.label || id
}

export function isVoitureDocumentId(v: unknown): v is VoitureDocumentId {
  return typeof v === 'string' && VOITURE_DOCUMENTS.some((d) => d.id === v)
}

/** Véhicule attribué au technicien connecté. */
export function voitureForUser(data: AppData, userId?: string | null): Voiture | undefined {
  const list = data.voitures || []
  if (userId) {
    const assigned = list.find((v) => v.assigneeUserId === userId)
    if (assigned) return assigned
  }
  return undefined
}

export function voitureLabel(v: Voiture) {
  const vehicule = [v.marque, v.modele].filter(Boolean).join(' ')
  const base = vehicule ? `${v.matricule} — ${vehicule}` : v.matricule
  const who = v.assigneeName?.trim()
  return who ? `${base} → ${who}` : base
}

export function voitureTitreCourt(v: Voiture) {
  const vehicule = [v.marque, v.modele].filter(Boolean).join(' ')
  return vehicule ? `${v.matricule} — ${vehicule}` : v.matricule
}

export function blankEtatLieux(documentsFournis?: VoitureDocumentId[]): VoitureEtatLieux {
  return {
    date: new Date().toISOString().slice(0, 10),
    documentsRecus: [...(documentsFournis || [])],
  }
}

export function sanitizeEtatLieux(e: VoitureEtatLieux): VoitureEtatLieux {
  const documentsRecus = Array.isArray(e.documentsRecus)
    ? e.documentsRecus.filter(isVoitureDocumentId)
    : []
  const km = Number(e.kilometrage)
  return {
    date: (e.date || '').slice(0, 10) || new Date().toISOString().slice(0, 10),
    kilometrage: Number.isFinite(km) && km >= 0 ? Math.round(km) : undefined,
    carburant: e.carburant,
    carrosserie: e.carrosserie,
    interieur: e.interieur,
    pneus: e.pneus,
    documentsRecus,
    documentsAutre: e.documentsAutre?.trim() || undefined,
    dommages: e.dommages?.trim() || undefined,
    observations: e.observations?.trim() || undefined,
  }
}

export function erreurEtatLieux(etat: VoitureEtatLieux): string | null {
  if (!etat.date) return 'Indiquez la date de l’état des lieux.'
  if (etat.kilometrage == null || Number.isNaN(Number(etat.kilometrage))) {
    return 'Indiquez le kilométrage au compteur.'
  }
  if (!etat.carburant) return 'Indiquez le niveau de carburant.'
  if (!etat.carrosserie) return 'Indiquez l’état de la carrosserie.'
  if (!etat.interieur) return 'Indiquez l’état de l’intérieur.'
  if (!etat.pneus) return 'Indiquez l’état des pneus.'
  return null
}

export function documentsEcart(
  fournis: VoitureDocumentId[] | undefined,
  recus: VoitureDocumentId[] | undefined,
) {
  const f = new Set(fournis || [])
  const r = new Set(recus || [])
  return {
    manquants: [...f].filter((x) => !r.has(x)),
    extra: [...r].filter((x) => !f.has(x)),
  }
}

export function formatDateFrCourt(iso?: string) {
  const d = (iso || '').slice(0, 10)
  const [y, m, day] = d.split('-')
  if (!y || !m || !day) return iso || ''
  return `${day}/${m}/${y}`
}
