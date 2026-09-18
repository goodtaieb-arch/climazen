/**
 * Registre des prestataires de facturation électronique agréés. Chaque
 * société choisit le sien — jamais imposé par ClimaZEN (cahier des charges
 * §7). Seul `factpulse` est réellement câblé pour l'instant (test de
 * connexion) ; les autres apparaissent dans le menu mais restent inactifs
 * tant qu'ils ne sont pas intégrés.
 *
 * Miroir côté serveur : server/lib/invoicingProviders.js (garder synchronisés).
 */
export type InvoicingProviderId = 'factpulse' | 'iopole' | 'b2brouter'

export type InvoicingProvider = {
  id: InvoicingProviderId
  label: string
  available: boolean
  url: string
}

export const INVOICING_PROVIDERS: InvoicingProvider[] = [
  { id: 'factpulse', label: 'FactPulse', available: true, url: 'https://factpulse.fr' },
  { id: 'iopole', label: 'IOPOLE', available: false, url: 'https://iopole.com' },
  { id: 'b2brouter', label: 'B2Brouter (eDocSync)', available: false, url: 'https://b2brouter.net' },
]

export function invoicingProviderLabel(id: string): string {
  return INVOICING_PROVIDERS.find((p) => p.id === id)?.label || id
}
