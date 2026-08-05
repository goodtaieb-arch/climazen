import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import {
  clearSession,
  createOperatorAccount,
  getCurrentUser,
  getOrganization,
  listOrgUsers,
  loginAccount,
  regenerateOwnRecoveryCode,
  registerCompany,
  resetOperatorPassword,
  resetPasswordWithRecovery,
  setUserActive,
  updateUserProfile,
  type Organization,
  type UserAccount,
} from './auth'

type AuthCtx = {
  user: UserAccount | null
  organization: Organization | null
  isOwner: boolean
  login: (email: string, password: string) => Promise<void>
  registerCompany: (opts: {
    companyName: string
    email: string
    password: string
    fullName: string
  }) => Promise<string>
  logout: () => void
  refreshUser: () => void
  createOperator: (opts: {
    email: string
    password: string
    fullName: string
  }) => Promise<{ user: UserAccount; recoveryCode: string }>
  setOperatorActive: (userId: string, active: boolean) => void
  resetOperatorPassword: (
    userId: string,
    newPassword: string,
  ) => Promise<{ user: UserAccount; recoveryCode: string }>
  resetPasswordWithRecovery: (opts: {
    email: string
    recoveryCode: string
    newPassword: string
  }) => Promise<void>
  regenerateRecoveryCode: () => Promise<string>
  saveMySignature: (patch: {
    signataireNom?: string
    signataireQualite?: string
    signatureImage?: string
  }) => void
  listTeam: () => UserAccount[]
}

const Ctx = createContext<AuthCtx | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserAccount | null>(() => getCurrentUser())
  const [orgTick, setOrgTick] = useState(0)

  const organization = useMemo(() => {
    void orgTick
    if (!user?.organizationId) return null
    return getOrganization(user.organizationId)
  }, [user?.organizationId, orgTick])

  const refreshUser = useCallback(() => {
    setUser(getCurrentUser())
    setOrgTick((t) => t + 1)
  }, [])

  const login = useCallback(async (email: string, password: string) => {
    const u = await loginAccount(email, password)
    setUser(u)
    setOrgTick((t) => t + 1)
  }, [])

  const registerCompanyFn = useCallback(
    async (opts: {
      companyName: string
      email: string
      password: string
      fullName: string
    }) => {
      const { user: u, recoveryCode } = await registerCompany(opts)
      setUser(u)
      setOrgTick((t) => t + 1)
      return recoveryCode
    },
    [],
  )

  const logout = useCallback(() => {
    clearSession()
    setUser(null)
  }, [])

  const createOperator = useCallback(
    async (opts: { email: string; password: string; fullName: string }) => {
      if (!user) throw new Error('Non connecté')
      const result = await createOperatorAccount({ owner: user, ...opts })
      setOrgTick((t) => t + 1)
      return result
    },
    [user],
  )

  const setOperatorActive = useCallback(
    (userId: string, active: boolean) => {
      if (!user) throw new Error('Non connecté')
      setUserActive(userId, active, user)
      setOrgTick((t) => t + 1)
    },
    [user],
  )

  const resetOperatorPasswordFn = useCallback(
    async (userId: string, newPassword: string) => {
      if (!user) throw new Error('Non connecté')
      const result = await resetOperatorPassword({ owner: user, userId, newPassword })
      setOrgTick((t) => t + 1)
      return result
    },
    [user],
  )

  const resetPasswordWithRecoveryFn = useCallback(
    async (opts: { email: string; recoveryCode: string; newPassword: string }) => {
      await resetPasswordWithRecovery(opts)
    },
    [],
  )

  const regenerateRecoveryCodeFn = useCallback(async () => {
    if (!user) throw new Error('Non connecté')
    const code = await regenerateOwnRecoveryCode(user.id)
    setUser(getCurrentUser())
    return code
  }, [user])

  const saveMySignature = useCallback(
    (patch: {
      signataireNom?: string
      signataireQualite?: string
      signatureImage?: string
    }) => {
      if (!user) throw new Error('Non connecté')
      const updated = updateUserProfile(user.id, patch)
      setUser(updated)
    },
    [user],
  )

  const listTeam = useCallback(() => {
    if (!user) return []
    return listOrgUsers(user.organizationId)
  }, [user, orgTick]) // eslint-disable-line react-hooks/exhaustive-deps

  const value = useMemo(
    () => ({
      user,
      organization,
      isOwner: user?.role === 'owner',
      login,
      registerCompany: registerCompanyFn,
      logout,
      refreshUser,
      createOperator,
      setOperatorActive,
      resetOperatorPassword: resetOperatorPasswordFn,
      resetPasswordWithRecovery: resetPasswordWithRecoveryFn,
      regenerateRecoveryCode: regenerateRecoveryCodeFn,
      saveMySignature,
      listTeam,
    }),
    [
      user,
      organization,
      login,
      registerCompanyFn,
      logout,
      refreshUser,
      createOperator,
      setOperatorActive,
      resetOperatorPasswordFn,
      resetPasswordWithRecoveryFn,
      regenerateRecoveryCodeFn,
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
