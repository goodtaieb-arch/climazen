/**
 * Liens officiels — 2 comptes seulement (OpenAI + Twilio).
 * L’utilisateur clique et arrive pile sur la bonne page.
 */

export const LOLA_SETUP_LINKS = {
  openaiSignup: {
    href: 'https://platform.openai.com/signup',
    label: 'Créer le compte OpenAI',
  },
  openaiBilling: {
    href: 'https://platform.openai.com/settings/organization/billing',
    label: 'Activer le paiement OpenAI',
  },
  openaiKeys: {
    href: 'https://platform.openai.com/api-keys',
    label: 'Créer la clé API (sk-…)',
  },
  twilioSignup: {
    href: 'https://www.twilio.com/try-twilio',
    label: 'Créer le compte Twilio',
  },
  twilioBuyNumber: {
    href: 'https://www.twilio.com/console/phone-numbers/search',
    label: 'Acheter un numéro France (voix)',
  },
  twilioMyNumbers: {
    href: 'https://www.twilio.com/console/phone-numbers/incoming',
    label: 'Ouvrir mes numéros (coller le webhook)',
  },
} as const

export const LOLA_WEBHOOK_URL = 'https://climazen.fr/api/telephony-inbound'
