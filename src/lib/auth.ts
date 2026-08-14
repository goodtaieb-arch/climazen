/** Comptes + sociétés ClimaZEN — via Supabase Auth + profiles. */

import type { AppData } from './types'
import { emptyData } from './storage'
import { migrateAppData } from './migrate'
import { getSupabase } from './supabase'

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
  /** alias de email */
  username: string
  fullName: string
  createdAt: string
  organizationId: string
  role: UserRole
  active: boolean
  signataireNom?: string
  signataireQualite?: string
  signatureImage?: string
}

export type RegisterResult = {
  user: UserAccount
  /** true si l’e-mail de confirmation est requis */
  needsEmailConfirmation: boolean
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

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

function mapProfile(row: {
  id: string
  email: string
  full_name: string
  organization_id: string
  role: string
  active: boolean
  signataire_nom?: string | null
  signataire_qualite?: string | null
  signature_image?: string | null
  created_at: string
}): UserAccount {
  return {
    id: row.id,
    email: row.email,
    username: row.email,
    fullName: row.full_name,
    createdAt: row.created_at,
    organizationId: row.organization_id,
    role: row.role as UserRole,
    active: row.active !== false,
    signataireNom: row.signataire_nom || undefined,
    signataireQualite: row.signataire_qualite || undefined,
    signatureImage: row.signature_image || undefined,
  }
}

function mapOrg(row: {
  id: string
  name: string
  created_at: string
  owner_user_id: string | null
}): Organization {
  return {
    id: row.id,
    name: row.name,
    createdAt: row.created_at,
    ownerUserId: row.owner_user_id || '',
  }
}

function authErrorMessage(err: { message?: string; code?: string; name?: string } | null | undefined, fallback: string) {
  const msg = err?.message || ''
  if (/load failed|failed to fetch|networkerror|network request failed|fetch/i.test(msg)) {
    return 'Connexion réseau impossible vers Supabase. Sur iPhone : désactive les bloqueurs de contenu / « Protéger du suivi », ou essaie Chrome. Évite parfois la navigation privée.'
  }
  if (/invalid login credentials/i.test(msg)) {
    return 'E-mail ou mot de passe incorrect. Sur téléphone : tape le MDP à la main (pas l’auto-remplissage). Si tu es connecté sur l’ordi → Mon entreprise → Changer mon mot de passe, puis utilise ce MDP ici.'
  }
  if (/email not confirmed/i.test(msg)) {
    return 'Confirmez votre e-mail (lien reçu), puis reconnectez-vous.'
  }
  if (/user already registered/i.test(msg)) return 'Cet e-mail est déjà utilisé.'
  if (/rate limit/i.test(msg)) return 'Trop de tentatives. Réessayez dans quelques minutes.'
  if (/email signups are disabled|email_provider_disabled/i.test(msg)) {
    return 'Inscriptions e-mail désactivées dans Supabase (Auth → Providers → Email).'
  }
  return msg || fallback
}

export async function fetchProfile(userId: string): Promise<UserAccount | null> {
  const sb = getSupabase()
  let { data, error } = await sb.from('profiles').select('*').eq('id', userId).maybeSingle()
  if (error) throw new Error(error.message)

  // Filet si le trigger d’inscription n’a pas créé le profil
  if (!data) {
    const { data: boot, error: bootErr } = await sb.rpc('ensure_my_profile')
    if (bootErr) throw new Error(bootErr.message)
    data = boot
  }

  if (!data) return null
  const user = mapProfile(data)
  if (user.active === false) return null
  return user
}

export async function getOrganization(organizationId: string): Promise<Organization | null> {
  const sb = getSupabase()
  const { data, error } = await sb
    .from('organizations')
    .select('*')
    .eq('id', organizationId)
    .maybeSingle()
  if (error) throw new Error(error.message)
  if (!data) return null
  return mapOrg(data)
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

  const sb = getSupabase()
  const { data, error } = await sb.auth.signUp({
    email,
    password: opts.password,
    options: {
      data: {
        company_name: opts.companyName.trim(),
        full_name: opts.fullName.trim(),
        role: 'owner',
      },
    },
  })
  if (error) throw new Error(authErrorMessage(error, 'Inscription impossible'))
  if (!data.user) throw new Error('Inscription impossible')

  // Session absente = confirmation e-mail requise
  if (!data.session) {
    return {
      user: {
        id: data.user.id,
        email,
        username: email,
        fullName: opts.fullName.trim(),
        createdAt: new Date().toISOString(),
        organizationId: '',
        role: 'owner',
        active: true,
      },
      needsEmailConfirmation: true,
    }
  }

  // Attendre le trigger profile
  let user: UserAccount | null = null
  for (let i = 0; i < 10; i++) {
    user = await fetchProfile(data.user.id)
    if (user) break
    await new Promise((r) => setTimeout(r, 200))
  }
  if (!user) throw new Error('Compte créé mais profil introuvable. Réessayez de vous connecter.')
  return { user, needsEmailConfirmation: false }
}

/** L’owner crée un opérateur (invite + signUp, puis restauration de session). */
export async function createOperatorAccount(opts: {
  owner: UserAccount
  email: string
  password: string
  fullName: string
}): Promise<{ user: UserAccount }> {
  if (opts.owner.role !== 'owner') throw new Error('Seul le compte officiel peut ajouter des opérateurs.')
  const email = normalizeEmail(opts.email)
  if (!isValidEmail(email)) throw new Error('Indiquez un e-mail valide pour l’opérateur.')
  if (opts.password.length < 6) throw new Error('Mot de passe : au moins 6 caractères.')
  if (!opts.fullName.trim()) throw new Error('Indiquez le nom de l’opérateur.')

  const sb = getSupabase()
  const { data: sessionData } = await sb.auth.getSession()
  const ownerSession = sessionData.session
  if (!ownerSession) throw new Error('Session expirée. Reconnectez-vous.')

  const { data: invite, error: inviteErr } = await sb
    .from('operator_invites')
    .insert({
      organization_id: opts.owner.organizationId,
      email,
      full_name: opts.fullName.trim(),
      created_by: opts.owner.id,
    })
    .select('*')
    .single()
  if (inviteErr) throw new Error(inviteErr.message)

  const { data: signData, error: signErr } = await sb.auth.signUp({
    email,
    password: opts.password,
    options: {
      data: {
        role: 'operateur',
        invite_id: invite.id,
        full_name: opts.fullName.trim(),
      },
    },
  })

  // Restaurer la session owner dans tous les cas
  await sb.auth.setSession({
    access_token: ownerSession.access_token,
    refresh_token: ownerSession.refresh_token,
  })

  if (signErr) throw new Error(authErrorMessage(signErr, 'Création opérateur impossible'))
  if (!signData.user) throw new Error('Création opérateur impossible')

  let user: UserAccount | null = null
  for (let i = 0; i < 10; i++) {
    const { data } = await sb.from('profiles').select('*').eq('id', signData.user.id).maybeSingle()
    if (data) {
      user = mapProfile(data)
      break
    }
    await new Promise((r) => setTimeout(r, 200))
  }
  if (!user) {
    // Profil peut arriver après confirmation e-mail
    user = {
      id: signData.user.id,
      email,
      username: email,
      fullName: opts.fullName.trim(),
      createdAt: new Date().toISOString(),
      organizationId: opts.owner.organizationId,
      role: 'operateur',
      active: true,
    }
  }
  return { user }
}

export async function listOrgUsers(organizationId: string): Promise<UserAccount[]> {
  const sb = getSupabase()
  // Pas de signature_image : personnelle, invisible pour l’admin / collègues
  const { data, error } = await sb
    .from('profiles')
    .select(
      'id, organization_id, email, full_name, role, active, signataire_nom, signataire_qualite, created_at',
    )
    .eq('organization_id', organizationId)
    .order('role', { ascending: true })
  if (error) throw new Error(error.message)
  return (data || [])
    .map((row) =>
      mapProfile({
        ...row,
        signature_image: null,
      }),
    )
    .sort((a, b) => {
      if (a.role === b.role) return a.fullName.localeCompare(b.fullName)
      return a.role === 'owner' ? -1 : 1
    })
}

export async function setUserActive(userId: string, active: boolean, byOwner: UserAccount) {
  if (byOwner.role !== 'owner') throw new Error('Action réservée au compte officiel.')
  const sb = getSupabase()
  const { data, error } = await sb
    .from('profiles')
    .update({ active })
    .eq('id', userId)
    .eq('organization_id', byOwner.organizationId)
    .eq('role', 'operateur')
    .select('*')
    .single()
  if (error) throw new Error(error.message || 'Opérateur introuvable.')
  return mapProfile(data)
}

export async function updateUserProfile(
  userId: string,
  patch: Partial<Pick<UserAccount, 'fullName' | 'signataireNom' | 'signataireQualite' | 'signatureImage'>>,
): Promise<UserAccount> {
  const sb = getSupabase()
  const {
    data: { user: authUser },
  } = await sb.auth.getUser()
  if (!authUser || authUser.id !== userId) {
    throw new Error('Vous ne pouvez modifier que votre propre signature / profil.')
  }
  const row: Record<string, string | undefined> = {}
  if (patch.fullName !== undefined) row.full_name = patch.fullName
  if (patch.signataireNom !== undefined) row.signataire_nom = patch.signataireNom
  if (patch.signataireQualite !== undefined) row.signataire_qualite = patch.signataireQualite
  if (patch.signatureImage !== undefined) row.signature_image = patch.signatureImage

  const { data, error } = await sb.from('profiles').update(row).eq('id', userId).select('*').single()
  if (error) throw new Error(error.message || 'Utilisateur introuvable.')
  return mapProfile(data)
}

export async function loginAccount(email: string, password: string): Promise<UserAccount> {
  const sb = getSupabase()
  // Trim : l’auto-remplissage téléphone ajoute parfois des espaces
  const cleanEmail = normalizeEmail(email)
  const cleanPassword = password.trim()
  try {
    const { data, error } = await sb.auth.signInWithPassword({
      email: cleanEmail,
      password: cleanPassword,
    })
    if (error) throw new Error(authErrorMessage(error, 'E-mail ou mot de passe incorrect.'))
    if (!data.user) throw new Error('E-mail ou mot de passe incorrect.')

    const user = await fetchProfile(data.user.id)
    if (!user) throw new Error('Ce compte opérateur est désactivé. Contactez la société.')
    return user
  } catch (err) {
    if (err instanceof Error && /incorrect|désactivé|réseau|Supabase|caractères|e-mail/i.test(err.message)) {
      throw err
    }
    throw new Error(authErrorMessage(err as { message?: string }, 'Connexion impossible'))
  }
}

export async function logoutAccount() {
  const sb = getSupabase()
  await sb.auth.signOut()
}

/** Envoie un e-mail de réinitialisation (Supabase). */
export async function requestPasswordReset(email: string) {
  if (!isValidEmail(email)) throw new Error('Indiquez un e-mail valide.')
  const sb = getSupabase()
  const redirectTo = `${window.location.origin}/reset-password`
  const { error } = await sb.auth.resetPasswordForEmail(normalizeEmail(email), { redirectTo })
  if (error) throw new Error(authErrorMessage(error, 'Envoi impossible'))
}

/** Après clic sur le lien e-mail : définir le nouveau mot de passe. */
export async function updatePassword(newPassword: string) {
  if (newPassword.length < 6) throw new Error('Mot de passe : au moins 6 caractères.')
  const sb = getSupabase()
  const { error } = await sb.auth.updateUser({ password: newPassword })
  if (error) throw new Error(authErrorMessage(error, 'Mise à jour impossible'))
}

/** Owner : envoie un lien de reset à l’opérateur. */
export async function sendOperatorPasswordReset(opts: {
  owner: UserAccount
  userId: string
}): Promise<{ email: string }> {
  if (opts.owner.role !== 'owner') throw new Error('Seul le compte officiel peut réinitialiser un mot de passe.')
  const sb = getSupabase()
  const { data, error } = await sb
    .from('profiles')
    .select('*')
    .eq('id', opts.userId)
    .eq('organization_id', opts.owner.organizationId)
    .maybeSingle()
  if (error || !data) throw new Error('Opérateur introuvable.')
  await requestPasswordReset(data.email)
  return { email: data.email }
}

export async function updateOrganizationName(organizationId: string, name: string, byOwner: UserAccount) {
  if (byOwner.role !== 'owner' || byOwner.organizationId !== organizationId) {
    throw new Error('Action réservée au compte officiel.')
  }
  const sb = getSupabase()
  const { data, error } = await sb
    .from('organizations')
    .update({ name: name.trim() })
    .eq('id', organizationId)
    .select('*')
    .single()
  if (error) throw new Error(error.message || 'Société introuvable.')
  return mapOrg(data)
}

export function generateTempPassword(): string {
  const alphabet = 'abcdefghjkmnpqrstuvwxyz23456789'
  return Array.from({ length: 8 }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join('')
}

/** Charge AppData depuis Supabase (fallback vide). */
export async function loadOrgDataRemote(organizationId: string): Promise<AppData> {
  const sb = getSupabase()
  const { data, error } = await sb
    .from('org_data')
    .select('payload')
    .eq('organization_id', organizationId)
    .maybeSingle()
  if (error) throw new Error(error.message)
  return normalizeAppData(data?.payload)
}

export async function saveOrgDataRemote(organizationId: string, data: AppData): Promise<void> {
  const sb = getSupabase()
  const light = stripHeavy(data)
  const { error } = await sb.from('org_data').upsert({
    organization_id: organizationId,
    payload: light,
    updated_at: new Date().toISOString(),
  })
  if (error) throw new Error(error.message)
}

function stripHeavy(data: AppData): AppData {
  return {
    ...data,
    interventions: data.interventions.map((rest) => {
      const { cerfaPdfBase64: _drop, ...clean } = rest as typeof rest & { cerfaPdfBase64?: string }
      return clean
    }),
  }
}

export function normalizeAppData(raw: unknown): AppData {
  const base = emptyData()
  if (!raw || typeof raw !== 'object') return base
  const parsed = raw as Partial<AppData>
  // Empty cloud payload {}
  if (!parsed.operateur && !parsed.clients && !parsed.chantiers) return base
  const stock = (parsed.stock || []).map((s) => ({
    ...s,
    quantiteInitialeKg: s.quantiteInitialeKg ?? s.quantiteKg,
  }))
  return migrateAppData({
    ...base,
    ...parsed,
    operateur: parsed.operateur || base.operateur,
    stock,
    stockMouvements: parsed.stockMouvements || [],
    interventions: parsed.interventions || [],
    clients: parsed.clients || [],
    chantiers: parsed.chantiers || [],
    detecteurs: parsed.detecteurs,
    fichesMaintenanceClim: parsed.fichesMaintenanceClim || [],
  })
}

/** Données locales encore présentes sur cet appareil (avant migration cloud). */
export function findLocalOrgDataCandidates(): { key: string; organizationId: string; data: AppData }[] {
  const out: { key: string; organizationId: string; data: AppData }[] = []
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (!key?.startsWith('climazen_orgdata_')) continue
      const organizationId = key.replace('climazen_orgdata_', '')
      const raw = localStorage.getItem(key)
      if (!raw) continue
      const data = normalizeAppData(JSON.parse(raw))
      const hasContent =
        data.clients.length > 0 ||
        data.chantiers.length > 0 ||
        data.stock.length > 0 ||
        data.interventions.length > 0 ||
        Boolean(data.operateur?.raisonSociale)
      if (hasContent) out.push({ key, organizationId, data })
    }
  } catch {
    // ignore
  }
  return out
}

