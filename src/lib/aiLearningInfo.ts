/**
 * Texte d’information — apprentissage vocabulaire (côté UI).
 * Aligné avec server/lib/aiVocabularyCore.js (AI_LEARNING_INFO_FR).
 */

export const AI_LEARNING_INFO_FR =
  'ClimaZEN apprend uniquement le vocabulaire technique (PAC, R-32, CERFA…) pour mieux comprendre votre métier. Les données confidentielles (noms, téléphones, adresses, e-mails, SIRET…) ne sont pas enregistrées pour cet apprentissage.'

export const AI_LEARNING_INFO_SHORT_FR =
  'Apprentissage vocabulaire technique uniquement — pas de données confidentielles.'

const DISMISS_KEY = 'climazen_ai_learning_info_dismissed'

export function isAiLearningInfoDismissed(): boolean {
  try {
    return localStorage.getItem(DISMISS_KEY) === '1'
  } catch {
    return false
  }
}

export function dismissAiLearningInfo(): void {
  try {
    localStorage.setItem(DISMISS_KEY, '1')
  } catch {
    /* ignore */
  }
}
