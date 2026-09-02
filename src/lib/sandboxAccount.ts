/** Compte démo sandbox — tests GMAO complets (gérant Pro). */

export const SANDBOX_TEST_EMAIL = 'sandbox@climazen.fr'
export const SANDBOX_TEST_PASSWORD = 'ClimaZEN-Sandbox2026!'
export const SANDBOX_TEST_COMPANY = 'ClimaZEN Sandbox Demo'
export const SANDBOX_TEST_FULL_NAME = 'Issam Test Sandbox'

export function isSandboxTestEmail(email: string | undefined | null): boolean {
  return String(email || '')
    .trim()
    .toLowerCase() === SANDBOX_TEST_EMAIL
}

/** IDs stables des 10 techniciens fictifs (dossiers RH / affectation OT). */
export const SANDBOX_TECH_IDS = [
  'a1000001-0001-4000-8000-000000000001',
  'a1000001-0001-4000-8000-000000000002',
  'a1000001-0001-4000-8000-000000000003',
  'a1000001-0001-4000-8000-000000000004',
  'a1000001-0001-4000-8000-000000000005',
  'a1000001-0001-4000-8000-000000000006',
  'a1000001-0001-4000-8000-000000000007',
  'a1000001-0001-4000-8000-000000000008',
  'a1000001-0001-4000-8000-000000000009',
  'a1000001-0001-4000-8000-000000000010',
] as const

export const SANDBOX_MAGASINIER_USER_ID = SANDBOX_TECH_IDS[6]