export function isAppDataEmpty(data: AppData): boolean {
  return (
    data.clients.length === 0 &&
    data.chantiers.length === 0 &&
    data.stock.length === 0 &&
    data.interventions.length === 0 &&
    !data.operateur?.raisonSociale
  )
}

/** Poids approximatif pour comparer cache local vs cloud (évite d’écraser des saisies). */
export function appDataWeight(data: AppData): number {
  const o = data.operateur
  return (
    (data.clients?.length || 0) * 10 +
    (data.chantiers?.length || 0) * 10 +
    (data.interventions?.length || 0) * 5 +
    (data.stock?.length || 0) * 2 +
    (data.detecteurs?.length || 0) * 2 +
    (data.fichesMaintenanceClim?.length || 0) * 2 +
    (data.ordresTravail?.length || 0) * 2 +
    (o?.raisonSociale?.trim() ? 25 : 0) +
    (o?.adresse?.trim() ? 5 : 0) +
    (o?.siret?.trim() ? 5 : 0) +
    (o?.attestationNumero?.trim() ? 5 : 0) +
    (o?.telephone?.trim() ? 3 : 0) +
    (o?.email?.trim() ? 3 : 0) +
    (o?.logoImage ? 5 : 0)
  )
}

function pickNonEmpty(remote: string | undefined, local: string | undefined): string {
  const r = (remote || '').trim()
  if (r) return remote || ''
  return local || ''
}

