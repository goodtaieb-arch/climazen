import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import {
  createOperatorAccount,
  fetchProfile,
  getOrganization,
  listOrgUsers,
  loginAccount,
  logoutAccount,
  registerCompany,
  requestPasswordReset,
  sendOperatorPasswordReset,
  setUserActive,
  updatePassword,
  updateUserProfile,
  type Organization,
  type UserAccount,
} from './auth'
import {
  clearOfflineSession,
  isBrowserOnline,
  loadOfflineSession,
  saveOfflineSession,
} from './offlineSync'
import { getSupabase, isSupabaseConfigured } from './supabase'

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = window.setTimeout(() => {
      reject(new Error(`${label} — délai dépassé (${Math.round(ms / 1000)}s)`))
    }, ms)
    promise.then(
      (v) => {
        window.clearTimeout(t)
        resolve(v)
      },
      (e) => {
        window.clearTimeout(t)
        reject(e)
      },
    )
  })
}

type AuthCtx = {
  user: UserAccount | null
  organization: Organization | null
  loading: boolean
  configured: boolean
  isOwner: boolean
  login: (email: string, password: string) => Promise<void>
  registerCompany: (opts: {
    companyName: string
    email: string
    password: string
    fullName: string
  }) => Promise<{ needsEmailConfirmation: boolean }>
  logout: () => Promise<void>
  refreshUser: () => Promise<void>
  createOperator: (opts: {
    email: string
    password: string
    fullName: string
  }) => Promise<{ user: UserAccount }>
  setOperatorActive: (userId: string, active: boolean) => Promise<void>
  resetOperatorPassword: (userId: string) => Promise<{ email: string }>
  requestPasswordReset: (email: string) => Promise<void>
  updatePassword: (newPassword: string) => Promise<void>
  saveMySignature: (patch: {
    signataireNom?: string
    signataireQualite?: string
    signatureImage?: string
  }) => Promise<void>
  listTeam: () => Promise<UserAccount[]>
}

const Ctx = createContext<AuthCtx | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const configured = isSupabaseConfigured()
  const [user, setUser] = useState<UserAccount | null>(null)
  const [organization, setOrganization] = useState<Organization | null>(null)
  const [loading, setLoading] = useState(true)
  const [teamTick, setTeamTick] = useState(0)

  const refreshUser = useCallback(async () => {
    if (!isSupabaseConfigured()) {
      setUser(null)
      setOrganization(null)
      return
    }
    try {
      const sb = getSupabase()
      const { data: sessionData } = await withTimeout(
        sb.auth.getSession(),
        10000,
        'Connexion session',
      )
      const uid = sessionData.session?.user?.id
      if (!uid) {
        setUser(null)
        setOrganization(null)
        clearOfflineSession()
        return
      }
      const u = await withTimeout(fetchProfile(uid), 10000, 'Chargement profil')
      setUser(u)
      let org: Organization | null = null
      if (u?.organizationId) {
        org = await withTimeout(
          getOrganization(u.organizationId),
          10000,
          'Chargement société',
        )
        setOrganization(org)
      } else {
        setOrganization(null)
      }
      if (u) {
        saveOfflineSession({
          user: u,
          organization: org,
          cachedAt: new Date().toISOString(),
        })
      }
    } catch (err) {
      console.error(err)
      // Hors ligne : reprendre la dernière session connue sur l’appareil
      if (!isBrowserOnline()) {
        const cached = loadOfflineSession()
        if (cached?.user) {
          setUser(cached.user as UserAccount)
          setOrganization((cached.organization as Organization | null) || null)
          return
        }
      }
      throw err
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    let unsubscribe: (() => void) | undefined

    ;(async () => {
      try {
        if (!isSupabaseConfigured()) {
          if (!cancelled) setLoading(false)
          return
        }
        await refreshUser()
        if (cancelled) return
        const sb = getSupabase()
        const { data: sub } = sb.auth.onAuthStateChange(() => {
          void refreshUser()
        })
        unsubscribe = () => sub.subscription.unsubscribe()
      } catch (err) {
        console.error(err)
        if (!cancelled) {
          const cached = loadOfflineSession()
          if (cached?.user && (!isBrowserOnline() || cached.user)) {
            setUser(cached.user as UserAccount)
            setOrganization((cached.organization as Organization | null) || null)
          } else {
            setUser(null)
            setOrganization(null)
          }
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()

    return () => {
      cancelled = true
      unsubscribe?.()
    }
  }, [refreshUser])

  const login = useCallback(async (email: string, password: string) => {
    const u = await loginAccount(email, password)
    setUser(u)
    const org = await getOrganization(u.organizationId)
    setOrganization(org)
  }, [])

  const registerCompanyFn = useCallback(
    async (opts: {
      companyName: string
      email: string
      password: string
      fullName: string
    }) => {
      const { user: u, needsEmailConfirmation } = await registerCompany(opts)
      if (!needsEmailConfirmation) {
        setUser(u)
        if (u.organizationId) {
          const org = await getOrganization(u.organizationId)
          setOrganization(org)
        }
      }
      return { needsEmailConfirmation }
    },
    [],
  )

  const logout = useCallback(async () => {
    await logoutAccount()
    clearOfflineSession()
    setUser(null)
    setOrganization(null)
  }, [])

  const createOperator = useCallback(
    async (opts: { email: string; password: string; fullName: string }) => {
      if (!user) throw new Error('Non connecté')
      const result = await createOperatorAccount({ owner: user, ...opts })
      setTeamTick((t) => t + 1)
      return result
    },
    [user],
  )

  const setOperatorActiveFn = useCallback(
    async (userId: string, active: boolean) => {
      if (!user) throw new Error('Non connecté')
      await setUserActive(userId, active, user)
      setTeamTick((t) => t + 1)
    },
    [user],
  )

  const resetOperatorPasswordFn = useCallback(
    async (userId: string) => {
      if (!user) throw new Error('Non connecté')
      const result = await sendOperatorPasswordReset({ owner: user, userId })
      setTeamTick((t) => t + 1)
      return result
    },
    [user],
  )

  const requestPasswordResetFn = useCallback(async (email: string) => {
    await requestPasswordReset(email)
  }, [])

  const updatePasswordFn = useCallback(async (newPassword: string) => {
    await updatePassword(newPassword)
  }, [])

  const saveMySignature = useCallback(
    async (patch: {
      signataireNom?: string
      signataireQualite?: string
      signatureImage?: string
    }) => {
      if (!user) throw new Error('Non connecté')
      const updated = await updateUserProfile(user.id, patch)
      setUser(updated)
    },
    [user],
  )

  const listTeam = useCallback(async () => {
    if (!user) return []
    void teamTick
    const orgId = user.organizationId || organization?.id || ''
    return listOrgUsers(orgId)
  }, [user, organization?.id, teamTick])

  const value = useMemo(
    () => ({
      user,
      organization,
      loading,
      configured,
      isOwner: user?.role === 'owner',
      login,
      registerCompany: registerCompanyFn,
      logout,
      refreshUser,
      createOperator,
      setOperatorActive: setOperatorActiveFn,
      resetOperatorPassword: resetOperatorPasswordFn,
      requestPasswordReset: requestPasswordResetFn,
      updatePassword: updatePasswordFn,
      saveMySignature,
      listTeam,
    }),
    [
      user,
      organization,
      loading,
      configured,
      login,
      registerCompanyFn,
      logout,
      refreshUser,
      createOperator,
      setOperatorActiveFn,
      resetOperatorPasswordFn,
      requestPasswordResetFn,
      updatePasswordFn,
      saveMySignature,
      listTeam,
    ],
  )

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useAuth() {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
