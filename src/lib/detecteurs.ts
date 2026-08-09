import type { AppData, DetecteurManuel } from './types'

/** Détecteur attribué au technicien connecté (sinon fallback société). */
export function detecteurForUser(
  data: AppData,
  userId?: string | null,
): DetecteurManuel | undefined {
  const list = data.detecteurs || []
  if (userId) {
    const assigned = list.find((d) => d.assigneeUserId === userId)
    if (assigned) return assigned
  }
  const id = data.operateur.detecteurIdentification?.trim()
  if (id) {
    return {
      id: 'company-default',
      identification: id,
      controleDate: data.operateur.detecteurControleDate || '',
      updatedAt: '',
    }
  }
  return undefined
}

export function detecteurLabel(d: DetecteurManuel) {
  const who = d.assigneeName?.trim()
  return who ? `${d.identification} → ${who}` : d.identification
}
