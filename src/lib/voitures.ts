import type { AppData, Voiture } from './types'

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