/** Fusionne le cadre société : ne jamais perdre une raison sociale / SIRET saisis localement. */
export function mergeOperateurPreferFilled(
  remote: AppData['operateur'],
  local: AppData['operateur'],
): AppData['operateur'] {
  return {
    ...remote,
    id: remote?.id || local?.id || remote.id,
    raisonSociale: pickNonEmpty(remote?.raisonSociale, local?.raisonSociale),
    adresse: pickNonEmpty(remote?.adresse, local?.adresse),
    siret: pickNonEmpty(remote?.siret, local?.siret),
    attestationNumero: pickNonEmpty(remote?.attestationNumero, local?.attestationNumero),
    telephone: pickNonEmpty(remote?.telephone, local?.telephone),
    email: pickNonEmpty(remote?.email, local?.email),
    detecteurIdentification: pickNonEmpty(
      remote?.detecteurIdentification,
      local?.detecteurIdentification,
    ),
    detecteurControleDate: pickNonEmpty(remote?.detecteurControleDate, local?.detecteurControleDate),
    logoImage: remote?.logoImage || local?.logoImage,
    facturationPlateforme: remote?.facturationPlateforme || local?.facturationPlateforme,
    facturationWebhookUrl: pickNonEmpty(remote?.facturationWebhookUrl, local?.facturationWebhookUrl),
    facturationActionDefaut: remote?.facturationActionDefaut || local?.facturationActionDefaut,
  }
}

