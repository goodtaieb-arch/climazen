/** Comptes + sociétés ClimaZEN — connexion par e-mail, récupération MDP. */

export type UserRole = 'owner' | 'operateur'

export type Organization = {
  id: string
  name: string
  createdAt: string
  ownerUserId: string
}

export type UserAccount = {
  id: string
  /** Identifiant de connexion = e-mail */
  email: string
  /** @deprecated alias de email (anciens comptes) */
  username: string
  passwordHash: string
  fullName: string
  createdAt: string
  organizationId: string
  role: UserRole
  active: boolean
  /** Hash du code de récupération (mot de passe oublié) */
  recoveryCodeHash?: string
  signataireNom?: string
  signataireQualite?: string
  signatureImage?: string
}

export type RegisterResult = {
  user: UserAccount
  /** Code à noter une seule fois — sert à régénérer le MDP */
  recoveryCode: string
}

const USERS_KEY = 'climazen_users_v1'
const ORGS_KEY = 'climazen_orgs_v1'
const SESSION_KEY = 'climazen_session_v1'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function loadUsers(): UserAccount[] {
  try {
    const raw = localStorage.getItem(USERS_KEY)
    if (!raw) return []
    return JSON.parse(raw) as UserAccount[]
  } catch {
    return []
  }
}

function saveUsers(users: UserAccount[]) {
  localStorage.setItem(USERS_KEY, JSON.stringify(users))
}

export function loadOrgs(): Organization[] {
  try {
    const raw = localStorage.getItem(ORGS_KEY)
    if (!raw) return []
    return JSON.parse(raw) as Organization[]
  } catch {
    return []
  }
}

function saveOrgs(orgs: Organization[]) {
  localStorage.setItem(ORGS_KEY, JSON.stringify(orgs))
}

export async function hashPassword(password: string): Promise<string> {
  const data = new TextEncoder().encode(password)
  const buf = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase()
}

/** @deprecated */
export function normalizeUsername(username: string) {
  return normalizeEmail(username)
}

export function isValidEmail(email: string) {
  return EMAIL_RE.test(normalizeEmail(email))
}

export function dataKeyForOrg(organizationId: string) {
  return `climazen_orgdata_${organizationId}`
}

export function dataKeyForUser(userId: string) {
  return `climazen_data_${userId}`
}

