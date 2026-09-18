/**
 * Registre des prestataires de facturation électronique agréés. Chaque
 * société choisit le sien — jamais imposé par ClimaZEN (cahier des
 * charges §7). Seul `factpulse` a une intégration réelle pour l'instant
 * (server/lib/factpulseClient.js) ; les autres sont réservés pour un ajout
 * ultérieur, sans nouvelle migration de fond (colonne `provider`).
 *
 * Miroir côté client : src/lib/invoicingProviders.ts (garder synchronisés).
 */
export const INVOICING_PROVIDERS = [
  { id: 'factpulse', label: 'FactPulse', available: true, url: 'https://factpulse.fr' },
  { id: 'iopole', label: 'IOPOLE', available: false, url: 'https://iopole.com' },
  { id: 'b2brouter', label: 'B2Brouter (eDocSync)', available: false, url: 'https://b2brouter.net' },
]

const KNOWN_IDS = new Set(INVOICING_PROVIDERS.map((p) => p.id))

export function normalizeInvoicingProvider(raw) {
  const id = String(raw || '').trim().toLowerCase()
  return KNOWN_IDS.has(id) ? id : 'factpulse'
}

export function isInvoicingProviderAvailable(id) {
  return Boolean(INVOICING_PROVIDERS.find((p) => p.id === id)?.available)
}