/**
 * Au chargement : si le cloud est vide/plus pauvre que le cache appareil,
 * on garde le local et on le re-poussera (évite de tout ressaisir Entreprise).
 */
export function resolveRemoteVsLocal(
  remote: AppData,
  local: AppData,
): { data: AppData; shouldPushLocal: boolean } {
  const localW = appDataWeight(local)
  const remoteW = appDataWeight(remote)

  if (isAppDataEmpty(remote) && localW > 0) {
    return { data: local, shouldPushLocal: true }
  }

  if (localW > remoteW + 5) {
    // Local clairement plus riche (ex. société remplie + cloud encore vide)
    const merged: AppData = {
      ...local,
      operateur: mergeOperateurPreferFilled(remote.operateur, local.operateur),
    }
    // Collections : prendre le jeu le plus fourni
    if ((remote.clients?.length || 0) > (local.clients?.length || 0)) merged.clients = remote.clients
    if ((remote.chantiers?.length || 0) > (local.chantiers?.length || 0)) {
      merged.chantiers = remote.chantiers
    }
    if ((remote.interventions?.length || 0) > (local.interventions?.length || 0)) {
      merged.interventions = remote.interventions
    }
    if ((remote.stock?.length || 0) > (local.stock?.length || 0)) merged.stock = remote.stock
    if ((remote.detecteurs?.length || 0) > (local.detecteurs?.length || 0)) {
      merged.detecteurs = remote.detecteurs
    }
    return { data: merged, shouldPushLocal: true }
  }

  // Cloud OK : compléter quand même les champs société vides côté remote
  const operateur = mergeOperateurPreferFilled(remote.operateur, local.operateur)
  const enriched =
    appDataWeight({ ...remote, operateur }) > remoteW ||
    Boolean(operateur.raisonSociale && !remote.operateur?.raisonSociale?.trim())
  return {
    data: { ...remote, operateur },
    shouldPushLocal: enriched,
  }
}

const IMPORT_FLAG = 'climazen_import_done_v1'

export function wasLocalImportDone(organizationId: string) {
  try {
    return localStorage.getItem(`${IMPORT_FLAG}_${organizationId}`) === '1'
  } catch {
    return false
  }
}

export function markLocalImportDone(organizationId: string) {
  try {
    localStorage.setItem(`${IMPORT_FLAG}_${organizationId}`, '1')
  } catch {
    // ignore
  }
}
