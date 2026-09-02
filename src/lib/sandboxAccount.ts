/** Compte démo sandbox — tests GMAO complets (gérant Pro + opérateurs). */

import type { PostePersonnelId } from './postePersonnel'

export const SANDBOX_TEST_EMAIL = 'sandbox@climazen.fr'
/** Sans « climazen » ni mots bannis (passwordPolicy) — Supabase + app OK. */
export const SANDBOX_TEST_PASSWORD = 'SbxDemo-Gmao#2026xK9mR'
export const SANDBOX_TEST_COMPANY = 'ClimaZEN Sandbox Demo'
export const SANDBOX_TEST_FULL_NAME = 'Issam Test Sandbox'

/** Mot de passe partagé des 10 opérateurs sandbox (connexion réelle Auth). */
export const SANDBOX_OPERATOR_PASSWORD = 'SbxOp-Gmao#2026xK9m'

export type SandboxOperatorDef = {
  email: string
  password: string
  fullName: string
  poste: PostePersonnelId
  /** Libellé court pour l’aide connexion */
  roleLabel: string
}

/** 10 opérateurs connectables — responsable, tech, secrétaire, pilote, magasinier… */
export const SANDBOX_OPERATORS: readonly SandboxOperatorDef[] = [
  {
    email: 'op.tech1@sbx-demo.fr',
    password: SANDBOX_OPERATOR_PASSWORD,
    fullName: 'Karim Benali',
    poste: 'tech_frigoriste',
    roleLabel: 'Tech frigoriste',
  },
  {
    email: 'op.tech2@sbx-demo.fr',
    password: SANDBOX_OPERATOR_PASSWORD,
    fullName: 'Sophie Martin',
    poste: 'tech_cvc',
    roleLabel: 'Tech CVC',
  },
  {
    email: 'op.tech3@sbx-demo.fr',
    password: SANDBOX_OPERATOR_PASSWORD,
    fullName: 'Lucas Petit',
    poste: 'electricien',
    roleLabel: 'Électricien',
  },
  {
    email: 'op.responsable@sbx-demo.fr',
    password: SANDBOX_OPERATOR_PASSWORD,
    fullName: 'Amélie Durand',
    poste: 'responsable',
    roleLabel: 'Responsable',
  },
  {
    email: 'op.tech4@sbx-demo.fr',
    password: SANDBOX_OPERATOR_PASSWORD,
    fullName: 'Thomas Roux',
    poste: 'tech_frigoriste',
    roleLabel: 'Tech frigoriste',
  },
  {
    email: 'op.tech5@sbx-demo.fr',
    password: SANDBOX_OPERATOR_PASSWORD,
    fullName: 'Nina Lefèvre',
    poste: 'plombier',
    roleLabel: 'Plombier',
  },
  {
    email: 'op.magasinier@sbx-demo.fr',
    password: SANDBOX_OPERATOR_PASSWORD,
    fullName: 'Hugo Bernard',
    poste: 'magasinier',
    roleLabel: 'Magasinier',
  },
  {
    email: 'op.secretaire@sbx-demo.fr',
    password: SANDBOX_OPERATOR_PASSWORD,
    fullName: 'Claire Moreau',
    poste: 'secretaire',
    roleLabel: 'Secrétaire',
  },
  {
    email: 'op.pilote@sbx-demo.fr',
    password: SANDBOX_OPERATOR_PASSWORD,
    fullName: 'Mehdi Ali',
    poste: 'pilote',
    roleLabel: 'Pilote',
  },
  {
    email: 'op.tech6@sbx-demo.fr',
    password: SANDBOX_OPERATOR_PASSWORD,
    fullName: 'Julie Garnier',
    poste: 'tech_cvc',
    roleLabel: 'Tech CVC',
  },
] as const

const SANDBOX_EMAILS = new Set(
  [SANDBOX_TEST_EMAIL, ...SANDBOX_OPERATORS.map((o) => o.email)].map((e) => e.toLowerCase()),
)

export function isSandboxTestEmail(email: string | undefined | null): boolean {
  return String(email || '')
    .trim()
    .toLowerCase() === SANDBOX_TEST_EMAIL
}

export function isSandboxAccountEmail(email: string | undefined | null): boolean {
  return SANDBOX_EMAILS.has(String(email || '').trim().toLowerCase())
}

/** IDs stables fallback (auto-seed client sans provision Auth opérateurs). */
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

export const SANDBOX_MAGASINIER_INDEX = SANDBOX_OPERATORS.findIndex((o) => o.poste === 'magasinier')

export function sandboxMagasinierUserId(techIds: readonly string[]): string {
  const idx = SANDBOX_MAGASINIER_INDEX >= 0 ? SANDBOX_MAGASINIER_INDEX : 6
  return techIds[idx] || SANDBOX_TECH_IDS[6]
}

/** Profils mis en avant sur la page de connexion démo */
export const SANDBOX_LOGIN_DEMOS = [
  { email: SANDBOX_TEST_EMAIL, password: SANDBOX_TEST_PASSWORD, label: 'Gérant (owner)' },
  { email: 'op.responsable@sbx-demo.fr', password: SANDBOX_OPERATOR_PASSWORD, label: 'Responsable' },
  { email: 'op.pilote@sbx-demo.fr', password: SANDBOX_OPERATOR_PASSWORD, label: 'Pilote' },
  { email: 'op.secretaire@sbx-demo.fr', password: SANDBOX_OPERATOR_PASSWORD, label: 'Secrétaire' },
  { email: 'op.tech1@sbx-demo.fr', password: SANDBOX_OPERATOR_PASSWORD, label: 'Tech terrain' },
  { email: 'op.magasinier@sbx-demo.fr', password: SANDBOX_OPERATOR_PASSWORD, label: 'Magasinier' },
] as const
