/** Comptes + sociétés ClimaZEN — la boîte garde la main, les CERFA remontent sur le compte officiel. */

export type UserRole = 'owner' | 'operateur'

export type Organization = {
  id: string
  name: string
  createdAt: string
  ownerUserId: string
}

export type UserAccount = {
  id: string
  username: string
  passwordHash: string
  fullName: string
  createdAt: string
  /** Société / boîte */
  organizationId: string
  role: UserRole
  active: boolean
  /** Signature perso opérateur (préremplie sur ses CERFA) */
  signataireNom?: string
  signataireQualite?: string
  signatureImage?: string
}

const USERS_KEY = 'climazen_users_v1'
const ORGS_KEY = 'climazen_orgs_v1'
const SESSION_KEY = 'climazen_session_v1'

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

export function normalizeUsername(username: string) {
  return username.trim().toLowerCase()
}

export function dataKeyForOrg(organizationId: string) {
  return `climazen_orgdata_${organizationId}`
}

/** @deprecated — données désormais par société */
export function dataKeyForUser(userId: string) {
  return `climazen_data_${userId}`
}

function migrateLegacyUser(u: UserAccount): UserAccount {
  if (u.organizationId && u.role) return { ...u, active: u.active !== false }
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
  // migrer anciennes données user → org
  try {
    const legacy = localStorage.getItem(dataKeyForUser(u.id))
    if (legacy && !localStorage.getItem(dataKeyForOrg(orgId))) {
      localStorage.setItem(dataKeyForOrg(orgId), legacy)
    }
  } catch {
    // ignore
  }
  return {
    ...u,
    organizationId: orgId,
    role: 'owner',
    active: true,
  }
}

export function ensureUsersMigrated(): UserAccount[] {
  const users = loadUsers()
  let changed = false
  const next = users.map((u) => {
    if (u.organizationId && u.role) return { ...u, active: u.active !== false }
    changed = true
    return migrateLegacyUser(u)
  })
  if (changed) saveUsers(next)
  return next
}

/** Création du compte officiel société (owner). */
export async function registerCompany(opts: {
  companyName: string
  username: string
  password: string
  fullName: string
}): Promise<UserAccount> {
  const username = normalizeUsername(opts.username)
  if (!opts.companyName.trim()) throw new Error('Indiquez le nom de la société.')
  if (username.length < 3) throw new Error('Nom d’utilisateur : au moins 3 caractères.')
  if (opts.password.length < 6) throw new Error('Mot de passe : au moins 6 caractères.')
  if (!opts.fullName.trim()) throw new Error('Indiquez votre nom.')

  const users = ensureUsersMigrated()
  if (users.some((u) => u.username === username)) {
    throw new Error('Ce nom d’utilisateur existe déjà.')
  }

  const orgId = crypto.randomUUID()
  const userId = crypto.randomUUID()
  const now = new Date().toISOString()

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
    username,
    passwordHash: await hashPassword(opts.password),
    fullName: opts.fullName.trim(),
    createdAt: now,
    organizationId: orgId,
    role: 'owner',
    active: true,
    signataireNom: opts.fullName.trim(),
    signataireQualite: 'Responsable / gérant',
  }
  users.push(account)
  saveUsers(users)
  setSession(account.id)
  return account
}

/** @deprecated alias — crée une société */
export async function registerAccount(opts: {
  username: string
  password: string
  fullName: string
  companyName?: string
}): Promise<UserAccount> {
  return registerCompany({
    companyName: opts.companyName || opts.fullName,
    username: opts.username,
    password: opts.password,
    fullName: opts.fullName,
  })
}

/** L’owner crée un opérateur rattaché à la boîte. */
export async function createOperatorAccount(opts: {
  owner: UserAccount
  username: string
  password: string
  fullName: string
}): Promise<UserAccount> {
  if (opts.owner.role !== 'owner') throw new Error('Seul le compte officiel peut ajouter des opérateurs.')
  const username = normalizeUsername(opts.username)
  if (username.length < 3) throw new Error('Nom d’utilisateur : au moins 3 caractères.')
  if (opts.password.length < 6) throw new Error('Mot de passe : au moins 6 caractères.')
  if (!opts.fullName.trim()) throw new Error('Indiquez le nom de l’opérateur.')

  const users = ensureUsersMigrated()
  if (users.some((u) => u.username === username)) {
    throw new Error('Ce nom d’utilisateur existe déjà.')
  }

  const account: UserAccount = {
    id: crypto.randomUUID(),
    username,
    passwordHash: await hashPassword(opts.password),
    fullName: opts.fullName.trim(),
    createdAt: new Date().toISOString(),
    organizationId: opts.owner.organizationId,
    role: 'operateur',
    active: true,
    signataireNom: opts.fullName.trim(),
    signataireQualite: 'Opérateur attesté',
  }
  users.push(account)
  saveUsers(users)
  return account
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

export async function loginAccount(username: string, password: string): Promise<UserAccount> {
  const users = ensureUsersMigrated()
  const user = users.find((u) => u.username === normalizeUsername(username))
  if (!user) throw new Error('Identifiant ou mot de passe incorrect.')
  if (user.active === false) throw new Error('Ce compte opérateur est désactivé. Contactez la société.')
  const hash = await hashPassword(password)
  if (hash !== user.passwordHash) throw new Error('Identifiant ou mot de passe incorrect.')
  setSession(user.id)
  return user
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
