import type { AppData, DetecteurManuel } from './types'
import { isDetecteurControleExpire } from './types'

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
  // Sinon premier détecteur du parc, ou legacy opérateur
  const any = list.find((d) => d.identification?.trim())
  if (any) return any
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

/**
 * CERFA interdit sans détecteur de fuite enregistré + contrôle < 1 an.
 * Retourne le détecteur valide, ou lève une Error explicite.
 */
export function assertDetecteurValidePourCerfa(
  data: AppData,
  userId?: string | null,
  override?: { identification?: string; controleDate?: string },
): { identification: string; controleDate: string } {
  const registered = detecteurForUser(data, userId)
  const identification =
    (override?.identification || '').trim() || registered?.identification?.trim() || ''
  const controleDate =
    (override?.controleDate || '').trim() || registered?.controleDate?.trim() || ''

  if (!identification) {
    throw new Error(
      'Détecteur de fuite obligatoire pour le CERFA. Enregistrez-le dans « Mon entreprise » / « Ma signature » (parc détecteurs) et attribuez-le au technicien.',
    )
  }
  if (!controleDate) {
    throw new Error(
      `Détecteur « ${identification} » : date de contrôle manquante. Mettez à jour le détecteur (contrôle annuel obligatoire).`,
    )
  }
  if (isDetecteurControleExpire(controleDate)) {
    throw new Error(
      `Détecteur « ${identification} » : contrôle expiré (> 1 an, contrôlé le ${controleDate}). Faites contrôler le détecteur avant de générer un CERFA.`,
    )
  }
  return { identification, controleDate }
}
