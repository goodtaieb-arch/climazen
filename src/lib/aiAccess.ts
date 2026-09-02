/**
 * Accès assistant IA — édition Light vs Pro.
 *
 * Light + bêta : aucun accès gratuit (paywall) — option Agent IA payante.
 * Light + post-bêta : chatbot gratuit (guide) ; Agent IA = option payante.
 * Pro : Agent IA inclus.
 */

import type { AppEdition } from './appEdition'
import { APP_IS_BETA } from './buildStamp'

/** Niveau d’accès effectif côté app. */
export type AiTier = 'none' | 'chatbot' | 'agent'

/** Plan souscrit stocké sur le compte (sync cloud). */
export type AiPlan = 'agent'

export const AI_TIER_LABELS: Record<AiTier, string> = {
  none: 'Non activé',
  chatbot: 'Chatbot d’aide',
  agent: 'Agent IA',
}

/** Tarifs affichés — prix Agent IA Light fixé à la sortie de la bêta. */
export const AI_LIGHT_PRICING = {
  chatbotAfterBeta: {
    price: '0 €',
    detail: 'Chatbot d’aide inclus gratuitement à la sortie de la bêta (questions sur l’app, guide).',
  },
  agentDuringBeta: {
    price: 'Sur devis',
    detail:
      'Pendant la bêta, l’Agent IA (OT, CERFA, agenda, stock…) n’est pas inclus dans Light gratuit — contactez-nous pour l’activer.',
  },
  agentAfterBeta: {
    price: 'À définir',
    detail: 'Option payante — création OT/CERFA, actions terrain et Gemini cloud.',
  },
} as const

export const AI_LIGHT_BETA_HINT =
  'Édition Light : l’assistant IA n’est pas gratuit pendant la bêta. À la sortie, chatbot gratuit ; Agent IA en option payante.'

export function resolveAiTier(opts: {
  appEdition: AppEdition
  aiPlan?: AiPlan
  isBeta?: boolean
}): AiTier {
  if (opts.appEdition === 'pro') return 'agent'
  if (opts.aiPlan === 'agent') return 'agent'
  const beta = opts.isBeta ?? APP_IS_BETA
  if (beta) return 'none'
  return 'chatbot'
}

export function canUseChatbot(tier: AiTier): boolean {
  return tier === 'chatbot' || tier === 'agent'
}

export function canUseAgentActions(tier: AiTier): boolean {
  return tier === 'agent'
}

export function canCallGemini(tier: AiTier): boolean {
  return tier === 'agent'
}

export function aiTierUpsellMessage(tier: AiTier, isBeta?: boolean): string | null {
  if (tier === 'agent') return null
  const beta = isBeta ?? APP_IS_BETA
  if (tier === 'none') {
    return beta
      ? `${AI_LIGHT_BETA_HINT}\n\nContactez-nous pour activer l’Agent IA dès maintenant (tarif sur devis pendant la bêta).`
      : 'Passez à l’Agent IA pour créer OT, CERFA, agenda et stock par la voix.'
  }
  // chatbot
  return 'Le chatbot répond aux questions sur l’app. Pour créer des OT/CERFA et actions terrain, passez à l’Agent IA (option payante).'
}

export function parseAiPlan(raw: unknown): AiPlan | undefined {
  return raw === 'agent' ? 'agent' : undefined
}