/** Code récupération lisible : CZ-AB12-CD34 */
export function generateRecoveryCode(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  const pick = (n: number) =>
    Array.from({ length: n }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join('')
  return `CZ-${pick(4)}-${pick(4)}`
}

export function normalizeRecoveryCode(code: string) {
  return code.trim().toUpperCase().replace(/\s+/g, '')
}

function loginKey(u: UserAccount) {
  return normalizeEmail(u.email || u.username || '')
}

function migrateLegacyUser(u: UserAccount): UserAccount {
  const withEmail: UserAccount = {
    ...u,
    email: normalizeEmail(u.email || u.username || ''),
    username: normalizeEmail(u.email || u.username || ''),
    active: u.active !== false,
  }
  if (withEmail.organizationId && withEmail.role) return withEmail

  const orgId = crypto.randomUUID()
  const org: Organization = {
    id: orgId,
    name: u.fullName || u.username,
    createdAt: u.createdAt || new Date().toISOString(),
    ownerUserId: u.id,
  }
  const orgs = loadOrgs()
  if (!orgs.some((o) => o.id === orgId)) {
    orgs.push(org)
    saveOrgs(orgs)
  }
  try {
    const legacy = localStorage.getItem(dataKeyForUser(u.id))
    if (legacy && !localStorage.getItem(dataKeyForOrg(orgId))) {
      localStorage.setItem(dataKeyForOrg(orgId), legacy)
    }
  } catch {
    // ignore
  }
  return {
    ...withEmail,
    organizationId: orgId,
    role: 'owner',
    active: true,
  }
}

export function ensureUsersMigrated(): UserAccount[] {
  const users = loadUsers()
  let changed = false
  const next = users.map((u) => {
    const before = JSON.stringify(u)
    const m = migrateLegacyUser(u)
    if (JSON.stringify(m) !== before) changed = true
    return m
  })
  if (changed) saveUsers(next)
  return next
}

function findByEmail(users: UserAccount[], email: string) {
  const e = normalizeEmail(email)
  return users.find((u) => loginKey(u) === e)
}

/** Création du compte officiel société (owner). */
export async function registerCompany(opts: {
  companyName: string
  email: string
  password: string
  fullName: string
}): Promise<RegisterResult> {
  const email = normalizeEmail(opts.email)
  if (!opts.companyName.trim()) throw new Error('Indiquez le nom de la société.')
  if (!isValidEmail(email)) throw new Error('Indiquez un e-mail valide (ex. contact@societe.fr).')
  if (opts.password.length < 6) throw new Error('Mot de passe : au moins 6 caractères.')
  if (!opts.fullName.trim()) throw new Error('Indiquez votre nom.')

  const users = ensureUsersMigrated()
  if (findByEmail(users, email)) {
    throw new Error('Cet e-mail est déjà utilisé.')
  }

  const orgId = crypto.randomUUID()
  const userId = crypto.randomUUID()
  const now = new Date().toISOString()
  const recoveryCode = generateRecoveryCode()

  const org: Organization = {
    id: orgId,
    name: opts.companyName.trim(),
    createdAt: now,
    ownerUserId: userId,
  }
  const orgs = loadOrgs()
  orgs.push(org)
  saveOrgs(orgs)

  const account: UserAccount = {
    id: userId,
    email,
    username: email,
    passwordHash: await hashPassword(opts.password),
    fullName: opts.fullName.trim(),
    createdAt: now,
    organizationId: orgId,
    role: 'owner',
    active: true,
    recoveryCodeHash: await hashPassword(normalizeRecoveryCode(recoveryCode)),
    signataireNom: opts.fullName.trim(),
    signataireQualite: 'Responsable / gérant',
  }
  users.push(account)
  saveUsers(users)
  setSession(account.id)
  return { user: account, recoveryCode }
}

export async function registerAccount(opts: {
  username: string
  password: string
  fullName: string
  companyName?: string
}): Promise<UserAccount> {
  const { user } = await registerCompany({
    companyName: opts.companyName || opts.fullName,
    email: opts.username,
    password: opts.password,
    fullName: opts.fullName,
  })
  return user
}

/** L’owner crée un opérateur (connexion = e-mail). */
export async function createOperatorAccount(opts: {
  owner: UserAccount
  email: string
  password: string
  fullName: string
}): Promise<RegisterResult> {
  if (opts.owner.role !== 'owner') throw new Error('Seul le compte officiel peut ajouter des opérateurs.')
  const email = normalizeEmail(opts.email)
  if (!isValidEmail(email)) throw new Error('Indiquez un e-mail valide pour l’opérateur.')
  if (opts.password.length < 6) throw new Error('Mot de passe : au moins 6 caractères.')
  if (!opts.fullName.trim()) throw new Error('Indiquez le nom de l’opérateur.')

  const users = ensureUsersMigrated()
  if (findByEmail(users, email)) {
    throw new Error('Cet e-mail est déjà utilisé.')
  }

  const recoveryCode = generateRecoveryCode()
  const account: UserAccount = {
    id: crypto.randomUUID(),
    email,
    username: email,
    passwordHash: await hashPassword(opts.password),
    fullName: opts.fullName.trim(),
    createdAt: new Date().toISOString(),
    organizationId: opts.owner.organizationId,
    role: 'operateur',
    active: true,
    recoveryCodeHash: await hashPassword(normalizeRecoveryCode(recoveryCode)),
    signataireNom: opts.fullName.trim(),
    signataireQualite: 'Opérateur attesté',
  }
  users.push(account)
  saveUsers(users)
  return { user: account, recoveryCode }
}

export function listOrgUsers(organizationId: string): UserAccount[] {
  return ensureUsersMigrated()
    .filter((u) => u.organizationId === organizationId)
    .sort((a, b) => {
      if (a.role === b.role) return a.fullName.localeCompare(b.fullName)
      return a.role === 'owner' ? -1 : 1
    })
}

export function setUserActive(userId: string, active: boolean, byOwner: UserAccount) {
  if (byOwner.role !== 'owner') throw new Error('Action réservée au compte officiel.')
  const users = ensureUsersMigrated()
  const target = users.find((u) => u.id === userId)
  if (!target || target.organizationId !== byOwner.organizationId) {
    throw new Error('Opérateur introuvable.')
  }
  if (target.role === 'owner') throw new Error('Impossible de désactiver le compte officiel.')
  target.active = active
  saveUsers(users)
  return target
}

export function updateUserProfile(
  userId: string,
  patch: Partial<Pick<UserAccount, 'fullName' | 'signataireNom' | 'signataireQualite' | 'signatureImage'>>,
): UserAccount {
  const users = ensureUsersMigrated()
  const idx = users.findIndex((u) => u.id === userId)
  if (idx < 0) throw new Error('Utilisateur introuvable.')
  users[idx] = { ...users[idx], ...patch }
  saveUsers(users)
  return users[idx]
}

export async function loginAccount(email: string, password: string): Promise<UserAccount> {
  const users = ensureUsersMigrated()
  const user = findByEmail(users, email)
  if (!user) throw new Error('E-mail ou mot de passe incorrect.')
  if (user.active === false) throw new Error('Ce compte opérateur est désactivé. Contactez la société.')
  const hash = await hashPassword(password)
  if (hash !== user.passwordHash) throw new Error('E-mail ou mot de passe incorrect.')
  setSession(user.id)
  return user
}

/** Mot de passe oublié : e-mail + code de récupération → nouveau MDP. */
export async function resetPasswordWithRecovery(opts: {
  email: string
  recoveryCode: string
  newPassword: string
}): Promise<UserAccount> {
  if (opts.newPassword.length < 6) throw new Error('Mot de passe : au moins 6 caractères.')
  const users = ensureUsersMigrated()
  const user = findByEmail(users, opts.email)
  if (!user) throw new Error('Aucun compte avec cet e-mail.')
  if (user.active === false) throw new Error('Compte désactivé. Contactez la société.')
  if (!user.recoveryCodeHash) {
    throw new Error(
      'Pas de code de récupération sur ce compte. Demandez au compte société de réinitialiser le mot de passe (menu Équipe).',
    )
  }
  const codeHash = await hashPassword(normalizeRecoveryCode(opts.recoveryCode))
  if (codeHash !== user.recoveryCodeHash) {
    throw new Error('Code de récupération incorrect.')
  }
  user.passwordHash = await hashPassword(opts.newPassword)
  saveUsers(users)
  return user
}

/** Le compte société régénère le MDP d’un opérateur (+ nouveau code récup.). */
export async function resetOperatorPassword(opts: {
  owner: UserAccount
  userId: string
  newPassword: string
}): Promise<{ user: UserAccount; recoveryCode: string }> {
  if (opts.owner.role !== 'owner') throw new Error('Seul le compte officiel peut réinitialiser un mot de passe.')
  if (opts.newPassword.length < 6) throw new Error('Mot de passe : au moins 6 caractères.')
  const users = ensureUsersMigrated()
  const target = users.find((u) => u.id === opts.userId)
  if (!target || target.organizationId !== opts.owner.organizationId) {
    throw new Error('Opérateur introuvable.')
  }
  const recoveryCode = generateRecoveryCode()
  target.passwordHash = await hashPassword(opts.newPassword)
  target.recoveryCodeHash = await hashPassword(normalizeRecoveryCode(recoveryCode))
  saveUsers(users)
  return { user: target, recoveryCode }
}

/** Régénère un nouveau code de récupération (utilisateur connecté). */
export async function regenerateOwnRecoveryCode(userId: string): Promise<string> {
  const users = ensureUsersMigrated()
  const idx = users.findIndex((u) => u.id === userId)
  if (idx < 0) throw new Error('Utilisateur introuvable.')
  const recoveryCode = generateRecoveryCode()
  users[idx].recoveryCodeHash = await hashPassword(normalizeRecoveryCode(recoveryCode))
  saveUsers(users)
  return recoveryCode
}

export function setSession(userId: string) {
  localStorage.setItem(SESSION_KEY, userId)
}

export function clearSession() {
  localStorage.removeItem(SESSION_KEY)
}

export function getSessionUserId(): string | null {
  return localStorage.getItem(SESSION_KEY)
}

export function getCurrentUser(): UserAccount | null {
  ensureUsersMigrated()
  const id = getSessionUserId()
  if (!id) return null
  const user = loadUsers().find((u) => u.id === id) || null
  if (user && user.active === false) return null
  return user
}

export function getOrganization(organizationId: string): Organization | null {
  return loadOrgs().find((o) => o.id === organizationId) || null
}

export function updateOrganizationName(organizationId: string, name: string, byOwner: UserAccount) {
  if (byOwner.role !== 'owner' || byOwner.organizationId !== organizationId) {
    throw new Error('Action réservée au compte officiel.')
  }
  const orgs = loadOrgs()
  const org = orgs.find((o) => o.id === organizationId)
  if (!org) throw new Error('Société introuvable.')
  org.name = name.trim()
  saveOrgs(orgs)
  return org
}

/** Mot de passe temporaire lisible pour l’opérateur */
export function generateTempPassword(): string {
  const alphabet = 'abcdefghjkmnpqrstuvwxyz23456789'
  return Array.from({ length: 8 }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join('')
}
